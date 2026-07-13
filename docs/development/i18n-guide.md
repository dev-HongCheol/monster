# 다국어(i18n) 시스템 기술 가이드 (Deep Dive)

이 문서는 프로젝트 내 다국어 처리가 Cocos Creator의 라이프사이클과 어떻게 정밀하게 결합되어 작동하는지 상세히 설명합니다.

---

## 1. 초기화 프로세스 (Systems/Managers)

시스템의 기점인 `I18n.ts`는 싱글톤 매니저로서 데이터 로드와 배포를 총괄합니다.

| 라이프사이클 | 동작 내용 | 비고 |
| :--- | :--- | :--- |
| **`onLoad()`** | `I18n.instance` 할당. 정적 접근성 확보. | 최우선 실행 |
| **`start()`** | `resources.load`를 통한 JSON 파일 비동기 로드 개시. | 비동기 시작 |
| **Callback** | 로드 완료 후 `I18nLogic`에 데이터 주입 및 `_isReady` 플래그 활성화. | 데이터 준비 완료 |

---

## 2. UI 컴포넌트 라이프사이클 연동 (`LocalizedLabel.ts`)

씬의 각 라벨은 자신의 상태에 따라 매니저와 통신하며 텍스트를 유지합니다.

### 2.1. 라이프사이클 상세
1. **`onLoad()`**
   - 현재 노드에서 `cc.Label` 컴포넌트를 미리 캐싱하여 `update` 시점의 성능을 확보합니다.
2. **`onEnable()` (핵심)**
   - **Registry 등록:** `I18n.instance.register(this)` 호출.
   - **상태 체크:** 매니저가 준비(`_isReady`) 상태면 즉시 번역, 아니면 `onReady` 콜백 큐에 예약.
3. **`onDisable()`**
   - **Registry 해제:** `I18n.instance.unregister(this)` 호출.
   - 화면에서 사라진 노드는 갱신 대상에서 제외하여 불필요한 연산 및 에러를 방지합니다.
4. **`onDestroy()`**
   - 메모리 누수 방지를 위한 최종 참조 해제.

---

## 3. 런타임 언어 전환 (Runtime Language Switch)

게임을 재시작하지 않고 언어를 변경할 때의 내부 시퀀스입니다.

1. **API 호출:** 사용자가 `I18n.instance.setLanguage('en')`을 호출합니다.
2. **사전 교체:** 매니저 내부의 `I18nLogic` 사전을 영어 데이터로 교체합니다.
3. **옵저버 패턴 실행:** 매니저가 `onEnable` 상태로 등록된 모든 `LocalizedLabel` 목록을 순회합니다.
4. **동적 갱신:** 각 라벨의 `refresh()`를 호출하여 새로운 언어로 `label.string`을 즉시 업데이트합니다.

---

## 4. 아키텍처 원칙: Logic과 UI의 철저한 분리

- **Pure Logic (`logic/I18nLogic.ts`):** 
  - Cocos 엔진(`cc`) 임포트 금지. 
  - 오직 문자열 매칭, `{param}` 치환, 폴백(ko -> key) 로직만 담당.
  - Vitest를 통한 고속 단위 테스트 지원.
- **Cocos Wrapper (`systems/I18n.ts`):** 
  - 리소스 로드, 싱글톤 관리, UI 컴포넌트 목록(Registry) 관리 담당.

---

## 5. 레이스 컨디션 (Race Condition) 방어

- **상황:** 씬 로딩은 끝났으나 네트워크/파일 로딩 지연으로 번역 파일이 아직 도착하지 않은 경우.
- **대응:** `LocalizedLabel`은 즉시 실행 대신 `I18n.onReady` 콜백을 등록합니다. 매니저는 파일 로드가 끝나는 즉시 대기 중인 모든 라벨의 번역을 일괄 수행합니다.

---

## 6. 요약 다이어그램

```mermaid
sequenceDiagram
    participant JSON as ko.json/en.json
    participant Mgr as I18n Manager
    participant Logic as I18n Logic
    participant UI as LocalizedLabel (Cocos Node)

    Note over Mgr, JSON: [게임 시작 시]
    Mgr->>JSON: resources.load (비동기)
    JSON-->>Mgr: 로드 완료 콜백
    Mgr->>Logic: 사전 데이터 설정 및 _isReady=true

    Note over UI, Mgr: [라벨 노드가 켜질 때 (onEnable)]
    UI->>Mgr: 명부 등록 (Registry)
    alt 데이터가 이미 준비된 경우
        Mgr->>Logic: 즉시 t(key) 요청
    else 데이터 로딩 중인 경우
        Mgr->>UI: onReady 콜백 큐에 추가
    end
    Logic-->>UI: 번역된 문자열 반환
    UI->>UI: 화면 Label.string 갱신

    Note over Mgr: [언어 변경 시 (setLanguage)]
    Mgr->>Logic: 활성 사전 교체
    Mgr->>UI: 명부 내 모든 UI에 refresh() 실행 명령
    UI->>UI: 화면 즉시 변경
```

---

## 7. 키 정합 가드 (CI)

§1~§6은 카탈로그가 **이미 정합인 상태**에서 번역이 어떻게 흐르는지를 다룬다. 하지만 카탈로그(`ko.json`/`en.json`)와 그 키를 실제로 쓰는 코드·데이터는 서로 다른 파일이라 시간이 지나며 어긋난다 — AI가 여러 세션에 걸쳐 마법·카드를 추가하며 키를 깜빡하거나, ko만 고치고 사용처를 놓치면 화면에 `menu.ply` 같은 **생키 문자열**이 그대로 노출된다. 이를 사람이 매번 눈으로 잡을 수는 없으므로, vitest 영구 게이트로 **CI에서 자동 차단**한다. 순수 로직은 `tests/helpers/I18nKeyGuard.ts`의 `findCatalogIssues`이고, 파일을 읽고 소스를 스캔하는 부분은 `tests/logic/I18nKeyGuard.test.ts`가 맡는다. (이 가드는 게임 런타임에서 한 줄도 돌지 않는 테스트 전용 헬퍼라, `feat/ts-toolchain`에서 `game/assets/scripts/logic/`을 떠나 `tests/helpers/`로 옮겼다.)

### 7.1. 잡는 이슈 4종

`findCatalogIssues`는 "코드·데이터가 기대하는 키 집합(expected)"과 "카탈로그에 실제로 있는 키"를 비교해 다음 네 가지를 산출한다. 이슈가 0건이면 정합이고, 한 건이라도 나오면 테스트가 실패(RED)한다.

| 종류 | 정의 | 증상 |
|------|------|------|
| **missing** | expected에 있으나 ko에 없음 | 플레이어에게 생키 노출 (최우선) |
| **orphan** | ko에 있으나 expected에 없음 | 죽은 키 / 오타 (씬 접두사는 제외) |
| **enOrphan** | en에만 있고 ko에 없음 | en 오타 (ko 폴백도 못 함) |
| **paramMismatch** | 공통 키에서 en이 ko에 없는 `{token}`을 씀 | 치환 누락 |

`paramMismatch`의 메시지·토큰 추출은 런타임 `I18nLogic`과 **같은 규칙**을 쓴다 — 엔트리가 객체면 `.message`, 문자열이면 그대로, 빈 문자열은 미번역으로 보고 미스 처리한다. 토큰 정규식도 `/\{(\w+)\}/g`로 동일하다. 가드가 런타임과 다른 규칙을 쓰면 게이트가 통과해도 실제로는 깨질 수 있어 일부러 맞췄다.

### 7.2. expected는 어디서 오나 — 정적 리터럴 + 동적 패밀리

가드가 "코드·데이터가 기대하는 키"를 알아야 하는데, 출처가 두 가지다.

- **정적 리터럴 키** — `.ts` 소스에 문자열 그대로 박힌 키. 테스트가 `game/assets/scripts/**/*.ts`를 스캔해 번역 함수 호출 인자(`t('hud.hp')`)와 `nameKey`/`descKey` 속성의 리터럴을 모은다. 이렇게 모은 값이 `usedLiterals`로 들어간다.
- **동적 패밀리 키** — 데이터에서 template literal로 조립되는 키. `buildFamilyKeys`가 도메인(데이터·enum)으로부터 전체를 만든다: `spell.<id>.name`(spells.json), `card.<id>.{name,desc}`(cards.json), `category.<cat>`(`SpellCategory`), `upgrade.<opt>`(`SLICE_OPTIONS`).

> **새 동적 패밀리를 도입하면** `buildFamilyKeys`에 도메인 한 줄을 추가해야 가드가 정합을 본다(예: 적 이름 키). `card.<id>`는 카드가 name·desc 키를 **둘 다** 갖는다는 전제라, 이름만 있는 카드가 생기면 desc가 missing으로 잡힌다.

### 7.3. 오탐을 막는 두 가지 장치

소스 스캔과 도메인 한정이 없으면 게이트가 i18n과 무관한 것까지 잡아 신뢰를 잃는다. 그래서 두 가지를 둔다.

- **씬 라벨 접두사 허용 목록** — `menu.`·`result.`·`gameover.` 키는 `.scene`에 박혀 있고 `.ts`에는 없다. 그대로 두면 orphan으로 오탐되므로 `sceneKeyPrefixes`로 시작하는 키는 orphan 검사에서 제외한다.
- **소스 스캔의 어휘 견고화** — 호출 정규식을 영숫자 경계로 앵커해(`/(?<![A-Za-z0-9])_?t\(['"]([^'"]+)/g`) 번역 함수와 `_t` 래퍼만 잡고 `emit`/`assert`/`getComponent` 같은 `t`로 끝나는 식별자는 배제한다. 또 스캔 전에 주석·JSDoc을 제거해(`stripComments`) 주석 속 `t('x')`가 가짜 사용 리터럴이 되는 것을 막는다. (`SLICE_OPTIONS`는 `damage`·`cooldown`·`projectile_count` 3종만 배선돼 있어 `upgrade.range/duration`이 카탈로그에 없는 것은 갭이 아니라 정상 — 도메인을 `SLICE_OPTIONS`로 한정해 자동으로 이슈에서 빠진다.)
