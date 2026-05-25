# ADR 003: 테스트 전략

- **날짜:** 2026-05-23
- **상태:** 결정됨

## 컨텍스트

Cocos Creator 컴포넌트는 엔진 런타임 없이 실행할 수 없어 유닛 테스트가 불가능하다. `cc` 모듈 mock 방식은 설정이 복잡하고 cc API 변경 시 유지보수 부담이 크다.

[ADR 002](./002-scripts-logic-pattern.md)의 `logic/` 분리 패턴을 따르면 순수 로직 클래스는 표준 테스트 프레임워크로 테스트할 수 있다.

## 결정

**`logic/` 순수 클래스는 Vitest로 TDD 방식으로 테스트한다. 엔진 연동 부분은 수동 인게임 테스트로 검증한다.**

## 테스트 대상 / 비대상

| Vitest (자동) | 수동 인게임 테스트 |
|--------------|------------------|
| `logic/` 하위 순수 클래스 | Component 라이프사이클 (`onLoad`, `update`) |
| 게임 규칙 (데미지 계산, 카드 효과, 웨이브 판정) | 엔진 연동 (스폰, 씬 전환, 렌더링) |
| 데이터 파싱/변환 로직 | `@property` 직렬화 |

## TDD 워크플로우

```
새 기능:
  logic/ 클래스 설계
  → Vitest 테스트 먼저 작성 (RED)
  → 구현 (GREEN)
  → 리팩터링
  → Component 껍데기 작성

버그 수정:
  → 버그 재현 테스트 먼저 작성
  → 수정 후 통과 확인
```

## 에디터 연결 체크 (구현마다)

수동 인게임 테스트 전 확인 항목:

| 상황 | 확인 항목 |
|------|----------|
| 새 `@property(Node/Prefab/Button/Label)` 추가 | 해당 씬 인스펙터에서 연결 여부 |
| 기존 필드명 변경 | 씬 파일 구 필드명 참조 끊어짐 — 재연결 필요 |
| `director.loadScene('씬이름')` 추가 | Build Settings → Scenes 목록 포함 여부, 씬 파일명 일치 여부 |
| 새 Component를 씬에 추가 | Console에 `required properties not assigned` 없는지 확인 |

### 신규 노드 생성 시 문서화 항목

피처 QA 문서(`docs/qa/`)에 아래 정보를 기록한다.

| 항목 | 내용 |
|------|------|
| 노드 타입 | 빈 노드 / Sprite / Button / Label |
| Position | Canvas 중심 기준 (x, y) |
| Size | UITransform contentSize (width × height) |
| 컴포넌트 목록 | 붙이는 컴포넌트 전체 |
| 연결 대상 | `@property` 필드명 → 이 노드 |
| 초기 active | true / false |

버튼 노드 최소 구성: `UITransform` + `Sprite` + `Button` + `Label`(자식 노드)

## Vitest 세팅 (최초 1회)

```bash
pnpm add -D vitest
```

`package.json` scripts:
```json
"test": "vitest",
"test:run": "vitest run"
```

`vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['game/assets/scripts/logic/**/*.test.ts'],
    environment: 'node',
  },
});
```

`cc` 모듈 mock 불필요 — `logic/` 클래스는 `cc`를 임포트하지 않는다.

## 참고

- [ADR 002: scripts/logic/ 분리 패턴](./002-scripts-logic-pattern.md)
- [Cocos 포럼: Jest with Cocos Creator 3.8](https://forum.cocosengine.org/t/how-to-run-jest-unit-tests-with-cocos-creator-version-3-8/59632)
