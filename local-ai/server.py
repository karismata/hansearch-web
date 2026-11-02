"""Local HanSearch AI sync and semantic search service.

Runs on the Mac mini, reads the Supabase table, embeds text with Ollama, and
stores a reconciled local snapshot. It binds to localhost only by default.
"""

from __future__ import annotations

import hashlib
import json
import math
import os
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen


BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
STATE_FILE = DATA_DIR / "items.json"
DEFAULT_SUPABASE_URL = "https://trtpgahsnuddenmxuazq.supabase.co"
DEFAULT_SUPABASE_KEY = "sb_publishable_N_NBrRMNfUDwfCodR-nZ6g_KCFEZiw1"
SUPABASE_URL = os.getenv("SUPABASE_URL", DEFAULT_SUPABASE_URL).rstrip("/")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", DEFAULT_SUPABASE_KEY)
SUPABASE_TABLE = os.getenv("SUPABASE_TABLE", "info")
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434").rstrip("/")
CHAT_MODEL = os.getenv("CHAT_MODEL", "gemma4:e4b")
EMBED_MODEL = os.getenv("EMBED_MODEL", "qwen3-embedding:0.6b")
SYNC_INTERVAL = max(60, int(os.getenv("SYNC_INTERVAL_SECONDS", "300")))
HOST = os.getenv("HOST", "127.0.0.1")
PORT = int(os.getenv("PORT", "8765"))
RELAY_URL = os.getenv("RELAY_URL", "https://hansearch-web.karis830519.workers.dev").rstrip("/")
AI_ACCESS_TOKEN = os.getenv("AI_ACCESS_TOKEN", "")
PAGE_SIZE = 1000
EMBED_BATCH_SIZE = 24

_sync_lock = threading.Lock()
_last_sync: dict[str, Any] = {"status": "not_started", "count": 0}


def load_dotenv() -> None:
    """Load simple KEY=VALUE settings without requiring third-party packages."""
    path = BASE_DIR / ".env"
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


def request_json(url: str, *, method: str = "GET", headers: dict[str, str] | None = None,
                 payload: Any = None, timeout: int = 120) -> Any:
    body = None if payload is None else json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request_headers = {"Accept": "application/json", **(headers or {})}
    if body is not None:
        request_headers["Content-Type"] = "application/json"
    request = Request(url, data=body, headers=request_headers, method=method)
    try:
        with urlopen(request, timeout=timeout) as response:
            raw = response.read()
            return json.loads(raw.decode("utf-8")) if raw else None
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {exc.code}: {detail[:500]}") from exc
    except URLError as exc:
        raise RuntimeError(f"연결 실패: {exc.reason}") from exc


def fetch_all_items() -> list[dict[str, Any]]:
    """Read a complete paginated snapshot; caller only replaces state on success."""
    rows: list[dict[str, Any]] = []
    # Keep this to fields the existing app definitely reads/writes. The sync
    # uses snapshot reconciliation, so updated_at is not required in the schema.
    select = "id,키워드,키워드2,내용,이미지들"
    endpoint = f"{SUPABASE_URL}/rest/v1/{quote(SUPABASE_TABLE, safe='')}"
    offset = 0
    while True:
        query = urlencode({"select": select, "order": "id.asc"})
        page = request_json(
            f"{endpoint}?{query}",
            headers={
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
                "Range-Unit": "items",
                "Range": f"{offset}-{offset + PAGE_SIZE - 1}",
            },
        )
        if not isinstance(page, list):
            raise RuntimeError("Supabase 응답이 예상한 목록 형식이 아닙니다.")
        rows.extend(page)
        if len(page) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
    return rows


def text_for_item(item: dict[str, Any]) -> str:
    return "\n".join(
        str(item.get(field) or "").strip()
        for field in ("키워드", "키워드2", "내용")
        if str(item.get(field) or "").strip()
    )


def fingerprint(item: dict[str, Any]) -> str:
    return hashlib.sha256(text_for_item(item).encode("utf-8")).hexdigest()


def embed_texts(texts: list[str]) -> list[list[float]]:
    result = request_json(
        f"{OLLAMA_URL}/api/embed",
        method="POST",
        payload={"model": EMBED_MODEL, "input": texts},
        timeout=300,
    )
    vectors = result.get("embeddings") if isinstance(result, dict) else None
    if not isinstance(vectors, list) or len(vectors) != len(texts):
        raise RuntimeError("Ollama 임베딩 응답이 예상한 형식이 아닙니다.")
    return vectors


def read_state() -> dict[str, dict[str, Any]]:
    if not STATE_FILE.exists():
        return {}
    payload = json.loads(STATE_FILE.read_text(encoding="utf-8"))
    return {str(item["id"]): item for item in payload.get("items", [])}


def atomic_write_state(items: list[dict[str, Any]]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    temp_file = STATE_FILE.with_suffix(".tmp")
    temp_file.write_text(json.dumps({"items": items}, ensure_ascii=False), encoding="utf-8")
    temp_file.replace(STATE_FILE)


def sync_data() -> dict[str, Any]:
    global _last_sync
    if not _sync_lock.acquire(blocking=False):
        return {"status": "already_running"}
    started = time.time()
    try:
        source_items = fetch_all_items()
        old_items = read_state()
        prepared: list[dict[str, Any]] = []
        pending: list[tuple[dict[str, Any], str]] = []

        for source in source_items:
            item = dict(source)
            key = str(item.get("id"))
            digest = fingerprint(item)
            prior = old_items.get(key)
            if prior and prior.get("fingerprint") == digest and prior.get("embedding"):
                item["fingerprint"] = digest
                item["embedding"] = prior["embedding"]
                prepared.append(item)
            else:
                pending.append((item, digest))

        for start in range(0, len(pending), EMBED_BATCH_SIZE):
            batch = pending[start:start + EMBED_BATCH_SIZE]
            vectors = embed_texts([text_for_item(item) for item, _ in batch])
            for (item, digest), vector in zip(batch, vectors):
                item["fingerprint"] = digest
                item["embedding"] = vector
                prepared.append(item)

        # Replacing the snapshot only after all pages and embeddings succeed also
        # removes database rows that have been deleted from Supabase.
        atomic_write_state(prepared)
        result = {
            "status": "ok",
            "count": len(prepared),
            "added_or_updated": len(pending),
            "deleted": max(0, len(old_items) - len(set(str(x.get("id")) for x in source_items))),
            "elapsed_seconds": round(time.time() - started, 1),
            "completed_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        }
        _last_sync = result
        print(f"[sync] {result}", flush=True)
        return result
    except Exception as exc:
        _last_sync = {"status": "error", "message": str(exc), "count": len(read_state())}
        print(f"[sync] 실패: {exc}", flush=True)
        raise
    finally:
        _sync_lock.release()


def cosine_similarity(left: list[float], right: list[float]) -> float:
    dot = sum(a * b for a, b in zip(left, right))
    left_norm = math.sqrt(sum(a * a for a in left))
    right_norm = math.sqrt(sum(b * b for b in right))
    return dot / (left_norm * right_norm) if left_norm and right_norm else 0.0


def generate_summary(query: str, results: list[dict[str, Any]]) -> str:
    sources = [
        {"id": item.get("id"), "title": item.get("키워드2", ""), "category": item.get("키워드", ""),
         "content": str(item.get("내용") or "")[:1800]}
        for item in results[:5]
    ]
    response = request_json(
        f"{OLLAMA_URL}/api/chat",
        method="POST",
        payload={
            "model": CHAT_MODEL,
            "stream": False,
            "messages": [
                {"role": "system", "content": "너는 한서치 자료를 안내하는 도우미다. 제공된 자료에 근거해 한국어로 간결하게 답하라. 자료에 없는 사실은 추측하지 말고, 찾을 수 없으면 그렇게 말하라. 답변에 참조한 자료 ID를 [자료 ID: 숫자] 형식으로 표시하라."},
                {"role": "user", "content": f"질문: {query}\n\n관련 자료:\n{json.dumps(sources, ensure_ascii=False)}"},
            ],
            "options": {"temperature": 0.2},
        },
        timeout=300,
    )
    return str(response.get("message", {}).get("content", "")).strip()


def search(query: str, limit: int = 8) -> dict[str, Any]:
    normalized = query.strip()
    if not normalized:
        raise ValueError("검색어를 입력해 주세요.")
    items = list(read_state().values())
    if not items:
        return {"query": normalized, "summary": "동기화된 자료가 없습니다.", "results": []}
    query_vector = embed_texts([normalized])[0]
    ranked = sorted(
        ((cosine_similarity(query_vector, item.get("embedding", [])), item) for item in items),
        key=lambda pair: pair[0], reverse=True,
    )[:max(1, min(limit, 20))]
    results = []
    for score, item in ranked:
        results.append({key: value for key, value in item.items() if key not in ("embedding", "fingerprint")} | {"score": round(score, 4)})
    summary = generate_summary(normalized, results) if results else "관련 자료를 찾지 못했습니다."
    return {"query": normalized, "summary": summary, "results": results, "synced_count": len(items)}


class Handler(BaseHTTPRequestHandler):
    server_version = "HanSearchLocalAI/0.1"

    def _send(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        if self.path != "/health":
            self._send(404, {"error": "not_found"})
            return
        self._send(200, {"service": "hansearch-local-ai", "sync": _last_sync, "count": len(read_state())})

    def do_POST(self) -> None:
        if self.path not in ("/sync", "/search"):
            self._send(404, {"error": "not_found"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length).decode("utf-8")) if length else {}
            if self.path == "/sync":
                self._send(200, sync_data())
            else:
                self._send(200, search(str(payload.get("query", "")), int(payload.get("limit", 8))))
        except ValueError as exc:
            self._send(400, {"error": str(exc)})
        except Exception as exc:
            self._send(502, {"error": str(exc)})

    def log_message(self, fmt: str, *args: Any) -> None:
        print(f"[http] {self.address_string()} {fmt % args}", flush=True)


def sync_loop() -> None:
    while True:
        try:
            sync_data()
        except Exception:
            pass
        time.sleep(SYNC_INTERVAL)


def relay_loop() -> None:
    """Pull AI search jobs from Cloudflare; the Mac only makes outbound requests."""
    if len(AI_ACCESS_TOKEN) < 32:
        print("[relay] AI_ACCESS_TOKEN 설정 전이라 웹 검색 중계를 대기합니다.", flush=True)
        return

    endpoint = f"{RELAY_URL}/api/ai"
    headers = {"Authorization": f"Bearer {AI_ACCESS_TOKEN}"}
    while True:
        try:
            job = request_json(f"{endpoint}/agent/next", headers=headers, timeout=20)
            if not job or not job.get("id"):
                time.sleep(2)
                continue

            job_id = str(job["id"])
            print(f"[relay] AI 검색 요청 처리: {job_id}", flush=True)
            try:
                full_result = search(str(job.get("query", "")))
                compact_result = {
                    "query": full_result.get("query", ""),
                    "summary": full_result.get("summary", ""),
                    "results": [
                        {"id": item.get("id"), "score": item.get("score")}
                        for item in full_result.get("results", [])
                    ],
                    "synced_count": full_result.get("synced_count", 0),
                }
                request_json(
                    f"{endpoint}/agent/complete/{job_id}",
                    method="POST", headers=headers, payload={"result": compact_result},
                )
                print(f"[relay] 검색 완료: {job_id}", flush=True)
            except Exception as exc:
                request_json(
                    f"{endpoint}/agent/complete/{job_id}",
                    method="POST", headers=headers, payload={"error": str(exc)[:400]},
                )
                print(f"[relay] 검색 실패: {exc}", flush=True)
        except Exception as exc:
            print(f"[relay] 연결 오류: {exc}", flush=True)
            time.sleep(5)


def main() -> None:
    load_dotenv()
    # Load .env overrides after module constants were initialized.
    global SUPABASE_URL, SUPABASE_KEY, SUPABASE_TABLE, OLLAMA_URL, CHAT_MODEL, EMBED_MODEL, SYNC_INTERVAL, HOST, PORT, RELAY_URL, AI_ACCESS_TOKEN
    SUPABASE_URL = os.getenv("SUPABASE_URL", SUPABASE_URL).rstrip("/")
    SUPABASE_KEY = os.getenv("SUPABASE_KEY", SUPABASE_KEY)
    SUPABASE_TABLE = os.getenv("SUPABASE_TABLE", SUPABASE_TABLE)
    OLLAMA_URL = os.getenv("OLLAMA_URL", OLLAMA_URL).rstrip("/")
    CHAT_MODEL = os.getenv("CHAT_MODEL", CHAT_MODEL)
    EMBED_MODEL = os.getenv("EMBED_MODEL", EMBED_MODEL)
    SYNC_INTERVAL = max(60, int(os.getenv("SYNC_INTERVAL_SECONDS", str(SYNC_INTERVAL))))
    HOST = os.getenv("HOST", HOST)
    PORT = int(os.getenv("PORT", str(PORT)))
    RELAY_URL = os.getenv("RELAY_URL", RELAY_URL).rstrip("/")
    AI_ACCESS_TOKEN = os.getenv("AI_ACCESS_TOKEN", AI_ACCESS_TOKEN)

    server = ThreadingHTTPServer((HOST, PORT), Handler)
    threading.Thread(target=sync_loop, daemon=True, name="supabase-sync").start()
    threading.Thread(target=relay_loop, daemon=True, name="cloudflare-ai-relay").start()
    print(f"HanSearch AI service: http://{HOST}:{PORT}", flush=True)
    print(f"Supabase table: {SUPABASE_TABLE}; sync interval: {SYNC_INTERVAL}s", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
