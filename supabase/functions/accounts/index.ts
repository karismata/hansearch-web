import { createClient } from 'npm:@supabase/supabase-js@2.112.4';

const origins = new Set(['https://hansearch-web.pages.dev', 'https://hansearch-web.karis830519.workers.dev', 'http://localhost:5173']);
function allowed(origin: string) {
  try { const u = new URL(origin); return origins.has(origin) || (u.protocol === 'https:' && (u.hostname.endsWith('.hansearch-web.pages.dev') || u.hostname.endsWith('-hansearch-web.karis830519.workers.dev'))); } catch { return false; }
}
function reply(req: Request, body: unknown, status = 200) {
  const headers: Record<string,string> = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store',
    'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Vary': 'Origin' };
  const origin = req.headers.get('Origin') || '';
  if (allowed(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return new Response(JSON.stringify(body), { status, headers });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return reply(req, {}, 200);
  if (req.method !== 'POST') return reply(req, { error: 'Method not allowed' }, 405);
  const origin = req.headers.get('Origin');
  if (origin && !allowed(origin)) return reply(req, { error: 'Origin not allowed' }, 403);
  if (Number(req.headers.get('Content-Length') || 0) > 8192) return reply(req, { error: '요청이 너무 큽니다.' }, 413);
  try {
    const raw = await req.text();
    if (raw.length > 8192) return reply(req, { error: '요청이 너무 큽니다.' }, 413);
    const body = JSON.parse(raw);
    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const publicKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    if (body.action === 'register') {
      const username = String(body.username || '').normalize('NFKC').trim().toLowerCase();
      const password = String(body.password || '');
      if (!/^[a-z0-9][a-z0-9_.-]{2,31}$/.test(username) || username === 'master') {
        return reply(req, { error: '아이디는 영문 소문자·숫자·._- 조합 3~32자이며 master는 사용할 수 없습니다.' }, 400);
      }
      if (password.length < 10 || password.length > 128) return reply(req, { error: '비밀번호는 10~128자로 입력해 주세요.' }, 400);
      const clientIp = req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') || 'unknown';
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(clientIp));
      const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2,'0')).join('');
      const limit = await admin.rpc('hansearch_signup_allowed', { p_client_hash: hash });
      if (limit.error) return reply(req, { error: '가입 서비스 설정을 확인해 주세요.' }, 503);
      if (!limit.data) return reply(req, { error: '가입 요청이 많습니다. 잠시 후 다시 시도해 주세요.' }, 429);
      const { error } = await admin.auth.admin.createUser({ email: `${username}@login.hansearch.invalid`, password, email_confirm: true });
      if (error) return reply(req, { error: '가입할 수 없는 아이디이거나 가입 처리에 실패했습니다.' }, 400);
      return reply(req, { ok: true, message: '가입 신청이 완료됐습니다. 마스터 승인 후 이용할 수 있습니다.' }, 201);
    }
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: identity, error: identityError } = await admin.auth.getUser(token);
    if (identityError || !identity.user) return reply(req, { error: '로그인이 필요합니다.' }, 401);
    const { data: profile } = await admin.from('member_profiles').select('id,role,status').eq('id', identity.user.id).single();
    if (profile?.role !== 'master' || profile?.status !== 'approved') return reply(req, { error: '마스터 권한이 필요합니다.' }, 403);
    const targetId = String(body.user_id || '');
    if (!/^[0-9a-f-]{36}$/i.test(targetId) || targetId === profile.id) return reply(req, { error: '대상 계정을 확인해 주세요.' }, 400);
    const { data: target } = await admin.from('member_profiles').select('role,status').eq('id', targetId).single();
    if (!target || target.role === 'master') return reply(req, { error: '일반 회원 계정만 관리할 수 있습니다.' }, 403);
    if (body.action === 'delete') {
      const caller = createClient(url, publicKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
      const prepared = await caller.rpc('hansearch_prepare_account_deletion', { p_id: targetId });
      if (prepared.error) return reply(req, { error: '계정 접근 차단에 실패했습니다.' }, 400);
      const { error } = await admin.auth.admin.deleteUser(targetId);
      if (error) return reply(req, { error: '계정 접근은 차단됐지만 인증 계정 정리가 완료되지 않았습니다. 삭제를 다시 실행해 주세요.' }, 503);
      return reply(req, { ok: true });
    }
    if (body.action === 'reset_password') {
      const password = String(body.password || '');
      if (target.status === 'deleted' || password.length < 10 || password.length > 128) return reply(req, { error: '계정 상태와 비밀번호 길이를 확인해 주세요.' }, 400);
      const { error } = await admin.auth.admin.updateUserById(targetId, { password });
      return error ? reply(req, { error: '비밀번호 변경에 실패했습니다.' }, 400) : reply(req, { ok: true });
    }
    return reply(req, { error: 'Unknown action' }, 400);
  } catch {
    return reply(req, { error: '계정 요청 처리에 실패했습니다.' }, 400);
  }
});
