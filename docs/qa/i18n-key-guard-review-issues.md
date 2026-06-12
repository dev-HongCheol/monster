# 코드 리뷰 이슈: i18n 키 정합 가드 (i18n-key-guard)

> - **브랜치:** feat/i18n-key-guard
> - **리뷰 커밋:** `422a118..f5c3ab5` (general-purpose subagent, code-reviewer 템플릿)
> - **요약:** Critical 0건, Important 1건과 Minor 2건을 전부 수정했다. 가드가 순수·테스트 전용이고 실제 카탈로그 게이트가 회귀를 잡는다는 점은 검증했다.

---

## Important

### I1. 소스 스캔 정규식이 어휘 수준에서 무방비 — 영구 게이트의 신뢰를 떨어뜨림 — **수정됨**

`tests/logic/I18nKeyGuard.test.ts`의 스캔에 가짜 양성(false positive)을 만드는 경로가 두 가지 있었다.

1. **넓은 `t(` 매칭:** `/t\(['"]([^'"]+)/g`는 `t`로 끝나는 모든 식별자(`emit('x')`·`assert('x')`·`getComponent('cc.Label')`)의 문자열 인자까지 키로 잡는다. 현재 코드엔 그런 호출이 없어 게이트가 GREEN이지만, 향후 `node.emit('foo')` 한 줄이 들어오면 i18n과 무관한 `missing: foo`로 RED가 난다.
2. **주석 미제거:** 스캔 대상 소스의 주석/JSDoc에 `t('x')`·`descKey: 'x'`를 쓰면 가짜 사용 리터럴이 된다(구현 중 실제로 한 번 겪어 JSDoc을 고쳤다). ko에 없으면 가짜 missing으로 RED가 나고, ko에 있으나 실제로는 죽은 키라면 orphan을 **가린다**(가짜 음성).

**수정:** (1) 호출 정규식을 영숫자 경계로 앵커했다 — `/(?<![A-Za-z0-9])_?t\(['"]([^'"]+)/g`(번역 함수와 `_t` 래퍼는 잡고 `emit`/`assert`/`getComponent`는 배제). (2) 스캔 전에 `stripComments`로 블록·라인 주석을 제거한다(`://` URL은 보존). (3) 스캔 추출부를 순수 함수 `extractLiteralsFromSource`로 분리하고, 견고성을 잠그는 단위 테스트를 4건 추가했다(래퍼 캡처·식별자 배제·주석 배제·template literal 배제). 실제 카탈로그 게이트 결과는 그대로(0건)이고 전체 스위트도 GREEN을 유지한다.

---

## Minor

### M2. `extractMessage`가 `I18nLogic`의 빈 문자열 규칙과 어긋남 — **수정됨**

`logic/I18nKeyGuard.ts`의 `extractMessage`는 빈 문자열을 `''`로 반환했으나, `I18nLogic._extract`는 `'' → undefined`(미번역 미스)로 처리한다. 실무상 무해하지만 계획이 "추출 규칙을 `I18nLogic`과 동일하게"라고 명시했고, 빈 ko 소스가 가짜 paramMismatch를 만들 여지가 있다. **수정:** `'' → undefined`로 런타임 규칙과 일치시키고 이유(WHY) 주석을 추가했다.

### M3. 동적 키 패밀리·씬 접두사는 눈에 안 띄는 유지보수 지점 — **수정됨(주석)**

`buildFamilyKeys`는 4개 패밀리를, 테스트는 `sceneKeyPrefixes`를 하드코딩한다. 5번째 패밀리나 새 씬 접두사를 도입할 때 가드를 함께 갱신해야 하는데, 바람직하지만 모르면 헤매기 쉽다. 또 `card.<id>`는 정적 카드가 name·desc 키를 둘 다 갖는다는 전제다(이름만 있는 카드가 생기면 desc가 missing으로 잡힌다). **수정:** `buildFamilyKeys` JSDoc에 '새 패밀리 도입 시 여기 갱신'과 'name·desc 둘 다 전제' 주석을 명시했다.

---

## 게임 정책·설계 지적

없음. 리뷰어 평결은 **With fixes**였다 — Important I1만 머지 전 처리 권고였고 모두 반영했다.
