# implementation — 구현

스크립트 편집이 열려 있는 두 phase 중 하나다. RED로 세워 둔 테스트를 GREEN으로 만들고, 그 다음에 정리한다.

## 코드를 쓰기 전에

`docs/development/spec/code-conventions.md`를 읽는다. 파일·클래스 명명, 컴포넌트 구조 순서, 주석 기준, null 처리, 싱글톤 소비 규칙이 거기 있고 코드 리뷰도 그 문서를 기준으로 본다.

Cocos 관련 코드는 Context7로 공식 문서를 먼저 조회한 뒤 쓴다. 훈련 데이터 기반으로 추측하지 않는다.

## GREEN → REFACTOR

테스트를 통과시키는 가장 단순한 코드를 먼저 쓰고, 초록불이 켜진 뒤에 중복 제거·이름 정리·헬퍼 추출을 한다. 리팩터링 중에는 동작을 더하지 않는다.

## 슬라이스 밖 항목이 보이면

구현·테스트 중에 떠오른 후속·이월·밸런싱·로버스트니스 항목은 **여기서 고치지 않고 백로그로 보낸다.** 플레이어에게 전달되는 것(콘텐츠·밸런스·게임필·UI/UX·메타)은 `docs/development/backlog.md`, 코드가 굴러가는 방식(아키텍처·리팩터·타입·툴체인·성능)은 `docs/development/backlog-implement.md`다. 요약은 한두 문장으로 짧게 쓰고 상세는 출처 링크에 맡긴다.

## 신규 자산의 `.meta`

새로 만든 `.ts`·`.json`의 `.meta`를 만들지 않는다(원칙과 근거는 `CLAUDE.md`의 「에셋 `.meta` 관리 규칙」). 테스트와 빌드는 `.meta` 없이도 돈다 — vitest와 tsc는 경로로 import한다.

## 나가는 게이트: `start-verification`

`pnpm wf start-verification`이 전체 스위트를 돌려 **전부 통과할 때만** 검증으로 넘어간다. 실패가 있으면 차단되고 이 phase에 머문다. 따로 `pnpm test`를 돌릴 필요는 없다.
