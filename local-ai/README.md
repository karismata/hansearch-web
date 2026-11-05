# HanSearch Local AI (Mac mini)

월별 상담 엑셀을 미검증 참고로 활용하려면 [상담 이력 폴더·동기화 안내](../docs/consultation-references.md)를 확인하세요. 기본 위치는 `~/Documents/Hansearch AI/상담이력/YYYY/YYYY-MM.xlsx`입니다.

인터넷 보완 검색 및 기존 설치 업데이트: [내부 우선 AI 검색·댓글 안내](../docs/ai-web-and-comments.md). 검색은 Tavily 무료 플랜을 사용하며 기존 `.env`에 `TAVILY_API_KEY`를 추가합니다. 로컬 답변 생성은 계속 Ollama를 사용합니다. 기존 설정 파일을 예제로 덮어쓰지 않습니다.

This service is the Mac mini side of HanSearch AI search. It reads the existing
Supabase `info` table, creates local Ollama embeddings, and periodically replaces
its local snapshot only after a complete successful sync. Deleted Supabase rows
therefore disappear from the next successful snapshot. Image URLs are kept as
references; image files are not downloaded.

## Current stage

The local status/search server binds to `127.0.0.1` only. Website requests are
relayed through the HanSearch Cloudflare Worker; the Mac makes outbound HTTPS
requests and no home-router port is exposed. Query and compact search results
are held briefly in the Cloudflare Durable Object queue and expire after ten
minutes. Internal retrieval and final answer generation run on the Mac mini;
optional external web searches use Tavily Search with the Mac's private key.

## Run on the Mac mini

로그인 기능 전환 시에는 master 화면에서 기존 `AI_ACCESS_TOKEN`을 동기화 연결키로 등록한 후 `.env`에 `SUPABASE_ACCOUNT_MODE=1`을 설정해야 합니다. 이 모드에서는 공개 테이블 조회 대신 읽기 전용 인증 RPC로 동기화합니다. 웹 계정 비밀번호나 Supabase 서비스 역할 키를 맥미니에 추가할 필요는 없습니다. 전환 전에는 기본값 `0`을 유지합니다.

1. Install Python 3 if needed (`python3 --version`). No Python packages are required.
2. Copy `.env.example` to `.env` in this directory. Check the Supabase URL/key/table
   against HanSearch's Settings screen if you changed them there.
3. Set `AI_ACCESS_TOKEN` to the same random key configured as the Cloudflare Worker
   secret. Keep it on the Mac mini and in the Worker secret; it is no longer entered
   in HanSearch or stored in browser storage. Use a random key of at least 32
   characters; never commit `.env`.
4. In Terminal, from this directory, run `python3 server.py`.
5. Open `http://127.0.0.1:8765/health` on the Mac mini. Initial sync starts
   automatically; later syncs run every five minutes.
6. A successful sync reports a count in Terminal and `/health`. The local snapshot
   is stored in `data/items.json` (ignored by Git).

To request an immediate sync from another Terminal window:

```sh
curl -X POST http://127.0.0.1:8765/sync
```

To try a local semantic search:

```sh
curl -X POST http://127.0.0.1:8765/search \
  -H 'Content-Type: application/json' \
  -d '{"query":"단말기 인증이 실패해요"}'
```

The sync uses Supabase's public read key and requires the table's existing RLS
policy to allow reading. It does not write to Supabase. If a full read or embedding
operation fails, the prior local snapshot is retained. A later successful sync
reconciles additions, edits, and deletions. The Worker relay is available only
after its AIQueue Durable Object migration is deployed and the `AI_ACCESS_TOKEN`
Worker secret is configured.
