# TypeScript 버전 핀 — Cocos 번들과 맞추기

- **작성일:** 2026-07-13 (`feat/ts-toolchain`)
- **성격:** 운영 레퍼런스. 타입 에러가 "IDE에서만 보인다"거나 "Cocos에선 통과하는데 CLI에서 막힌다" 싶을 때 먼저 읽는다.

---

## 왜 핀이 있는가

이 레포는 `typescript`를 **5.8.2로 정확히 고정**한다. Cocos Creator 3.8.8이 내부에 번들하는 TypeScript가 그 버전이기 때문이다.

```
C:\ProgramData\cocos\editors\Creator\3.8.8\resources\app.asar.unpacked\node_modules\typescript
```

컴파일러가 셋으로 갈리면(편집기 내장 TS / 레포 CLI TS / Cocos 번들 TS) 같은 코드에 서로 다른 진단이 나오고, **그 불일치를 "오탐"으로 오진하게 된다.** 실제로 그 일이 있었다 — 백로그 F27은 `static instance!: T`의 `TS1255`를 "IDE와 Cocos 번들 TS의 버전 차이로 인한 오탐"으로 기록해 두었는데, 확인해 보니 **Cocos가 번들한 그 TypeScript도 똑같이 TS1255를 냈다.** 버전 차이가 아니라 진짜 문법 위반(정의 할당 단언은 static 멤버에 불허)이었고, **Cocos가 타입 검사 없이 트랜스파일만 해서 조용히 통과하고 있었을 뿐이다.**

그래서 세 컴파일러를 한 버전으로 묶는다.

| 어디 | 무엇을 쓰는가 |
|---|---|
| 레포 CLI (`pnpm typecheck`, `pnpm wf pass ts`) | `node_modules/typescript` = **5.8.2** |
| VS Code | `.vscode/settings.json`의 `typescript.tsdk` → 같은 5.8.2 |
| Cocos 빌드 | 번들 5.8.2 (단, **타입 검사는 하지 않는다** — 트랜스파일만) |

## Cocos를 업그레이드할 때

**반드시 번들 TS 버전을 확인하고 `package.json`의 핀을 함께 올린다.**

```bash
node -e "console.log(require('C:/ProgramData/cocos/editors/Creator/<새버전>/resources/app.asar.unpacked/node_modules/typescript/package.json').version)"
```

핀을 안 올리면 편집기·CLI와 엔진이 다시 어긋나고, F27과 똑같은 오진을 처음부터 다시 하게 된다.

## 증상별 대처

**`pnpm typecheck`가 TS5083(`Cannot read file .../temp/tsconfig.cocos.json`)으로 죽는다**
→ 그 머신에서 Cocos Creator로 프로젝트를 한 번도 안 열었다. `game/temp/`는 Cocos가 만드는 생성물이고 gitignore 대상이다. 프로젝트를 한 번 열면 생긴다. 이 상태에서는 `pnpm typecheck`가 **테스트 프로젝트만 검사하고 `logic-only` 범위를 보고**하며, `pnpm wf approve-pr`이 그 범위를 거부한다.

**게임은 잘 도는데 타입 에러가 난다**
→ 정상이다. Cocos는 타입을 검사하지 않는다. 게임이 도는 것은 타입이 맞다는 증거가 아니다.

**VS Code에서만 다른 에러가 보인다**
→ VS Code가 워크스페이스 TS를 쓰고 있는지 확인한다(우하단 TypeScript 버전 클릭 → "Use Workspace Version"). `.vscode/settings.json`의 `typescript.tsdk`가 그걸 지정하지만, 사용자가 한 번 승인해야 적용되는 경우가 있다.

## 관련

- `docs/development/sessions/2026-07-13-ts-toolchain-plan.md` — 이 핀을 도입한 슬라이스
- `docs/development/backlog-implement.md` — F27·F30 (완료), F24(싱글톤 타입 정직화 — 후속)
