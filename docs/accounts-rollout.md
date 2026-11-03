# 계정 기능 적용 순서

이 변경은 Supabase 설정과 함께 배포해야 합니다. 준비되지 않은 상태에서 웹 코드만 main에 병합하면 로그인 및 데이터 접근이 중단됩니다. 준비 PR은 실제 설정 검증 전까지 병합하지 않습니다.

## 대상 확인

- 운영 프로젝트: `trtpgahsnuddenmxuazq` (`https://trtpgahsnuddenmxuazq.supabase.co`). 다른 프로젝트에 적용하지 않습니다.
- 기존 `info`, Storage 버킷 `hansearch-images`, 기존 정책과 트리거를 먼저 확인합니다.
- 기존 회원 기능이 있는 프로젝트라면 별도 검토가 필요합니다. 이 구현은 `member_profiles`를 새로 사용하는 구성입니다.
- 브라우저에는 publishable/anon 키만 사용합니다. 서비스 역할 키는 Supabase Edge Function의 기본 서버 환경변수로만 사용합니다.

## 준비

1. DB 소유자 권한으로 `supabase/migrations/202611020001_accounts_prepare.sql`과 `20261103001003_hansearch_accounts_explicit_grants.sql`을 적용합니다. 이 단계는 기존 info 공개 정책을 변경하지 않습니다. 후자는 운영 프로젝트의 기본 함수 권한으로 붙는 익명 호출 권한을 명시적으로 회수합니다. 한주AI snapshot은 별도 연결키를 검증하므로 익명 API 키 호출을 유지합니다.
2. Supabase Auth의 일반 공개 signUp을 비활성화합니다. 가입 신청은 아래 Edge Function의 서버 Admin API로만 처리합니다. 기존 인증/다른 앱이 이 프로젝트를 공유한다면 먼저 영향을 확인해야 합니다.
3. `supabase/functions/accounts/index.ts`를 `accounts` Edge Function으로 배포합니다. `verify_jwt=false`를 사용합니다. 가입만 공개이며 나머지 동작은 함수 내부에서 실제 JWT와 마스터 프로필을 검증합니다.
4. 소유자가 Supabase Authentication의 사용자 생성 화면에서 `master@login.hansearch.invalid` 계정을 직접 생성합니다. 비밀번호는 소유자가 비공개로 입력하고 이메일은 확인 완료로 지정합니다. 웹 로그인 아이디는 `master`입니다. 기본/공유 비밀번호는 만들지 않습니다.
5. 생성한 Auth UUID를 `supabase/setup/bootstrap_master.sql`의 자리표시자에 넣어 소유자 권한으로 실행합니다. 회원 가입 메타데이터로는 마스터를 만들 수 없습니다.
6. 준비 브랜치의 미리보기에서 master 로그인, 일반 계정 가입 신청, master 승인, 일반 계정 이용, 마스터 권한 차단을 확인합니다.
7. master 관리 화면의 **한주AI 동기화 연결 설정**에 맥미니 `.env`의 기존 `AI_ACCESS_TOKEN`과 같은 값을 등록합니다. DB에는 SHA-256 해시만 남고 브라우저 저장소에는 저장하지 않습니다.
8. 맥미니의 `server.py`를 준비 브랜치 버전으로 갱신하고 `.env`에 `SUPABASE_ACCOUNT_MODE=1`을 추가한 뒤 재시작합니다. 동기화 성공 및 자료 수를 확인합니다. 기존 `AI_ACCESS_TOKEN`은 그대로 사용합니다.

## 전환

1. 웹·Worker PR을 main에 병합하고 두 대상의 배포를 확인합니다. Worker의 기존 `AI_ACCESS_TOKEN` Secret은 유지합니다. 신규 서버 비밀키를 Cloudflare에 추가할 필요는 없습니다.
2. `supabase/migrations/202611020002_accounts_activate.sql`을 적용합니다. 승인된 master와 AI 동기화 해시가 없으면 이 스크립트가 중단됩니다.
3. 로그아웃 상태 및 미승인 상태의 데이터/API 접근 차단, 계정별 AI 결과 접근 격리, master 승인/삭제, 생성자 표시, 통계 기록을 운영 환경에서 확인합니다.

## 권한·집계 기준

- 일반 회원은 승인 후 기존 자료 검색·생성·수정·삭제 기능을 사용합니다. 승인/계정 삭제/타인 비밀번호 초기화/전체 통계는 마스터만 가능합니다.
- 작성자와 신규 자료 생성 이벤트는 DB 트리거가 기록하며, 클라이언트가 다른 작성자를 보내도 덮어씁니다. 작성자는 자료 수정 시 변경되지 않습니다. 기존 자료에는 작성자 추정 없이 `기존 자료`가 표시됩니다.
- 일반 검색 버튼/Enter/빠른 검색어 선택은 일반 검색 1회, AI 검색 실행은 AI 검색 1회로 집계합니다. 실패한 AI 검색도 실행 횟수에 포함됩니다. 입력 중, 페이지 이동, AI 상태 폴링은 세지 않습니다. 저장된 정답 재사용도 AI 검색 1회입니다.
- 검색 이벤트 ID는 중복 저장되지 않습니다. 생성 통계는 삭제된 자료도 포함하는 누적 생성 횟수입니다. 계정 삭제 후에도 계정 UUID·아이디 및 통계 이력은 남습니다. 삭제된 아이디는 재사용하지 않습니다.
- 날짜 범위는 Asia/Seoul의 시작일 00:00부터 종료일 다음 날 00:00 미만입니다. 과거 검색량과 과거 작성자는 소급 복원하지 않습니다.
- 삭제는 먼저 프로필 접근을 차단하고 기존 이미지 소유권을 master에 이전한 뒤 Auth 계정을 삭제합니다. Auth 삭제가 실패하면 접근 차단 상태를 유지하고 관리 화면에서 삭제를 재시도합니다. 새로 발급되지 않은 유효 JWT도 DB/Worker의 최신 프로필 검사에서 차단됩니다.
- 기존 Storage 버킷의 공개 이미지 URL은 유지됩니다. 이 변경은 DB/API와 이미지 업로드 권한을 보호하며, 이미 공개된 이미지 URL 자체를 비공개로 바꾸지는 않습니다.

## 검증

운영 데이터에 시험 계정/검색/자료를 쓰지 않고 로컬 PostgreSQL 및 모의 HTTP로 검사합니다.

```sh
npm install --prefix ../outputs/account-tests --no-save --no-package-lock @electric-sql/pglite jsdom
PGLITE_MODULE="/absolute/path/to/pglite/dist/index.js" node tests/accounts-rls.mjs
node tests/worker-accounts.mjs
node tests/accounts-edge.mjs
JSDOM_MODULE="/absolute/path/to/jsdom" node tests/accounts-ui.cjs
python -m unittest discover -s tests -p 'test_sync_accounts.py'
npx tsc -b --pretty false
npx tsc -p tsconfig.edge.json --pretty false
npm run build
```

실제 프로젝트의 기존 RLS, Storage 구조, Auth 설정에 대한 검증은 별도로 필요합니다. 준비 마이그레이션이 로컬에서 통과했다는 사실만으로 운영 적용 완료로 간주하지 않습니다.

