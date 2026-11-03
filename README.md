# React + TypeScript + Vite

## 승인형 회원 계정 기능

로그인·회원 승인·계정 관리·작성자 표시·계정별 통계 기능의 운영 적용 순서는 [docs/accounts-rollout.md](docs/accounts-rollout.md)를 확인하세요. Supabase 준비와 최초 master 계정 설정을 완료하기 전에는 계정 기능 PR을 운영 main에 병합하지 않습니다.

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

## HanSearch Android 앱 다운로드

웹사이트 상단의 **앱 다운로드** 버튼은 `/downloads/HanSearch.apk`에서 최신 APK를 내려받습니다. Android 네이티브 코드가 `main`에 반영되면 GitHub Actions가 APK를 자동으로 빌드하고 이 파일을 갱신합니다. APK는 현재 배포 사이트를 여는 WebView 앱이므로 인터넷 연결이 필요합니다.

## 한주AI 수정 답변 저장

AI 답변 아래의 **답변 수정·저장**에서 검색어와 올바른 답변을 저장할 수 있습니다. 기존 `info` 테이블의 `AI 검증답변` 카테고리에 일반 자료로 저장되므로, 한서치 검색 화면에서 수정하거나 삭제할 수 있습니다.

같은 검색어의 AI 검색은 저장된 수정 답변을 우선 반환합니다. 영문 대소문자, 앞뒤 공백, 연속 공백 차이는 무시하며, 의미가 달라질 수 있는 문장부호는 유지합니다. 검색할 때 데이터베이스를 다시 확인하므로 다른 브라우저에서 저장한 답변도 재사용합니다. 같은 검색어를 다시 저장하면 기존 답변을 갱신합니다.

유사한 표현의 질문은 일반 AI 검색을 거칩니다. 수정 답변도 기존 자료와 함께 다음 맥미니 동기화 이후 검색 자료에 반영됩니다. 데이터베이스 스키마 변경이나 브라우저별 연결 키 설정은 필요하지 않습니다.
