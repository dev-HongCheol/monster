# 코드 리뷰 이슈: 마법 이펙트 게이트 (magic-effect-gate)

> - **브랜치:** feat/magic-effect-gate
> - **리뷰 범위:** 71b2c56..1b59c2b (game · tests · tools 중심)
> - **리뷰어:** Claude 서브에이전트(독립 리뷰, `superpowers:requesting-code-review` 틀)
> - **판정:** 고친 뒤 머지 — 치명 0 · 중요 3 · 사소 12

리뷰어가 확인한 것: 피처 테스트 89개를 직접 돌려 모두 통과했다. 실험실이 꺼진 보통 게임에서 바뀐 것은 발사체 `sprite.enabled = !LabRuntime.vfxOff`(보통 게임에서는 늘 true)와 `_labSink?.projectile`(보통 게임에서는 null) 둘뿐이라 회귀 기준을 지킨다고 봤다.

---

## 중요

| # | 위치 | 문제 | 처리 |
|---|---|---|---|
| 1 | `SpellCaster.ts` `_setupLabVfx` | 레시피에 「고름」이 없는 방식은 비교판 가운데가 후보를 따라가지 않는다. 오브 풀을 시작할 때 한 번 복사해 null에 묶이고, 바는 후보가 없으면 `StatusVfxOverlay`를 붙이지 않아 뒤의 `setRecipe`가 아무것도 안 한다 | **수정됨** — 오브 풀을 `_orbPool()`로 매번 sink에서 읽고, 상태 표시는 후보가 없어도 붙인다(`setup`이 null 후보를 받는다). 헤드리스로 나 · 바 비교판에서 가운데가 따라오는 것을 확인했다 |
| 2 | `VfxFactory.ts` `_emitters` | 만든 방출기를 목록에 넣기만 하고 빼지 않는다. 비교판은 키마다 모든 칸을 새로 만들어 목록이 끝없이 길어지고 `liveCounts`가 매 프레임 그 목록을 돈다 | **수정됨** — `liveCounts`가 지워진 방출기를 그 자리에서 목록에서 뺀다 |
| 3 | `parseLabUrl` `counts` · `EnemySpawner._fillToTarget` | 스포너는 적을 지우지 않는데 `counts=400,200`처럼 줄어드는 순서를 받는다. 그러면 200 단계를 400마리 위에서 재고 결과 파일에는 200으로 적힌다 | **수정됨** — 커지는 순서가 아니면 오류 상자를 띄운다(테스트 추가) |

## 사소

| # | 위치 | 문제 | 처리 |
|---|---|---|---|
| 1 | `VfxFactory.ts` | `guideRingFrame`의 JSDoc이 `ringNodeSize` 위로 밀려 블록 두 개가 연달아 붙어 있었다 | **수정됨** |
| 2 | `ILabMode.damageScale` · `autoFire`, `StatusVfxOverlay.attachedCount`, `attributionOrder` | 읽는 곳이 없다 | **수정됨** — 앞의 셋은 지웠다. `attributionOrder`는 AI가 방식별 결과 파일로 판정할 때 쓰는 기준이라 남기고 JSDoc에 「게임은 부르지 않는다」를 적었다 |
| 3 | 계획 · QA 문서 | `IVfxSink` 인터페이스(구현 셋)와 「비교판은 자동 발사를 멈춘다」가 실제 구현(실험 판 분기 네 자리, 비교판은 쏜다)과 다르다 | **수정됨** — 계획 §4 표 · §10과 QA §1을 지금 구조로 고쳐 썼다 |
| 4 | QA 문서 §2 | 「적 풀 400을 미리 만든다」는 코드에 없다. 층 순서가 유지되는 이유는 `StatusVfxOverlay.lateUpdate`가 매 프레임 층을 맨 뒤로 옮기기 때문이다 | **수정됨** — QA §2와 계획 §4 표를 코드 기준으로 고쳤다 |
| 5 | `StatusVfxOverlay.setup` 주석 | 「측정 모드에서」만 부른다고 적혀 있으나 비교판에서도 부른다 | **수정됨** |
| 6 | `LabRuntime.ts` | 초기값을 `parseLabUrl('', null)`로 만들어 모듈을 불러올 때 `URLSearchParams`를 만든다. 그 생성자가 없는 런타임이면 게임 전체가 import에서 깨진다 | **수정됨** — URL을 해석하지 않는 `labOffMode()`를 내보내 쓴다(테스트 추가) |
| 7 | `LabVfxSink.poseRing` · `VfxCompareBoard.ringCopy` | 고리마다 매 프레임 `new Color` | **수정됨** — 모듈의 칸 하나에 값을 넣어 대입하는 `setSpriteAlpha`로 바꿨다 |
| 8 | `VfxCompareBoard.replay` | 행이 0개면 `Math.max()`가 -Infinity라 주기가 음수가 된다 | **수정됨** — 0행이면 바로 돌아간다 |
| 9 | `VfxLab._finish` | `a.click()` 바로 뒤 `revokeObjectURL` — Firefox · Safari에서 다운로드가 취소될 수 있다 | **수정됨** — 1초 뒤에 거둔다 |
| 10 | `LabVfxSink.setRecipe` | 화면에 떠 있는 오브는 반납됐다 다시 나올 때까지 옛 후보 모습이다 | **수정됨(주석)** — 판정에 지장이 없는 몇 초라 동작은 두고 주석에 적었다 |
| 11 | `DeckManager.start`의 DEV 디버그 시드 | DEV 빌드에서 `debug-enhancements.json` 값이 0이 아니면 측정 부하에 겹친다 | **기록만** — 지금 파일은 전부 0이고 측정은 릴리스 빌드로 한다. 실험실과 무관한 파일이라 고치지 않는다 |
| 12 | `serve_nocache.py` | 안내 주소(localhost)와 실제 바인딩(127.0.0.1)이 다르다 | **수정됨** |

## 권고(기록)

- 공개 빌드에서 레시피 파일을 빼는 절차(백로그 F137)는 레시피만 빠지고 실험실 코드는 번들에 남는다. F137을 다룰 때 이 점을 함께 본다.
