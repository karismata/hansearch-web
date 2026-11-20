#!/bin/bash
set -eu
cd "$(dirname "$0")"
if [ ! -f .env ] || [ ! -f server.py ]; then
  echo "기존 .env와 server.py가 있는 local-ai 폴더에서 실행해 주세요."
  exit 1
fi
hansearch_managed=0
hansearch_temp=".server-update-$$.py"
hansearch_cleanup() {
  rm -f "$hansearch_temp"
  if [ "$hansearch_managed" = 1 ]; then
    echo "업데이트가 완료되지 않아 기존 자동 실행 서버를 다시 시작합니다."
    python3 manage-service.py restart || true
  fi
}
trap hansearch_cleanup EXIT
if [ -f "$HOME/Library/LaunchAgents/com.hansearch.local-ai.plist" ] && [ -f manage-service.py ]; then
  python3 manage-service.py stop
  hansearch_managed=1
fi
if command -v lsof >/dev/null 2>&1 && lsof -tiTCP:8765 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "기존 서버 창에서 Control+C로 서버를 종료한 뒤 다시 실행해 주세요."
  exit 1
fi
curl --fail --location --silent --show-error \
  "https://raw.githubusercontent.com/karismata/hansearch-web/${HANSEARCH_UPDATE_REF:-main}/local-ai/server.py" \
  --output "$hansearch_temp"
python3 -m py_compile "$hansearch_temp"
echo "실제 로컬 모델이 짧은 답변을 만들 수 있는지 먼저 확인합니다."
python3 "$hansearch_temp" --check-answer
echo "기존 Tavily 키로 검색 연결을 한 번 확인합니다."
python3 "$hansearch_temp" --check-web-search
cp server.py server.py.web-backup
mv "$hansearch_temp" server.py
echo "업데이트 완료. 기존 설정과 검색키로 한주AI를 시작합니다."
if [ "$hansearch_managed" = 1 ]; then
  python3 manage-service.py install
  hansearch_managed=0
  exit 0
fi
exec python3 server.py
