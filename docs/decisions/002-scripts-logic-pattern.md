# ADR 002: scripts/logic/ 분리 패턴

- **날짜:** 2026-05-23
- **상태:** 결정됨

## 컨텍스트

Cocos Creator 컴포넌트는 `cc.Component`를 상속하고 `cc` 모듈을 임포트한다. 게임 규칙 로직이 Component 안에 있으면 테스트할 수 없고, 로직과 엔진 라이프사이클이 뒤섞여 재사용도 어렵다.

## 결정

**게임 규칙 로직은 `cc` import 없는 순수 TypeScript 클래스(`scripts/logic/`)에 구현한다. Component는 엔진 라이프사이클과 logic을 연결하는 껍데기만 담당한다.**

## 폴더 구조

```
scripts/
  logic/      ← cc import 없는 순수 TypeScript 클래스
  components/ ← Component 서브클래스, logic을 감싸는 얇은 껍데기
  systems/    ← 싱글톤 매니저 (Component 서브클래스)
  data/       ← 타입/인터페이스
  ui/         ← UI 컴포넌트
```

## 분리 기준

| logic/에 넣는 것 | Component에 남기는 것 |
|-----------------|----------------------|
| 게임 규칙 (데미지 계산, 카드 효과, 웨이브 판정) | `onLoad`, `update`, `onDestroy` 라이프사이클 |
| 데이터 파싱/변환 | `@property` 인스펙터 연결 |
| 순수 계산 로직 | 싱글톤 등록/해제 |
| | `director`, `node`, `instantiate` 등 cc API 호출 |

## 예시

```typescript
// logic/DeckLogic.ts — cc import 없음
export class DeckLogic {
  private _damageMult = 1;
  private _cooldownMult = 1;
  private _maxHpBonus = 0;

  applyCard(card: ICardData): void { ... }
  drawCards(pool: ICardData[], n: number): ICardData[] { ... }
}

// systems/DeckManager.ts — 라이프사이클 + wiring만
@ccclass('DeckManager')
export class DeckManager extends Component {
  static instance!: DeckManager;
  private _logic = new DeckLogic();

  get damageMult() { return this._logic.damageMult; }
  applyCard(card: ICardData) { this._logic.applyCard(card); }
  drawCards(n: number) { return this._logic.drawCards(DataManager.instance.cards, n); }

  onLoad() { DeckManager.instance = this; }
}
```
