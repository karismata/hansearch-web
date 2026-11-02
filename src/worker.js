const ALLOWED_ORIGINS = new Set([
  "https://hansearch-web.pages.dev",
  "https://hansearch-web.karis830519.workers.dev",
  "http://localhost:5173",
]);
const JOB_TTL_MS = 10 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const MAX_JOBS_PER_IP = 20;

function isAllowedOrigin(origin) {
  if (ALLOWED_ORIGINS.has(origin)) return true;
  try {
    const hostname = new URL(origin).hostname;
    return hostname.endsWith('.hansearch-web.pages.dev') ||
      hostname.endsWith('-hansearch-web.karis830519.workers.dev');
  } catch {
    return false;
  }
}

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  const headers = new Headers({
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  });
  if (isAllowedOrigin(origin)) headers.set("Access-Control-Allow-Origin", origin);
  return headers;
}

function jsonResponse(request, data, status = 200) {
  const headers = corsHeaders(request);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(data), { status, headers });
}

function unauthorized(request, status = 401) {
  return jsonResponse(request, { error: status === 503 ? "AI relay token is not configured" : "Unauthorized" }, status);
}

function authorized(request, env) {
  const expected = env.AI_ACCESS_TOKEN;
  const provided = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  return typeof expected === "string" && expected.length >= 32 && provided === expected;
}

async function withCors(request, response) {
  const headers = new Headers(response.headers);
  for (const [key, value] of corsHeaders(request)) headers.set(key, value);
  headers.set("Cache-Control", "no-store");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/ai/")) {
      if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request) });
      if (!env.AI_ACCESS_TOKEN || env.AI_ACCESS_TOKEN.length < 32) return unauthorized(request, 503);

      const queueId = env.AI_QUEUE.idFromName("hansearch-global");
      const queue = env.AI_QUEUE.get(queueId);
      let targetPath;
      let isAgentRequest = false;
      if (url.pathname === "/api/ai/jobs" && request.method === "POST") {
        if (!isAllowedOrigin(request.headers.get("Origin") || "")) {
          return jsonResponse(request, { error: "Origin not allowed" }, 403);
        }
        targetPath = "/enqueue";
      } else if (url.pathname === "/api/ai/agent/next" && request.method === "GET") {
        isAgentRequest = true;
        targetPath = "/next";
      } else {
        const jobMatch = url.pathname.match(/^\/api\/ai\/jobs\/([\w-]+)$/);
        const completeMatch = url.pathname.match(/^\/api\/ai\/agent\/complete\/([\w-]+)$/);
        if (jobMatch && request.method === "GET") {
          if (!isAllowedOrigin(request.headers.get("Origin") || "")) {
            return jsonResponse(request, { error: "Origin not allowed" }, 403);
          }
          targetPath = `/jobs/${jobMatch[1]}`;
        }
        else if (completeMatch && request.method === "POST") {
          isAgentRequest = true;
          targetPath = `/complete/${completeMatch[1]}`;
        }
        else return jsonResponse(request, { error: "Not found" }, 404);
      }

      if (isAgentRequest && !authorized(request, env)) return unauthorized(request);

      const forwarded = new Request(`https://ai-queue.internal${targetPath}`, request);
      return withCors(request, await queue.fetch(forwarded));
    }

    return env.ASSETS.fetch(request);
  },
};

export class AIQueue {
  constructor(state) {
    this.state = state;
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/enqueue" && request.method === "POST") {
      const body = await request.json().catch(() => null);
      const query = typeof body?.query === "string" ? body.query.trim() : "";
      if (!query || query.length > 1000) return Response.json({ error: "검색어는 1~1000자여야 합니다." }, { status: 400 });

      const now = Date.now();
      const existing = await this.state.storage.list({ prefix: "job:" });
      const activeJobs = [...existing.values()].filter((job) => now - job.createdAt < JOB_TTL_MS);
      if (activeJobs.length >= 30) return Response.json({ error: "AI 검색 요청이 많습니다. 잠시 후 다시 시도해 주세요." }, { status: 429 });

      const clientIp = request.headers.get("CF-Connecting-IP") || "unknown";
      const ipDigest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(clientIp));
      const ipHash = [...new Uint8Array(ipDigest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
      const rateKey = `rate:${ipHash}`;
      const rate = await this.state.storage.get(rateKey);
      const currentRate = rate && now < rate.resetAt ? rate : { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
      if (currentRate.count >= MAX_JOBS_PER_IP) {
        return Response.json(
          { error: "AI 검색 요청이 잠시 많습니다. 10분 후 다시 시도해 주세요." },
          { status: 429, headers: { "Retry-After": String(Math.ceil((currentRate.resetAt - now) / 1000)) } },
        );
      }
      currentRate.count += 1;
      await this.state.storage.put(rateKey, currentRate);

      const job = { id: crypto.randomUUID(), query, status: "pending", createdAt: now };
      await this.state.storage.put(`job:${job.id}`, job);
      const existingAlarm = await this.state.storage.getAlarm();
      const nextAlarm = Math.min(now + JOB_TTL_MS, currentRate.resetAt, existingAlarm ?? Infinity);
      await this.state.storage.setAlarm(nextAlarm);
      return Response.json({ id: job.id, status: job.status }, { status: 202 });
    }

    if (url.pathname === "/next" && request.method === "GET") {
      const now = Date.now();
      const entries = await this.state.storage.list({ prefix: "job:" });
      const jobs = [...entries.entries()]
        .map(([key, job]) => ({ key, job }))
        .filter(({ job }) => job.status === "pending" || (job.status === "processing" && now - job.startedAt > 3 * 60 * 1000))
        .sort((a, b) => a.job.createdAt - b.job.createdAt);
      if (!jobs.length) return new Response(null, { status: 204 });
      const { key, job } = jobs[0];
      job.status = "processing";
      job.startedAt = now;
      await this.state.storage.put(key, job);
      return Response.json({ id: job.id, query: job.query });
    }

    const getMatch = url.pathname.match(/^\/jobs\/([\w-]+)$/);
    if (getMatch && request.method === "GET") {
      const job = await this.state.storage.get(`job:${getMatch[1]}`);
      if (!job) return Response.json({ error: "검색 요청을 찾을 수 없습니다." }, { status: 404 });
      return Response.json({ id: job.id, status: job.status, result: job.result || null, error: job.error || null });
    }

    const completeMatch = url.pathname.match(/^\/complete\/([\w-]+)$/);
    if (completeMatch && request.method === "POST") {
      const key = `job:${completeMatch[1]}`;
      const job = await this.state.storage.get(key);
      if (!job) return Response.json({ error: "검색 요청을 찾을 수 없습니다." }, { status: 404 });
      const body = await request.json().catch(() => null);
      job.status = body?.error ? "error" : "complete";
      job.error = body?.error ? String(body.error).slice(0, 500) : null;
      job.result = body?.result || null;
      job.completedAt = Date.now();
      await this.state.storage.put(key, job);
      return Response.json({ id: job.id, status: job.status });
    }

    return Response.json({ error: "Not found" }, { status: 404 });
  }

  async alarm() {
    const now = Date.now();
    const entries = await this.state.storage.list({ prefix: "job:" });
    const rateEntries = await this.state.storage.list({ prefix: "rate:" });
    let nextExpiry = Infinity;
    for (const [key, job] of entries) {
      const expiresAt = job.createdAt + JOB_TTL_MS;
      if (expiresAt <= now) await this.state.storage.delete(key);
      else nextExpiry = Math.min(nextExpiry, expiresAt);
    }
    for (const [key, rate] of rateEntries) {
      if (rate.resetAt <= now) await this.state.storage.delete(key);
      else nextExpiry = Math.min(nextExpiry, rate.resetAt);
    }
    if (Number.isFinite(nextExpiry)) await this.state.storage.setAlarm(nextExpiry);
  }
}

