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

재부팅 후 터미널에서 수동으로 시작하던 서버는 종료됩니다. 사용자 로그인 시 자동 실행하려면 기존 `local-ai` 폴더에서 `python3 manage-service.py install`을 한 번 실행하세요. 기존 수동 서버가 열려 있다면 먼저 그 창에서 Control+C로 종료합니다. sudo는 사용하지 않습니다.

자동 실행은 macOS 사용자 LaunchAgent로 등록합니다. 로그인 전이나 로그아웃 상태에서는 실행되지 않으며, 자동 로그인·화면 잠금·전원 설정은 변경하지 않습니다. Ollama가 이미 실행 중이면 그대로 사용하고, 기본 로컬 주소(11434)를 사용하면 다음 로그인 때 로컬 Ollama도 시작하도록 등록합니다. 별도 모델 다운로드나 외부 포트 공개는 하지 않습니다.

실행 파일·설정은 `~/Library/Application Support/HanSearch AI`로 복사해 Documents 폴더의 백그라운드 접근 제한을 피합니다. 원본 프로젝트는 유지하고, `.env`의 키와 `CONSULTATION_DIR`을 수정하지 않고 복사합니다. 기존 자동 실행 스냅샷은 재설치 시 덮어쓰지 않습니다. 원본 `.env`나 서버 파일을 수정했으면 `install`을 다시 실행해 실행용 복사본을 갱신하세요. macOS가 상담 원본 폴더의 읽기를 거부하면 별도로 그 폴더의 접근 권한을 확인해야 합니다.

```bash
python3 manage-service.py status   # 서버·Ollama 응답과 자료 수
python3 manage-service.py stop     # 서버만 중지, 다음 로그인 때는 다시 실행
python3 manage-service.py restart  # 설치된 실행용 복사본을 재시작
```

로그는 `~/Library/Logs/HanSearch AI`에 남습니다. 터미널을 닫아도 서버는 유지되며, 프로세스 종료 시 launchd가 다시 시작합니다. 자동 실행 설치 후에는 최신 `update-local-ai.command`를 사용하세요. 관리 중인 서버를 중지하고 검증된 새 파일을 실행용 위치에 복사·재시작하며, 업데이트 검사가 실패하면 기존 실행용 서버를 다시 시작합니다.

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
