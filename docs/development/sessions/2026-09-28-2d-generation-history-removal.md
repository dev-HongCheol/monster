# 2D 생성 경로의 이력을 걷어 낸다 — 정본 · 백로그 · 코드에서 fal.ai · ComfyUI · LoRA · Spine 시절을 정리하고 ADR 층을 접는다

- **작성일:** 2026-09-28
- **브랜치:** `feat/blender-3d-gate` (리워크)
- **정본:** [`art-direction.md`](../../design/spec/art-direction.md) §2 · §8 · §9 · 부록 B ~ D · [`art-asset-spec.md`](../../design/spec/art-asset-spec.md) §2.7 · §3.3 · §3.4 · §5 · §6 · §8.3 · §9.1.1 · §12 · [`ops-licensing.md`](../spec/ops-licensing.md) 전체 · [`docs-glossary.md`](../spec/docs-glossary.md) §2 · §6 · [`game-combat.md`](../spec/game-combat.md) §3 — 이 정리가 2D 생성 경로의 이력을 걷어 내고 ADR 009 · 010의 내용을 접은 자리다
- **닫는 백로그:** F59(소멸) · F75(범위 변경 — ADR 층 폐지)
- **참고 파일:** [`2026-09-28-2d-generation-reference.md`](../../etc/2026-09-28-2d-generation-reference.md) — 적 · UI · 배경을 2D로 뽑을 때 다시 쓸 절차와 실측

## 1. 왜

사용자 결정(2026-09-28)이다. main에는 검증된 최종 흐름과 코드만 둔다는 규칙(2026-09-19)이 아트 그림에는 적용됐는데, 문서에는 아니었다. 플레이어 아트를 만들려고 거쳐 온 시행착오 — 로컬 ComfyUI + LoRA, fal.ai 경유 생성, 매팅, Spine 리깅 계획, 브릿지 스프라이트 — 가 정본 · 세션 · QA · ADR에 걸쳐 남아 있어서, 「캐릭터를 디자인한다」는 큰 주제에서 출발한 이력이 지금 명세를 읽는 비용이 됐다. 플레이어는 3D 층 굽기로 닫혔으므로 그 이력은 main에 실릴 이유가 없다.

지우는 기준은 둘이다. **추후 쓸 것은 남긴다** — 새 스킨을 만들 때 다시 읽는 3D 경로의 코드 · 문서, 적 · UI · 배경을 2D로 뽑을 때 다시 쓰는 후처리 코드와 절차. **한 번 쓰고 끝난 시도는 지운다** — 어떻게 만들었는지가 아니라 어떻게 실패했는지를 적은 것들.

## 2. 무엇을 지웠나

| 종류 | 파일 |
|---|---|
| 세션 12 | `2026-07-21-art-pipeline-lora` · `2026-07-21-art-pipeline-style-lock` · `2026-07-22-art-pipeline-cross-machine-split` · `2026-07-22-player-mage-art-plan` · `2026-08-04-paid-art-pipeline-plan` · `2026-08-06-player-front-cut-generation` · `2026-08-07-art-cutout-pipeline-review` · `2026-08-07-player-4dir-postprocess` · `2026-08-07-docs-refactoring-plan` · `2026-08-20-ai-matting-plan` · `2026-08-20-license-audit-plan` · `2026-08-23-local-ai-teardown` |
| QA 6 | `ai-matting-test` · `ai-matting-review-issues` · `player-mage-art-test` · `player-final-art-test` · `player-4dir-test` · `player-4dir-review-issues` |
| 매뉴얼 2 | `docs/development/comfyui-setup.md` · `kohya-setup.md` — 로컬 생성 환경은 2026-08-23에 철거됐고 되돌아갈 계획이 없다 |
| 정본 1 | `docs/design/spec/art-generation-playbook.md` — 908줄 전부가 fal.ai Sandbox 화면과 2D 플레이어 절차였다. 적 · UI에 다시 쓸 부분은 참고 파일로 뽑았다 |
| ADR 3 | `008-paid-art-generation`(철회) · `009-visual-bounds-exceed-body` · `010-player-art-3d-layer-bake`(정본에 접었다, §7) |
| 코드 3 | `tools/art/FalMatting.ts`(fal 호출기) · `tools/art/judge.ts`(매팅 모델 비교 실행기) · `tools/blender/layers.ts`(G2 층 PNG 실행기 — `bake.ts compare`가 대신한다). `@fal-ai/client` 의존성과 `.env.example`도 함께 |
| 원본 12장 | `art-source/player/**` — 2D 4방향 시트 셋 · 정면 채택 컷 · 맨살 · 삭발 베이스 여덟 장. `cloud-storage/art/evidence/player/2026-08-06-2d-generation/`으로 옮겼다(git 이력에도 남는다) |
| 픽스처 1 | `tests/fixtures/player_4dir_front.png` — 헤더 읽기 표본을 목업 렌더 `docs/design/mockups/hud-layout.html.png`으로 바꿨다 |

## 3. 무엇을 남겼나 — 그리고 왜

- **3D 경로 전부** — `tools/blender/` 26개 가운데 25개, G0 ~ G6 문서, 3D QA. 새 스킨 · 새 동작을 만들 때 다시 읽는다. `slideRatio`(`MotionSpec.ts`) · `measure_weapon_room.py` · `weapons.py`의 후보 시트는 지금 부르는 실행기가 없지만 새 걸음 · 새 무기를 디자인할 때 쓰는 도구라 남긴다. `slots.ts` · `SlotSpec.ts`는 v2 장비의 예외 경우(긴 부츠 · 망토)를 검토하는 탐침이다.
- **2D 후처리의 순수 로직** — `tools/art/SheetCrop.ts` · `Postprocess.ts` · `PngCodec.ts`, `tests/helpers/SpriteMetrics.ts`와 그 명세(`tests/logic/SpriteMetrics.test.ts`, 종전 `AiMatting.test.ts`). 적 스프라이트도 시트를 가르고 배경을 지우고 정렬해야 하므로 어느 생성 서비스를 쓰든 그대로 쓴다. 3D 층 굽기의 프레임 판정도 같은 함수를 부른다.
- **`2026-07-24-player-4dir-plan.md`** — 방향 로직(`FacingLogic`)의 설계 근거라 남긴다. **`2026-08-04-art-decision-audit.md`** — ADR 006 · 007이 근거로 링크한다. **`2026-08-13-art-canon-move-plan.md`와 그 QA 둘** — 문서 구조 이력이다.
- **기각한 안의 이름과 날짜** — `docs-references.md` §11대로 정본에 남긴다(로컬 스택 · fal.ai · 스타일 LoRA · Spine). 지우면 다음 사람이 같은 안을 다시 낸다.

## 4. ADR 층을 없앤다

사용자 판단(2026-09-28)이고 동의한다. ADR이 답하던 「그때 왜」는 세션 문서가, 「지금」은 정본이 이미 답한다. ADR은 그 사이에서 정본 내용을 복사해 들고 있다가 「고치지 않는다」는 규칙 때문에 가장 먼저 낡는 층이 됐다 — 004는 `pass <cso|ts|lint|review>` 명령 표를 들고 있어 워크플로 다이어트가 ADR 011로 뒤집으려 했고, 007은 이행 상태(2026-08-04)를 들고 굳었고, 010이 008을 반쯤 뒤집었는데 008을 읽는 사람은 그것을 모른다. 고전적 ADR이 허용하는 「superseded by」 표시마저 이 레포의 §9는 막았다.

이번에는 이 슬라이스가 만든 009 · 010을 정본에 접고(§7), 008을 지우고, `decisions/README.md`에 폐지 예정을 적었다. 남은 001 ~ 007을 접고 폴더를 없애는 것은 문서 슬라이스로 따로 한다 — `CLAUDE.md` · `docs-references.md` · 링크 검사 테스트 · 「ADR 00x」를 인용하는 코드 주석까지 걸려 한 슬라이스 분량이고, 3D PR에 층 구조 변경까지 섞으면 리뷰와 되돌리기가 어려워진다. 워크플로 다이어트 계획의 ADR 011 항목은 그 계획을 고칠 때 뺀다. 백로그 F75가 든다.

## 5. 남는 기록의 링크는 평문으로 바꿨다

지운 문서를 링크하던 살아남는 기록(세션 · 백로그 아카이브 · ADR 006)의 링크를 `` `파일명`(2026-09-28 삭제) `` 꼴의 평문으로 바꿨다. `docs-references.md` §9의 예외 「경로를 따라가는 치환」의 연장이다 — 그때의 주장은 안 바꾸고 가리키던 파일이 없어진 사실만 적는다. 스텁 파일을 남기는 방법은 지우려는 이름이 `spec/`에 계속 남아 택하지 않았다.

## 6. 백로그 처리

- **F59**(아트 생성 · 리깅 툴체인) → 아카이브. 리깅은 3D로 쓸 곳이 없고 2D 자동화는 경로째 지웠다.
- **F60 · F108** → 「생성 실행 정본은 없다 — 슬라이스가 계획을 쓸 때 참고 파일을 입력으로 새로 세운다」로 고쳐 썼다.
- **F75** → 「ADR 정의 축소」에서 「ADR 층 폐지」로 범위를 바꾸고 남은 일을 적었다.
- **F61 · F64 · F67 · F98 · F100 · F101 · F102 · F105** → 지운 문서 · ADR을 가리키던 자리를 정본으로 바꿨다. F102는 fal 매팅 캐시 항목이 도구째 사라져 뺐다.

## 7. 정본에 무엇을 적었나 — ADR 009 · 010 흡수 지도

| ADR 내용 | 어디로 |
|---|---|
| 3D 층 굽기 결정 · 층 넷 · 키프레임 · 75° · Spine 기각 | `art-direction.md` §3.1 · §3.2에 이미 있었다 |
| 배율 `K` · 논리 컨테이너 · 한 카메라 · 파일 규격 | `art-asset-spec.md` §3.1 ~ §3.6에 이미 있었다 |
| 층 캔버스 조건(기준보다 작지 않게 · 홀짝 · 긴 변 기준 `ortho_scale`) | `art-asset-spec.md` §3.3에 더했다 |
| 비용 공식(옷 한 벌 44장 ≈ 30초 · 동작 · 방향 · 곱 항 0인 이유 · 아틀라스 용량 · 웹 빌드) | `art-asset-spec.md` §3.4 · §8.3에 더했다 |
| 공격 판정은 그림이 아니다 | `game-combat.md` §3에 더했다 |
| 009의 기각안 넷(무기 축소 · 캔버스 확대 · 별도 노드 · 기울여 들기)과 실측 근거 | G4 문서 §3.1에 더했다 |
| 010의 기각안(실시간 3D · `cc.Animation` · Auto Atlas · 옷별 무기 층) | 계획 개요 §2.2 D15 · §2.3, G4 §5.1에 이미 있었다 |
| 「ADR 009」를 인용하던 코드 주석 6곳 | `art-asset-spec §3.3`으로 바꿨다 |
