#!/bin/bash
set -eu
cd "$(dirname "$0")"
if [ ! -f .env ]; then
  echo "이 파일을 기존 한주AI local-ai 폴더에 넣고 실행해 주세요. 기존 .env가 필요합니다."
  exit 1
fi
if command -v lsof >/dev/null 2>&1 && lsof -tiTCP:8765 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "기존 서버 창에서 Control+C로 서버를 종료한 뒤 다시 실행해 주세요."
  exit 1
fi
echo "Tavily 무료 계정에서 API 키를 발급합니다: https://app.tavily.com/"
echo "무료 플랜을 선택하세요. 유료 전환이나 카드 등록은 이 스크립트가 수행하지 않습니다."
echo "기존 AI_ACCESS_TOKEN은 변경하지 않습니다."
read -r -s -p "Tavily API 키를 붙여넣고 Enter (화면에는 표시되지 않음): " hansearch_search_key
echo
if [ -z "$hansearch_search_key" ]; then echo "검색키가 비어 있습니다."; exit 1; fi
hansearch_temp=".server-update-$$.py"
trap 'rm -f "$hansearch_temp"' EXIT
curl --fail --location --silent --show-error \
  "https://raw.githubusercontent.com/karismata/hansearch-web/${HANSEARCH_UPDATE_REF:-main}/local-ai/server.py" \
  --output "$hansearch_temp"
python3 -m py_compile "$hansearch_temp"
HANSEARCH_SEARCH_KEY="$hansearch_search_key" python3 - <<'PY'
import os
from pathlib import Path
key = os.environ['HANSEARCH_SEARCH_KEY'].strip()
if not key or not key.isascii() or key.startswith('TAVILY_API_KEY=') or any(ch.isspace() for ch in key) or any(ch in key for ch in "\"'"):
    raise SystemExit('키에 공백이나 따옴표가 있습니다. 키 값만 붙여넣어 주세요.')
path = Path('.env')
lines = path.read_text(encoding='utf-8').splitlines()
lines = [line for line in lines if line.split('=', 1)[0].strip() != 'TAVILY_API_KEY']
path.with_name('.env.web-backup').write_bytes(path.read_bytes())
path.with_name('.env.web-backup').chmod(0o600)
path.write_text('\n'.join(lines + ['TAVILY_API_KEY=' + key]) + '\n', encoding='utf-8')
path.chmod(0o600)
print('검색키 저장 완료 (기존 설정 유지)')
PY
export TAVILY_API_KEY="$hansearch_search_key"
unset hansearch_search_key
echo "Tavily 검색 연결을 한 번 확인합니다 (기본 검색 1회)."
python3 "$hansearch_temp" --check-web-search
if [ -f server.py ]; then cp server.py server.py.web-backup; fi
mv "$hansearch_temp" server.py
echo "한주AI를 시작합니다. 이 터미널을 열어 두세요."
exec python3 server.py
