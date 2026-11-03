# 계정 기능 운영 준비 상태

2026-11-03 KST, BBCS / HanSearch (`trtpgahsnuddenmxuazq`)에서 확인했습니다.

- 운영 `info` 자료 605건, 기존 자료 작성자 `기존 자료` 605건을 확인했습니다. 기존 검색 접근 권한은 아직 전환하지 않았습니다.
- 준비 SQL 적용: 원본 `202611020001_accounts_prepare.sql`, 운영 이력 `20261103000609_hansearch_accounts_prepare`.
- 명시적 함수 권한 보완 적용: 원본 `20261103001003_hansearch_accounts_explicit_grants.sql`, 운영 이력 `20261103001047_hansearch_accounts_explicit_grants`.
- `accounts` Edge Function v2 배포 완료. 함수 내부에서 관리 요청의 JWT와 최신 승인 마스터 프로필을 검사합니다. 한서치 가입은 서버 전용 app_metadata 표시를 요구하는 DB 트리거로 제한하며, 공유 프로젝트의 전체 Auth 가입 설정은 변경하지 않습니다.
- 실제 HTTP 검사 통과: 허용 Origin OPTIONS 200, 비로그인 관리 요청 401, 예약된 master 일반 가입 400, 다른 Origin 403. 시험 계정은 생성하지 않았습니다.
- 운영 기본 ACL에 따른 익명 관리 RPC 실행 권한을 회수했고, 실제 `has_function_privilege` 조회로 확인했습니다. AI snapshot만 별도 연결키를 검증하는 공개 호출 경로로 유지합니다.
- 소유자가 `master@login.hansearch.invalid` 계정을 직접 생성했고, 정확한 Auth ID와 이메일 확인 상태를 검사한 뒤 `master / approved` 권한을 부여했습니다. 서버에서 로그인 성공 기록도 확인했습니다.

계정 확인/데이터 로딩 반복 문제를 수정했습니다. App 초기화 중 연결 설정을 다시 저장하거나 동일 설정 저장으로 Auth 클라이언트를 폐기하지 않으며, 같은 사용자의 인증 알림/토큰 갱신 중 화면을 유지합니다. 새 계정 전환 시 이전 화면을 즉시 숨기고, 최신 승인 확인 실패/삭제 응답은 여전히 접근을 차단합니다. 실제 App을 포함하는 DOM 회귀 검사와 기존 접근 차단 검사, 타입 검사 및 빌드를 통과했습니다.

소유자가 수정 미리보기에서 로그인 성공을 확인했고, 동기화 키 해시 등록과 Mac의 계정 모드 업데이트도 완료했습니다. 2026-11-03 09:45:10 KST의 동기화 로그는 status=ok, count=605, added_or_updated=0, deleted=0입니다. 운영 전환 사전조건이 충족되어 웹/Worker 병합과 활성화 SQL을 진행합니다. 실제 배포 후에는 `tests/verify-production-accounts.mjs`와 운영 RLS/자료 수를 별도로 확인합니다.

프로젝트에는 기존 Auth 사용자 3명과 다른 테이블도 있으므로 공개 signUp 설정을 전역 변경하지 않습니다. `info` 접근 제한은 계정 기능 전환 단계에 포함되며, 다른 테이블의 정책은 이 전환에서 변경하지 않습니다. 공개 이미지 URL도 유지됩니다. 익명 사용자의 다른 버킷 접근이 공유 Storage 정책 때문에 차단되지 않는 회귀 검사도 통과했습니다.

MCP가 운영 마이그레이션 버전을 생성하므로 저장소 파일명과 운영 이력 버전은 다릅니다. 이 프로젝트에 저장소 전체를 자동 `db push`하지 말고 적용 이력과 `accounts-rollout.md` 순서를 확인하세요.

