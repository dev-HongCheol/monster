# 지팡이 없는 시트를 뽑아 몸 열두 장을 갈아 끼운다

- **작성일:** 2026-08-23 (같은 날 계획 리뷰 반영 개정 · 범위 축소 개정 · 정렬 기준 개정) · 2026-08-24 개정 (생성 회차 결과 · 사용자 검증 결과 · 양손 장비 결정 · 시트 재생성 편입)
- **브랜치:** `feat/staff-layer`
- **상태:** 진행 중 — 리워크로 5단계 구현에 복귀 (시트 재생성, Draft PR #91)
- **정본:** [`art-generation-playbook.md`](../../design/spec/art-generation-playbook.md) §8.2 — 생성 판정 항목에 손 조건 셋이 붙고, 지팡이를 지우는 편집 지시문 셋이 새로 들어간다. 같은 문서 §7.1·§7.2·§8.2.1에는 측면 두 장의 쥔 팔과 빈 손 모양 요구가 붙고 §8.8에는 보조 손 방패가 판정 밖이라는 것이 들어간다(§6.2). 같은 문서 §8.7과 [`art-asset-spec.md`](../../design/spec/art-asset-spec.md) §3.2·§3.3도 함께 바뀐다 — 트림 상자로 설명하던 인과가 Sprite Trim을 끄면서 정렬 기준으로 옮겨 갔고, 그 정렬 기준 자체도 이번에 바뀌기 때문이다(§4.3). [`game-combat.md`](../spec/game-combat.md) §3에는 방패도 「장비는 외형만 바꾼다」의 예외가 아니라는 명시가 들어간다
- **닫는 백로그:** `F102` ②⑤⑥(`footCenterX`의 이름과 동작, 매팅 캐시의 자리, 호출부 없는 산출물 셋) · `F101`(참조가 끊긴 브릿지 스프라이트 삭제 — §7.3). **`F67`은 생성·교체 축만 닫고 배선 축은 열어 둔다** — 배선을 이번에 안 하기로 했다(2026-08-23 사용자 결정, §1)
- **넘긴 것:** 지팡이 노드 배선과 파츠 컷 → 리깅 슬라이스(`F59` ①) · v2 양손 장비 정책과 층 표 분할 → `F103` · `hurtboxHalfWidth` 반영 → `F66` ③ · `F102` ①③④

---

## 1. 왜 하나 — 목적이 v1 화면이 아니다

**이 슬라이스의 목적은 v2가 쓸 밑판을 확보하는 것이다(2026-08-23 사용자 결정).** v1 화면에서 무기가 보이는지, 손 모양이 v1 기준으로 어색한지는 판단 기준으로 삼지 않는다. 그래서 뽑은 컷을 통과시킬지 정하는 질문이 「v1에서 보기 좋은가」가 아니라 **「v2에서 파츠로 잘라 쓸 수 있는가」**다.

**같은 이유로 지팡이 배선을 안 한다(2026-08-23 사용자 결정).** 배선은 화면에 지팡이를 되돌려 놓을 뿐이고, 방향별 오프셋은 리깅에서 뼈 위치로 대체되므로 v2로 넘어가지 않는다. 값이 넘어가는 것은 **파츠 이미지**이지 그 파츠를 씬에 겹치는 배선이 아니다 — Spine이 파츠를 자기 아틀라스로 가져가면 Cocos 씬에는 `sp.Skeleton` 노드 하나만 남기 때문이다.

**그리고 나머지 파츠도 이번에 안 자른다.** 파츠 컷은 인페인팅을 동반하는데, 지금 시트 사다리로는 가려진 자리가 남는다. 하의를 삭발 시트에서 오리면 상의 밑단이 덮은 허리춤이 없고, 맨살 시트조차 회색 운동복이 가슴과 엉덩이를 덮고 있어 그 밑의 살이 없다. 얼마나 채워야 하는지는 실제로 잘라 봐야 알기 때문에 사양서 §5.2·§5.3이 조각 수 산정을 리깅 슬라이스의 실측으로 미뤄 뒀다.

**그래서 이 슬라이스가 하는 일은 둘이다 — 지팡이가 없는 몸 시트 셋을 확보해 에셋 열두 장을 갈아 끼우고, 정렬 함수가 소품을 발로 착각하지 않게 고치는 것.** 앞쪽이 파츠 여섯 중 지팡이부터인 이유는 §4.1과 §4.2에 있고, 뒤쪽은 이 계획이 처음에 그 이유를 잘못 짚은 데서 나왔다(§4.3).

## 2. 지금 무엇이 서 있나 — 실측

계획 단계에서 잰 값을 그대로 적는다. 나중에 정본이 바뀌어도 2026-08-23에 무엇을 보고 판단했는지가 남아야 하기 때문이다.

### 2.1 에셋 열세 장

세 시트가 각각 네 방향으로 잘려 있고, 지팡이 한 장이 따로 있다. 이 열셋이 F67이 말하는 「에셋 13장」이며, **이번에 바뀌는 것은 몸 열두 장이다.**

| 시트 | 파일 | 자리 | 무엇이 들었나 |
|---|---|---|---|
| A(옷+머리) | `player_4dir_{front,back,left,right}.png` | `game/assets/art/player/` | v1 화면에 나가는 그림 |
| B(옷+삭발) | `player_bald_{front,back,left,right}.png` | `art-source/player/base/` | 머리카락에 안 가려진 옷 |
| C(맨살) | `player_base_{front,back,left,right}.png` | `art-source/player/base/` | 몸 살·맨손·머리 밑판 |
| 지팡이 | `player_staff.png` | `game/assets/art/player/` | 캔버스 55×395, 트림이 여백 없이 꽉 참, 가로로 끊긴 행 0개. **이번에 안 건드린다** |

### 2.2 정렬 규격 — 열두 장이 이미 정합하다

| 파일 | 캔버스 | 트림 상자 | 발 밑선 | 발 중심 어긋남 | 트림 중심 어긋남 | 희미한 알파 |
|---|---|---|---|---|---|---|
| `player_4dir_front` | 246×493 | 215×488 @(18,2) | y=489 | 0.0 | +2.5 | 1px |
| `player_4dir_back` | 246×493 | 208×487 @(22,3) | y=489 | −0.5 | +3.0 | 4px |
| `player_4dir_left` | 246×493 | 194×483 @(50,7) | y=489 | +0.5 | **+24.0** | 4px |
| `player_4dir_right` | 246×493 | 194×483 @(4,7) | y=489 | +1.5 | **−22.0** | 2px |
| `player_bald_front` | 246×493 | 215×486 @(16,4) | y=489 | 0.0 | +0.5 | 0px |
| `player_bald_back` | 246×493 | 201×482 @(27,8) | y=489 | +1.0 | +4.5 | 0px |
| `player_bald_left` | 246×493 | 133×481 @(65,9) | y=489 | 0.0 | +8.5 | 1px |
| `player_bald_right` | 246×493 | 142×480 @(54,10) | y=489 | +1.0 | +2.0 | 0px |
| `player_base_front` | 246×493 | 210×488 @(18,2) | y=489 | 0.0 | 0.0 | 3px |
| `player_base_back` | 246×493 | 199×486 @(25,4) | y=489 | +0.5 | +1.5 | 3px |
| `player_base_left` | 246×493 | 144×487 @(49,3) | y=489 | 0.0 | −2.0 | 1px |
| `player_base_right` | 246×493 | 142×486 @(56,4) | y=489 | 0.0 | +4.0 | 2px |

읽어야 할 것이 넷이다.

**옷+머리 시트의 측면 두 장만 트림 중심이 +24.0과 −22.0으로 반대로 밀려 있다.** 삭발 시트의 같은 두 방향은 +8.5와 +2.0이므로, 미는 것은 자세가 아니라 머리카락이다. 이 23px이 2026-08-07에 Sprite Trim을 끈 이유이며, 실제로 `main.scene`의 플레이어 `cc.Sprite`가 `_isTrimmedMode: false`로 서 있다. Content Size는 48×96이고 캔버스 종횡비 246÷493과 48÷96이 같으므로 캐릭터가 눌리거나 늘어나 있지는 않다.

**희미한 알파가 열둘 중 아홉에서 0이 아니다.** 실행 지침 §8.5는 이 값이 0%여야 한다고 적으므로, 현행 출하본은 이미 정본을 어긴 상태다. §8의 기준선을 「현행 수준」으로 잡으면 안 되는 이유가 이것이다.

**캔버스 세로의 여유가 2px뿐이다.** `alignToCanvas`는 확대·축소를 하지 않고 평행 이동만 하므로, 발 밑선을 여백 3 위에 놓으려면 트림 높이가 490 이하여야 한다. 현행 최대가 488이다. 교체본이 3px만 커도 실행기가 예외를 던지고 멈춘다.

**발 중심 어긋남은 회귀 단언의 근거로 쓸 수 없다.** 위 값이 0.0에서 1.5까지 흩어져 있는 것은 이 열두 장이 구 `rembg` 파이프라인 산물이라 `alignToCanvas`를 안 지났기 때문이다. 교체본은 그 함수를 지나므로 값이 좁게 붕괴한다 — 이유와 대안은 §8에 있다.

### 2.3 화면에 실제로 보이는 것

세 가지가 겹쳐 있다.

1. `player_4dir_*.png` 넷은 **구 파이프라인이 지팡이를 픽셀로 잘라 낸 판**이다. 그 파이프라인(로컬 `rembg`)은 2026-08-23에 F70으로 철거돼 이제 없으므로, 같은 방식으로 다시 만들 수단도 없다.
2. `player_staff.png`는 만들어져 있는데 씬에 안 붙었다. `main.scene`의 `Player` 노드가 `"_children": []`이다. **이번 슬라이스가 이걸 안 고친다**(§1).
3. 그래서 게임 속 마법사는 쥔 손 모양만 하고 아무것도 들고 있지 않다. 잘라 낸 자국도 남아서 맨살 시트의 왼쪽 윤곽과 다리에 한 열짜리 고립 픽셀이 보이고, 쥐던 손은 뭉친 덩어리가 됐다. 교체 뒤에도 **화면에 지팡이는 여전히 없다** — 달라지는 것은 손과 윤곽이 깨끗해지는 것뿐이다.

## 3. 왜 후처리로 못 빼나 — 실행 지침이 이미 접은 길이다

`feat/ai-matting`에서 잘라내기를 실제로 짜서 돌려 보고 접었다.

> 지팡이는 배경만 가리는 것이 아니라 **머리카락 위를 지난다.** 그러니 걷어 내면 그 뒤에 아무것도 없다 — 실측에서 머리카락 236px이 함께 사라졌고, 머리 왼쪽 윤곽이 자로 그은 듯한 세로 직선으로 잘렸다.
>
> — [`art-generation-playbook.md`](../../design/spec/art-generation-playbook.md) §8.2

**여기에 실물을 보고 알게 된 이유가 하나 더 붙는다.** 지침 §8.2는 지팡이가 몸에서 떨어져 서 있는 맨살 시트라면 세로 막대 하나만 떼면 된다고 적어 뒀는데, 세 시트를 열어 보면 그 시트에서도 후처리가 성립하지 않는다. **어느 시트든 손이 지팡이를 쥐고 있어서** 지팡이가 차지한 열을 지우면 손가락이 함께 지워지기 때문이다. 지침이 맞게 본 것은 「지팡이 **그림**을 뜯어내는 것」이고, 안 본 것은 「지팡이를 뺀 **몸**을 얻는 것」이다. 앞쪽은 맨살 시트에서 되지만 뒤쪽은 세 시트 모두 안 된다.

그래서 §6의 판정 항목을 손 쪽으로 넓힌다.

## 4. 왜 지팡이만 먼저인가 — 오려서는 뺄 수 없는 유일한 파츠다

파츠 여섯 중 지팡이만 이번에 처리하는 이유가 둘이다. **판정 정렬은 그 이유가 아니다** — 이 계획의 첫 판은 그것을 첫 번째 이유로 들었는데 틀렸고, 무엇이 틀렸고 대신 무엇을 고치는지를 §4.3에 남긴다.

### 4.1 나머지 다섯 파츠가 이 시트를 기다린다

지팡이는 배경 위가 아니라 **머리카락 위를 지난다**(§3). 그래서 지금 A 시트에서 머리카락을 오려 내면 지팡이가 지나간 자리가 통째로 빈다. 앞머리·뒷머리는 v2 스킨이 가장 먼저 갈아 끼울 레이어인데, 그 레이어를 시트를 새로 뽑기 전에는 만들 수 없다는 뜻이다.

**그리고 지팡이를 뺀 몸은 후처리로 못 얻는다.** §3이 이유를 든다 — 어느 시트든 손이 지팡이를 쥐고 있어서 지팡이가 차지한 열을 지우면 손가락이 함께 지워진다. 그러니 지팡이 없는 몸은 **다시 뽑는 것 말고 얻을 방법이 없고**, 나머지 다섯 파츠는 반대로 그 시트에서 오려 내기만 하면 된다. 지팡이가 먼저인 것은 급해서가 아니라 **파츠 컷의 입력이기 때문**이다.

### 4.2 이미 잘려 있는 유일한 파츠다

`player_staff.png`가 395행 전부에서 가로로 끊긴 데 없이 온전하다. 나머지 다섯 파츠(뒷머리·앞머리·상의·하의·신발과 장갑)는 아직 안 잘렸고 §1대로 인페인팅이 따라붙는다. **지팡이는 파츠 컷 여섯 중 이미 끝난 하나**라, 몸에서 지우기만 하면 그 자리에서 완결된다.

### 4.3 판정 정렬은 이유가 아니었다 — 정렬 함수를 고친다

이 계획의 첫 판은 「지팡이가 발 띠까지 내려와 발 중심을 12px 민다」를 지팡이를 먼저 처리할 첫 번째 이유로 들었다. 실측은 맞았지만 결론이 틀렸다. **미는 것은 지팡이가 아니라 중심을 재는 함수다.**

`footCenterX`는 아래 여덟 줄에서 불투명 픽셀의 **가로 최솟값과 최댓값**을 잡는다(`tools/art/Postprocess.ts:75`). 바깥 상자를 재는 방식이라 그 띠 안에 있는 것이 굵은 발인지 6px짜리 막대인지 가리지 않고, 양 끝에 걸리기만 하면 중심이 따라 움직인다. 세로도 같은 모양이다 — `footLineY`는 최하단 불투명 행을 그대로 바닥으로 삼으므로, 발보다 아래로 내려온 것이 있으면 그것이 발 밑선 노릇을 한다.

**그래서 고칠 자리는 아트 순서가 아니라 이 두 함수다.** 지팡이는 이 구멍에 걸린 첫 번째 물건일 뿐이고, 늘어진 망토 자락이든 꼬리든 발치를 도는 이펙트든 같은 자리에서 같은 일이 난다. **판정 위치가 그림 내용에 딸려 움직이는 것 자체가 결함이다**(2026-08-23 사용자 지적). 정렬은 캐릭터가 딛고 선 자리를 재는 일이지 그림에 무엇이 더 그려져 있는지를 재는 일이 아니고, 소품은 판정에 아무 영향이 없어야 한다.

고치는 방향이 둘이다. 현행 열두 장에 `player_staff.png`를 첫 판이 잰 배치 그대로 합성해서 재 봤다 — 지팡이 막대의 오른끝을 발 왼끝에서 8px 왼쪽에 두고, 끝을 발 밑선 2px 위(가로 시험)와 3px 아래(세로 시험)에 각각 놓았다.

**바닥은 굵은 줄을 먼저 찾고 거기서 발끝까지 내려간다.** 한 줄에서 20px 이상 이어지는 구간이 있는 가장 아래 행을 찾으면 그것은 발이다 — 현행 열두 장에서 그 조건이 처음 걸리는 행이 발 밑선에서 한두 줄 위이고 거기 구간이 20~25px인데, 지팡이 막대는 아래 여덟 줄에서 6~12px이라 절반에 못 미친다. 그 행에서 다시 아래로 겹치는 구간만 따라 내려가면 안티에일리어싱으로 가늘어진 발끝까지 회수되므로, **현행 열두 장의 바닥 값이 489 그대로 유지된다.** 기준선을 다시 잡을 필요가 없다는 뜻이다.

**임계값 20px이 무엇에 기대고 있는지는 적어 둔다.** 이 규칙은 「발은 굵고 소품은 가늘다」에 기대므로, 발 밑선 근처에서 20px을 넘는 소품이 오면 그것을 발로 착각한다. 지금 지팡이는 아래로 갈수록 가늘어져 여유가 두 배 가까이 있지만, v2에서 밑동이 굵은 무기를 들리면 이 값을 다시 재야 한다. 그때 무엇을 재야 하는지가 위 표다.

**발 중심은 그 바닥에서 위로 이어 붙는 구간만 본다.** 맨 아랫줄의 구간에서 시작해 한 줄씩 올라가며 겹치는 구간만 남기면, 발과 떨어져 선 막대는 애초에 후보에 들지 않는다. 손이 지팡이를 쥐고 있어 그림 전체로는 몸과 지팡이가 한 덩어리지만, **발 띠 안에서는** 둘이 떨어져 있어 갈린다.

| 방향 | 발 띠 x범위 | 발 중심 — 현행: 몸만 → 합성 | 발 중심 — 새 기준: 몸만 → 합성 | 바닥 — 현행: 몸만 → 합성 | 바닥 — 새 기준: 몸만 → 합성 |
|---|---|---|---|---|---|
| front | 72~173 | 122.5 → **114.5** | 122.5 → 122.5 | 489 → **492** | 489 → 489 |
| back | 73~171 | 122 → **114** | 122 → 122 | 489 → **492** | 489 → 489 |
| left | 94~152 | 123 → **115** | 123 → 123 | 489 → **492** | 489 → 489 |
| right | 95~153 | 124 → **116** | 124 → 124 | 489 → **492** | 489 → 489 |

**캔버스를 벗어나는지 보는 가드는 그대로 둔다.** `alignToCanvas`가 그 판단에 쓰는 `trimBox`는 지팡이까지 포함한 그림 전체의 상자인데, 여기서는 그게 맞다. 묻는 것이 「캐릭터가 제자리에 섰는가」가 아니라 「그린 것이 캔버스 안에 다 들어가는가」이고, 지팡이도 그려지는 이상 잘리면 안 되기 때문이다. 첫 판이 적어 둔 정지 — 지팡이 든 맨살 패널에서 `발 밑선을 여백 3 위에 놓으면 캐릭터 높이 491가 캔버스 세로 493를 벗어난다`가 나던 것 — 은 그래서 고친 뒤에도 그대로 난다. 그 판을 출하하려면 캔버스가 모자라는 것이 사실이라 맞는 정지다.

## 5. 무엇을 뽑나 — 시트 셋을 한 세션에서

확정된 시트 셋에서 **지팡이만 지운 변형본** 셋을 받는다. 실행 지침 §7.3이 A에서 B(삭발), B에서 C(맨살)로 가리는 것을 하나씩 걷어낸 것과 같은 수법이고, 지팡이가 그 셋 중 마지막 하나다.

**셋을 각각 자기 원본에서 편집해 받으려던 계획은 실제로 뽑아 보고 접었다(2026-08-24).** 그 방식으로 받은 옷 입은 판은 네 방향 인물 세로가 478·497·501·502로 갈려 편차가 24px이었다 — 「지팡이를 지워라」는 그림 전체를 다시 그리게 하는 지시라 모델이 몸까지 다시 잡는다. 그래서 **삭발 판 하나를 축으로 삼고 나머지 둘을 거기서 파생시키는** 방식으로 갈아탔고, 같은 편차가 3px로 내려왔다. 회차 전문과 프롬프트는 [`2026-08-24-staff-sheet-generation.md`](2026-08-24-staff-sheet-generation.md)가 들고, 확정된 방식은 실행 지침 §8.2.2가 든다.

| 시트 | v2에서 무엇을 주나 | 지금 뽑아야 하는 이유 |
|---|---|---|
| **A'** | 앞머리·뒷머리 레이어 | A 시트는 지팡이가 머리카락 위를 지나므로, 이 시트에서 머리카락을 오려 내면 지팡이가 지나간 자리가 뚫린다 |
| **B'** | 상의·하의·신발·장갑 레이어 | 머리카락에 안 가려진 온전한 옷이 여기서만 나온다 |
| **C'** | 몸 살·맨손·머리 밑판 | 장갑이 핑거리스라 손가락은 맨손이 보인다. 장갑 스킨을 갈아 끼우려면 그 밑에 맨손이 있어야 한다 |

**셋을 한 세션에서 받는 이유는 되돌릴 수단이 없기 때문이다.** fal.ai는 시드도 재현도 보장하지 않아서 실행 지침 §9가 규약 자체를 「다시 뽑을 수 있게 기록한다」에서 「뽑은 것을 잃지 않게 보관한다」로 바꿔 놓았다. A'만 뽑고 B'·C'를 리깅 슬라이스로 미루면, 그 세션에서 나온 손과 옷이 A'와 미세하게 달라도 맞출 방법이 없다. 그러면 A'까지 다시 뽑는다.

**§6의 손 조건 때문에도 셋이 함께여야 한다.** v2에서 손 모양을 하나로 고정하려면 세 시트의 쥔 손이 같은 모양이어야 하는데, 세션이 갈리면 그것부터 보장되지 않는다.

### 5.1 프롬프트와 보관은 산출물이다

실행 지침에는 A·B·C용 프롬프트(§5.1·§7.1·§7.3)만 있고 **지팡이를 지우는 편집용 프롬프트가 없다.** §3은 인물 고정 문장을 글자 그대로 복사하라고 못 박았으므로 세 지시문을 새로 써서 §8.2에 붙이는 것이 이 슬라이스의 산출물이다. 그 문장이 없으면 사용자가 생성 단계에서 즉석으로 지어내게 되고, 다음에 같은 컷을 다시 받을 근거가 사라진다.

받은 시트는 §9의 규약대로 `art-source/player/2026-08-23/`에 `4dir_dressed_nostaff.png`·`4dir_bald_nostaff.png`·`4dir_skin_nostaff.png`로 보관하고, 채택 컷마다 엔드포인트 전체 경로·프롬프트 전문·시드·설정·레퍼런스 경로 다섯을 같은 폴더의 기록에 남긴다.

### 5.2 다시 뽑는다 — 팔을 옮기는 한 컷을 먼저 시험한다 (2026-08-24 리워크)

**다시 뽑는 이유는 v2 층 구조 셋과 사용자 요청 하나다.** 맨살 판이 6% 작아 소매가 팔을 안 덮고(§6.1), 뒷모습의 쥔 손이 펴져 무기가 통과하지 못하며, 맨살 판에 팔이 하나 없어 파츠가 안 나온다. 여기에 **측면 두 장에서 지팡이 쥔 팔을 앞으로 당겨 지팡이가 방패보다 먼저 보이게 한다**는 요청이 얹힌다(2026-08-24 사용자). **v1 화면에서 어색한 것은 판정에 넣지 않는다** — 지금 뽑는 것은 스킨을 얹을 v2 최종본이고, 그 기준으로 서지 않는 항목은 회차를 돌릴 이유가 못 된다.

**보조 손도 목표에 들어간다(2026-08-24 확인).** 한때 「방패가 덮으니 v2 근거가 없다」고 판단해 뺐는데, 덮이는 것은 겉모습 한 겹뿐이고 그 밑에서 이 손은 장갑 스킨의 밑판이고 파츠로 잘린다. 현행 시트의 보조 손은 **측면 두 장에서 엉덩이에 겹쳐 일부가 안 보이고**(가려진 부분은 파츠에 구멍으로 남는다 — 실행 지침 §2.0), **손가락이 활짝 펴져 손잡이를 쥔 모양이 되지 않는다.** 둘 다 모양·가림이라 리깅으로 못 고치므로 여기서 받는다.

#### 무엇이 걸려 있나 — 인물 동일성

팔의 앞뒤를 바꾸려면 실행 지침 §7.1의 4방향 턴어라운드부터 다시 돌아야 한다는 것이 지금 정본의 입장이다(§2.0 — 몸통에 가려 그려진 적 없는 팔은 편집으로 발명되지 않는다). **그런데 그 길은 인물을 건다.** fal.ai는 재현을 보장하지 않으므로(§9), 4방향을 다시 구성하면 지금 열두 장과 미세하게 다른 인물이 나올 수 있다. 반면 기존 시트를 레퍼런스로 받는 편집은 인물을 그대로 유지한다.

**그 정본의 입장은 아직 시험된 적이 없다.** §2.0이 실제로 확인한 것은 지팡이·옷·머리카락이 **가린 자리**를 편집으로 못 되살린다는 것이고, 「팔을 몸통 앞으로 옮긴다」는 그 사례에 들어맞는지 아직 재 보지 않았다. 한 컷이 $0.111이므로 재 보는 값이 싸다.

#### 순서 — 한 컷을 먼저 돌리고 갈린다

| # | 무엇 | 입력 | 지시문 | 상태 |
|---|---|---|---|---|
| 0 | 측면 두 장의 쥔 팔을 앞으로 (지팡이 든 채) | `2026-08-06/4dir_bald.png` | §5.3 | **통과** — `2026-08-24/4dir_bald_armfront.png` |
| 1 | 보조 손을 오므려 배 앞 허리 높이로 | 0의 결과 | §5.4 | **부분 통과** — 보조 손은 맞고, 잠가 둔 셋이 흔들렸다(아래) |
| 2 | 지팡이 손을 보조 손보다 앞으로 | 1의 결과 | §5.5 | **부분 통과** — 오른쪽은 맞고 왼쪽이 무너졌다 |
| 3 | **왼쪽 패널을 오른쪽의 반전으로 채운다** | 2의 결과 | 유료 아님 — `MirrorPanel.ts` | **완료** — `4dir_bald_mirrored.png` |
| 4 | 지팡이 없는 삭발 판 — 축 | 3의 결과 | 실행 지침 §8.2.2 축 | |
| 5 | 지팡이 없는 옷+머리 판 | 4의 결과 | 실행 지침 §8.2.2 옷+머리 | |
| 6 | 지팡이 없는 맨살 판 | 4의 결과 | 실행 지침 §8.2.2 맨살 | |

**유료 컷 여섯(약 $0.67)이고 인물은 그대로 유지된다.** 자세를 잡는 데 세 컷이 들었고, 네 번째 자리는 유료 회차 대신 반전으로 메웠다(§5.6). 자세를 잡는 데 세 컷이 든 것은 **한 컷에 하나씩만 바꿨기 때문**이고, 그 대신 매 컷이 통했다. 턴어라운드부터 도는 길도 값은 비슷한데 그쪽은 인물 동일성을 건다. 같은 값으로 턴어라운드부터 돌 수도 있었지만 그쪽은 인물 동일성을 걸므로, 값이 같다면 인물을 안 거는 쪽을 택한다. **앞 컷의 결과를 보기 전에는 다음 컷을 돌리지 않는다** — 축이 갈리면 뒤가 전부 갈린다.

#### 0번 결과 — 정본의 「불가능」이 실측에서 뒤집혔다

좌·우 두 패널 모두 쥔 팔이 몸통 앞으로 나왔고, 앞·뒤 두 패널은 그대로였다. **팔의 앞뒤는 자세라 편집으로 못 바꾼다**는 것이 실행 지침 §2.0을 근거로 §7.1·§7.2·§8.2.1에 세 번 적혀 있었는데, 한 컷에 통했다. 갈린 지점은 **모델이 참고할 그림이 같은 시트 안에 있느냐**다 — 팔은 앞·뒤 패널에 온전히 그려져 있어 옮겨 그리면 되지만, 천옷 밑의 살이나 머리카락 밑의 어깨는 네 패널 어디에도 없다. 그 경계를 실행 지침 §2.0에 적고 세 자리의 「못 바꾼다」를 걷었다.

**보조 손은 이 컷에서 안 고쳐졌다.** 지시문이 「반대쪽 팔은 먼 쪽에 그대로 둔다」로만 적혀 있어 손가락을 편 채 엉덩이 뒤에 남았고, 그래서 1번이 붙는다.

### 5.4 1번 지시문 — 보조 손

**방패가 엉덩이 뒤에서 나오면 안 된다(2026-08-24 사용자 판단).** 지금 보조 손은 측면 두 장에서 엉덩이 뒤아래로 손가락을 편 채 있는데, 그 자리에 방패를 얹으면 방패가 몸 뒤에서 삐져나온 모양이 된다. 방패 전체가 보일 필요는 없고 **몸 뒤에 통째로 숨지만 않으면 된다.**

**높이는 참조 시트에서 가져왔다(2026-08-24 사용자 제시).** 방패를 든 캐릭터의 참조 시트는 팔을 늘어뜨리지 않고 **팔꿈치를 굽혀 손을 허리~배 높이**에 두고, 거기서 방패가 몸통 앞으로 나온다. 손이 엉덩이 높이에 있으면 방패가 허벅지에 걸려 방패를 든 자세로 안 읽힌다. **그리고 팔꿈치 각도는 그림에 굳는다** — 현재 층 표가 `팔(살)`을 한 파츠로 두므로 리깅이 팔을 회전시킬 수는 있어도 팔꿈치를 새로 굽히지는 못한다. 그래서 굽힌 자세를 여기서 받는다.

```
Using this exact same 4-view turnaround sheet as the reference, redraw the same
character in the same four views — front view, back view, left side view, right
side view — changing only her empty arm and hand.

Her empty hand is the hand that is not holding the staff. It currently hangs
straight down beside her hip with its fingers spread flat open.

In all four views she now bends that elbow and brings the forearm up and
forward, so that the empty hand rests in front of her body at waist height,
level with her belt. Her upper arm stays down against her side and only the
forearm comes up. The forearm does not reach across to her other side.

That hand's fingers are now softly curled, as if loosely holding a short
horizontal handle, with a small opening left inside the curl. The fingers stay
separated from one another. The hand is neither flat open with spread fingers
nor closed into a fist.

In the left side view and in the right side view that hand sits slightly in
front of her belly, past the front edge of her torso, so that her whole hand is
visible and clear of her body, with no part of it hidden behind her torso, her
hip or her thigh.

The staff and the arm that holds it do not change at all, in any of the four
views.

Everything else must stay exactly the same: the same face and the same facial
features, the same completely bald head with bare scalp skin and no hair at all,
the same skin tone, the same clothes and their colors, the same fingerless
gloves, the same boots, the same four-head-tall proportions, the same standing
pose of her legs, the same scale, the same position inside the frame and the
same ground line in all four views. Do not redraw her, do not resize her, do not
move her, and do not lengthen or shorten her legs.

All four views must stay the same size as each other, exactly as they are in the
reference.

She keeps her staff. Plain flat gray background, the same gray as the reference.
Do not include any second staff, wand, rod, stick, sword, shield, weapon, tool,
hat, hood, cap, headband, wig, fire, glow, particles or ground shadow. No frame,
no border, no text, no watermark. Only one character.
```

**판정 넷만 본다.** 네 방향 모두에서 팔꿈치가 굽어 손이 배 앞 허리 높이에 왔는가, 손가락이 오므려졌는가, 측면 두 장에서 손이 몸통 앞 실루엣 밖으로 나와 통째로 보이는가, 그리고 지팡이 쪽 팔과 네 인물의 크기가 안 바뀌었는가.

### 5.3 0번 시험 지시문

**한 번에 하나만 바꾼다.** §3이 「지팡이를 지워라」로 몸까지 흔들렸던 회차를 들고 있으므로, 팔을 옮기는 일과 지팡이를 지우는 일을 한 컷에 겹치지 않는다. 지팡이는 든 채로 두고 팔만 옮긴다.

```
Using this exact same 4-view turnaround sheet as the reference, redraw the same
character in the same four views — front view, back view, left side view, right
side view — changing only which arm holds the staff in the two side views.

In the left side view and in the right side view the staff is currently held by
the arm further from the viewer, so that arm and the staff are partly hidden
behind her torso. In both of these two views the staff is now held by the arm
nearer to the viewer instead. That whole near arm — shoulder, upper arm, elbow,
forearm and hand — is drawn in front of her torso, complete and unbroken, with
no part of it hidden behind her body, and the staff it holds is fully visible in
front of her. Her other arm stays on the far side with its hand empty.

The front view and the back view do not change at all.

The gripping hand keeps the exact same half-closed shape it has now: the fingers
stay curled and stay separated from one another, the opening inside the grip
stays open, and the hand neither closes into a fist nor opens flat.

Both of her arms are drawn in every one of the four views. Neither arm is
omitted or shortened.

Everything else must stay exactly the same: the same face and the same facial
features, the same completely bald head with bare scalp skin and no hair at all,
the same skin tone, the same clothes and their colors, the same fingerless
gloves, the same boots, the same four-head-tall proportions, the same standing
pose, the same scale, the same position inside the frame and the same ground
line in all four views. Do not redraw her, do not resize her, do not move her,
and do not lengthen or shorten her legs.

All four views must stay the same size as each other, exactly as they are in the
reference.

She keeps her staff. Plain flat gray background, the same gray as the reference.
Do not include any second staff, wand, rod, stick, sword, shield, weapon, tool,
hat, hood, cap, headband, wig, fire, glow, particles or ground shadow. No frame,
no border, no text, no watermark. Only one character.
```

**설정은 편집 회차의 값을 그대로 쓴다** — `openai/gpt-image-2/edit`, Aspect Ratio 16:9, 나오는 크기 1088×608(실행 지침 §8.2.2). 크기가 커지면 뒤의 셋이 전부 정렬에서 멈춘다.

### 5.5 2번 지시문 — 지팡이 손을 앞으로

**보조 손을 앞으로 낸 대가로 순서가 뒤집혔다(2026-08-24 사용자 확인).** 1번에서 보조 손이 배 앞으로 나오면서, 측면 두 장에서 **그 손이 지팡이 손보다 앞에 서게 됐다.** 그대로 두면 보조 손에 얹힌 방패가 지팡이를 가려, §6.2가 「주무기를 화면 가까운 쪽에 둔다」로 얻으려던 것이 다시 사라진다.

**그래서 앞뒤 관계를 명시적으로 못 박는다.** 「쥔 팔이 가까운 쪽」만으로는 부족하다 — 그것은 몸통과의 앞뒤(그리기 순서)를 정할 뿐이고, 여기서 필요한 것은 **두 손 사이의 앞뒤**다. 지팡이가 인물의 가장 앞에 서고 다른 어떤 부위도 그보다 앞으로 나오지 않는다는 것을 기준으로 삼는다.

**1번이 잠가 둔 자리 둘도 여기서 함께 되돌린다.** 지시문이 「지팡이와 그 팔은 어느 방향에서도 안 바뀐다」로 잠갔는데도 둘이 따라 움직였다.

- **뒷모습에서 지팡이가 손을 떠났다.** 보조 손을 올릴 때 쥔 손도 함께 허리로 올라갔고, 지팡이는 옛 자리에 남아 **혼자 서 있는 막대**가 됐다. 실행 지침 §8.2.1의 「네 방향 전부에서 쥔 손이 남아 있다」가 잡는 자리인데, 이번에는 손 모양이 아니라 손과 물건의 연결이 끊겼다.
- **네 방향 모두에서 두 손이 붙었다.** 둘 다 허리 높이로 모이면서 측면 두 장에서는 거의 겹친다. 그대로 두면 §8.2.1의 「손이 뭉개지지 않았다」에 걸리고, 리깅에서 두 손을 각각 파츠로 못 뗀다.

**한 컷으로 함께 잡는 이유는 대상이 하나이기 때문이다.** 셋 다 지팡이 쥔 팔의 위치 문제라, 「팔을 앞으로」와 「팔이 지팡이를 다시 쥐게」는 같은 팔에 대한 한 가지 지시로 묶인다.

```
Using this exact same 4-view turnaround sheet as the reference, redraw the same
character in the same four views — front view, back view, left side view, right
side view — changing only the arm that holds the staff.

In the left side view and in the right side view her staff arm hangs at the
middle of her body, so the staff now stands level with or behind her other hand.
In both of these two views move that whole staff arm forward, toward the
direction she is facing, until the staff is the frontmost thing about her:
the staff stands clearly in front of her other hand, there is visible empty
space between the staff and that other hand, and no part of her reaches further
forward than the staff.

Her staff arm stays the arm nearer to the viewer and stays drawn in front of her
torso, complete and unbroken from shoulder to hand. Her elbow stays nearly
straight, the staff stays vertical, and she keeps holding it at the same height
on the shaft as now.

In the back view her staff hand has let go of the staff, so the staff now stands
on its own beside her. Put it back into her hand: in the back view her staff
hand holds the shaft again, with the shaft passing through her curled fingers,
and the staff stays vertical and stays where it is on the ground.

In every one of the four views there is clear empty background space between her
two hands. They do not touch and they do not overlap, and the outline of each
hand is complete and visible on its own.

Her other arm and hand do not change at all: that elbow stays bent, that forearm
stays up, and that hand stays in front of her belly at waist height with its
fingers softly curled.

The front view does not change.

Everything else must stay exactly the same: the same face and the same facial
features, the same completely bald head with bare scalp skin and no hair at all,
the same skin tone, the same clothes and their colors, the same fingerless
gloves, the same boots, the same four-head-tall proportions, the same standing
pose of her legs, the same scale, the same position inside the frame and the
same ground line in all four views. Do not redraw her, do not resize her, do not
move her, and do not lengthen or shorten her legs.

All four views must stay the same size as each other, exactly as they are in the
reference.

She keeps her staff. Plain flat gray background, the same gray as the reference.
Do not include any second staff, wand, rod, stick, sword, shield, weapon, tool,
hat, hood, cap, headband, wig, fire, glow, particles or ground shadow. No frame,
no border, no text, no watermark. Only one character.
```

**판정 다섯을 본다.** 측면 두 장에서 지팡이가 보조 손보다 앞에 서고 둘 사이가 떨어져 있는가, 뒷모습에서 지팡이가 손에 쥐어져 있는가, 네 방향 모두 두 손이 서로 안 겹치는가, 보조 손과 다리 자세가 안 바뀌었는가, 네 인물의 크기가 그대로인가.

### 5.6 3번 — 왼쪽 패널을 반전으로 채웠다 (유료 아님)

2번 컷은 오른쪽 패널을 요구대로 냈지만 **왼쪽 패널이 통째로 무너졌다** — 지팡이가 사라지고, 쥔 팔이 다시 뒤로 갔고, 보조 손이 아래를 향했다. 여기서 컷을 하나 더 태우는 대신 반전을 썼다.

**근거는 역할 기준 슬롯 자체에 있다.** 측면 두 장이 둘 다 쥔 팔을 화면 가까운 쪽에 두므로 두 패널은 서로 거울상이고(실행 지침 §7.1), 오른쪽이 맞았다면 왼쪽은 그것을 뒤집은 것이다. 실측으로도 좌우 트림 가로 차가 **0.0%**로 떨어졌다 — 첫 회차에서 16.0%(110 대 131)를 내던 자리다.

**이 길을 고른 이유가 하나 더 있다.** 편집 회차는 컷마다 시트 전체를 다시 그려서 **인물을 4~5% 줄이고 지시하지 않은 패널을 흔든다**(실행 지침 §8.2.5에 세 회차 실측이 있다). 반전은 그 둘을 겪지 않는다.

산출물은 `art-source/player/2026-08-24/4dir_bald_mirrored.png`이고, 도구는 `tools/art/MirrorPanel.ts`다. 시트를 레포에 두는 것만으로는 모자라서 도구도 함께 둔다 — 검사망 밖의 스크립트가 사라진 전례가 실행 지침 §8.4에 있다.

## 6. 판정 항목 — 손에 세 줄을 새로 건다

실행 지침 §5.4와 §7.2의 기존 항목은 그대로 돌린다. 여기에 손 쪽 조건 셋을 더한다. 지침 §8.2는 지금 「손이 펴지면 안 된다」 한 줄만 걸어 뒀는데, 목적이 v2 밑판이라면 그 한 줄로는 부족하다.

1. **쥔 오른손이 반쯤 열려 있을 것.** 지팡이를 지우라고 하면 모델이 손을 주먹으로 닫아 버릴 수 있다. 닫힌 주먹이 나오면 v2에서 어떤 무기도 그 손을 통과하지 못하고, 그때는 손을 다시 뽑는 수밖에 없다. 반대로 손이 펴져 버리면 무기를 얹었을 때 쥐지 않고 통과하는 것처럼 보인다. 양쪽을 다 막는다.
2. **손가락이 살아 있을 것.** 지금 시트의 장갑이 핑거리스라 손가락이 밖으로 나와 있고, C' 시트의 맨손이 v2 장갑 스킨의 밑판이 된다. 손가락이 뭉치면 그 밑판이 없어진다.
3. **손이 몸통이나 옷에 붙어 뭉개지지 않을 것.** 리깅에서 손을 별도 파츠로 떼야 하므로 손과 이웃 부위 사이에 경계가 보여야 한다.

**첫 항목이 왜 「반쯤 열림」인지를 남겨 둔다.** v2에서 무기와 장갑이 각각 여러 종류가 되면 쥔 손 모양을 어디에 둘지가 갈리는데, 이번에 뽑는 손이 그 선택을 사실상 고정한다. 세 갈래가 있다.

| 방식 | 무슨 뜻인가 | 텍스처 수 |
|---|---|---|
| **① 손 모양 고정, 무기가 겹쳐 지난다** | 오른손은 항상 반쯤 쥔 모양, 왼손은 항상 편 모양. 무기가 그 위를 지난다 | 스킨 × 손 2 |
| ② 무기별 손 어태치먼트 | 무기 종류마다 쥔 손을 따로 그려 슬롯에서 골라 쓴다 | 스킨 × 무기 × 손 2 |
| ③ 무기 텍스처에 손 포함 | 무기 하나에 쥔 손 하나가 함께 그려진다 | 무기 × 1 |

**이 프로젝트는 ①이 맞다.** Spine Essential에는 메시·웨이트가 없어 파츠가 강체로만 움직이므로 손이 어차피 휘지 않고, ②는 무기를 하나 추가할 때마다 모든 스킨의 손을 다시 그리게 만들어 스킨 판매라는 v2 목표와 정면으로 부딪히며, ③은 장갑 스킨이 손에 안 먹어 상품 자체를 죽인다. 스킨 20개와 무기 10종을 가정하면 ①이 40장, ②가 400장이다.

①이 성립하려면 손잡이가 손 구멍보다 가늘어야 하는데, 망치도 검도 손잡이는 가늘고 굵어지는 것은 머리와 날이라 대개 만족한다. **한계는 정직하게 남긴다** — v2에서 손잡이 자체가 통나무처럼 굵은 무기를 넣고 싶어지면 그때는 손을 다시 뽑는다.

손 **위치**는 지금 고정되지 않는다. 리깅이 손을 별도 파츠로 떼면 팔 뼈를 돌려 자세를 만들고 무기가 손 뼈를 따라가므로, 무기를 치켜드는 자세도 다시 뽑지 않고 만들 수 있다. 굳는 것은 모양이고, 자유로운 것은 위치다.

방식 ①을 v2 정책으로 확정하는 것은 이 슬라이스가 하지 않는다. 리깅 슬라이스가 실제 파츠를 보고 정하도록 백로그 항목으로 세우되, **항목이 미결 하나를 이름으로 들어야 한다** — art-direction §6의 층 표는 `지팡이`에 층 하나만 주므로 무기가 손 전체 앞이거나 뒤일 뿐이고, 손가락 일부가 무기 앞으로 오는 자리가 없다.

### 6.1 이 항목들이 못 잡은 것 넷 (2026-08-24 사용자 검증)

7단계에서 사용자가 열두 장을 눈으로 보고 결함 넷을 찾았다 — 눈 흰자가 통째로 투명(두 장), 뒷모습의 쥔 손이 손가락을 편 손으로 바뀜(세 시트 전부), 맨살 판 왼쪽에서 지팡이 쥐던 팔이 어깨부터 누락, 맨살 시트만 인물이 6% 작게 그려짐. **넷 다 위 세 항목과 §8의 자동 검증을 통과한 상태였다** — 어긋난 것은 그 판정들이 안 보는 자리였고, 그래서 넷 다 사람이 눈으로 찾았다. 실측과 막는 방법, 아직 안 고친 것은 [`staff-layer-test.md`](../../qa/staff-layer-test.md) §7이 들며 여기 되풀이하지 않는다.

**넷 중 셋은 시트를 다시 뽑아야 닫히고, 그 재생성을 이 슬라이스가 한다**(§5.2 — 2026-08-24 사용자 결정으로 다음 슬라이스에서 끌어왔다). 코드가 한 일은 다음 회차가 같은 자리에서 걸리게 만드는 것이고(생성 판정 두 줄과 출하 관문 둘), 그 회차가 바로 이어진다. 넷째(눈 흰자 투명)는 매팅이 뚫는 구멍이라 재생성으로도 또 날 수 있고, 그때는 알파 뷰어로 발견해 다시 판단한다.

### 6.2 양손 장비가 정해졌다 — 그래서 손 위치 요구가 바뀐다 (2026-08-24)

위 문단이 리깅 슬라이스로 넘긴 미결 위에 같은 날 사용자 결정 넷이 얹혔다.

- **보조 손에도 장비를 들린다**(방패·책).
- **그 보조장비를 손을 가리는 방패 형태로 통일한다** — 다른 캐릭터에도 범용으로 쓰려는 것이다. 방패가 손을 통째로 덮으므로 그 밑의 손 모양은 화면에 안 나오고, 위 문단이 남긴 「손가락 일부만 무기 앞으로 오는 자리가 없다」 미결이 보조 쪽에서는 닫힌다. **남는 것은 주무기 손 하나다.**
- **주무기를 화면 가까운 쪽에 둔다** — 주무기가 보조장비보다 화려하고 크게 보여야 하는 물건이라, 몸에 가리는 자리에 세우면 그 값이 화면에서 사라진다. 현행 열두 장은 좌우 **둘 다 쥔 팔이 먼 쪽**이라, 이것이 다음 회차에서 실제로 바뀌는 항목이다.
- **방패는 판정에 안 들어간다** — 이름이 방어를 뜻하지만 피격 사각형은 `player.json` 고정값 그대로이고, 방패 쪽에서 오는 피해를 깎는 별도 판정도 두지 않는다.

**앞뒤를 오가는 단위는 아이템이 아니라 팔 한 벌이다.** `팔(살)`·`소매`·`장갑`·`손`·`아이템`이 함께 움직여야 한다 — 아이템만 몸 앞으로 보내면 무기는 몸 앞인데 그것을 쥔 손은 몸 뒤라, 팔이 몸통을 관통한 그림이 된다.

**그래서 슬롯을 해부학이 아니라 역할로 나눈다.** 측면 두 장에서 쥔 팔이 좌우 같은 쪽이면, 해부학적으로는 방향마다 다른 손이 무기를 들고 있는 셈이 된다. `왼팔`·`오른팔`로 이름 붙이면 방향마다 어느 슬롯에 무기가 붙는지가 갈리지만, `무기 팔`·`보조 팔`로 붙이면 그리기 순서가 방향과 무관하게 하나로 고정된다. 층 표를 실제로 그렇게 가르는 일은 리깅 슬라이스가 실물 파츠를 보고 하며, 그 미결은 백로그 `F103`이 든다.

**해부학 기준을 실제 시트로 놓고 견준 뒤 역할 기준을 유지했다(2026-08-24).** 방패가 늘 같은 팔에 붙는 참조 시트를 보면, 한쪽 측면에서는 방패가 온전히 보이지만 **반대쪽 측면은 역할 기준과 똑같이 몸 뒤**다. 얻는 것이 네 방향 중 하나뿐인데 대가로 그리기 순서를 방향마다 따로 박아야 하고, **그 순서 바꾸기가 Spine Essential에서 되는지는 아직 확인되지 않았다**(`F103`의 열린 항목). 안 되면 방향마다 별도 스킨으로 우회해야 해서 공수가 크게 뛴다. 대신 보조 손을 배 앞으로 올려(§5.4) **두 측면 모두에서** 방패 앞부분이 보이게 한다.

**보조 손 모양도 같은 날 함께 정해졌다.** 살짝 오므린 모양으로 받는다. 처음에는 「v1 화면에서 어색하다」가 근거로 적혔고 그 근거만 보면 이 트랙의 기준이 아니지만(v1 외형은 스킨이 덮는다), **v2 근거가 따로 선다** — 그 손은 장갑 스킨이 얹히는 밑판이고, 보조장비를 안 든 상태로도 나오며, 파츠로 잘려 리깅에 들어간다. 활짝 편 손으로는 방패 손잡이를 쥔 모양이 안 되고, **손 모양은 리깅이 못 고친다**(위치는 팔 뼈를 돌려 만들지만 모양은 그림에 굳는다). 같은 이유로 손이 엉덩이나 몸통에 가려서도 안 된다 — 가려진 부분은 그려진 적이 없어 파츠에 구멍으로 남는다(실행 지침 §2.0).

## 7. 무엇을 만드나 — 정렬 함수 손질과 출하 실행기

### 7.1 정렬 기준을 발에 묶는다

§4.3이 정한 두 규칙을 `Postprocess.ts`에 넣는다. 바닥은 「한 줄에서 20px 이상 이어지는 구간이 있는 가장 아래 행」을 찾아 거기서 발끝까지 내려간 자리이고, 발 중심은 그 바닥에서 위로 겹치며 이어 붙는 구간만 본다. `alignToCanvas`는 이 둘을 기준으로 삼도록 부르는 쪽만 바꾼다.

**실행기보다 이것을 먼저 한다.** 아래 §7.2의 실행기가 5번에서 `alignToCanvas`를 부르기 때문이다. 나중에 고치면 이미 열두 장을 내보낸 뒤라 전부 다시 내보내야 하는데, 그 다시 내보내기가 유료 호출을 또 부르지는 않더라도(매팅 결과는 캐시에 있다) 교체본을 두 번 검수하게 만든다. 먼저 고쳐 두면 새 시트가 도착하기 전에 현행 열두 장만으로 값이 안 변하는 것을 확인할 수 있다(§8.1).

**`footCenterX`의 이름과 동작이 어긋난 것도 여기서 닫는다.** JSDoc은 「불투명 픽셀」이라 적는데 실제로는 `alpha !== 0`이라 알파 1도 센다(`F102` ②). 이 함수를 다시 쓰는 김에 동작을 이름에 맞춘다 — 알파 1~16은 `normalizeAlpha`가 0으로 누르기로 한 잡음이고, 실행기에서 정렬은 그 정규화 **뒤에** 오므로 규칙을 맞춰도 출력이 달라지지 않는다.

**이 규칙이 사는 곳은 함수의 JSDoc이다.** 화면에 안 드러나는 결정이라 문서가 아니라 코드가 정본이고, 「왜 바깥 상자가 아니라 이어 붙은 구간인가」를 거기 적는다. 안 적으면 다음 사람이 「한 줄 훑으면 될 것을 왜 이렇게 짰나」로 읽고 되돌린다.

### 7.2 출하 실행기가 이 슬라이스의 코드 덩어리다

**13장을 한 번에 처리해 파일로 내보내는 실행기가 아직 없다.** 실행 지침 §8.1이 그것을 교체 슬라이스의 일로 적어 뒀고, `tools/art/judge.ts`도 판정용 크롭에 여백을 주지 않는 이유를 설명하면서 출하용 실행기는 F67이 붙인다고 남겼다. 지금 서 있는 것은 조각이다 — 패널 분할과 수치 출력은 `judge.ts`, 알파 정규화와 정렬은 `Postprocess.ts`의 함수, 매팅 호출은 `FalMatting.ts`다.

`tools/art/build.ts`를 새로 세워 이 조각들을 잇는다.

1. 시트를 열 단위로 넷으로 가른다(`panelColumns`)
2. **여백을 주고** 자른다(`cropColumns`의 `margin`). 판정용과 달리 출하용은 여백이 필요하다
3. 매팅에 건다(`FalMatting.matte`) — 시트 3장 × 4방향 = 12회 유료 호출
4. 알파를 정규화한다(`normalizeAlpha`)
5. 246×493 캔버스에 발 밑선 여백 3으로 정렬한다(`alignToCanvas`)
6. §8의 규격을 재서 전부 통과하면 열두 장을 **원자적으로** 쓴다. 한 장이라도 떨어지면 아무것도 쓰지 않는다 — 절반만 새 판인 상태가 가장 나쁘다

**이 실행기는 현행 시트로 먼저 세울 수 있다.** 입력이 지팡이 든 시트든 아니든 파이프라인은 같으므로, 사용자 생성을 기다리지 않고 앞 단계에서 만들고 캐시된 패널로 돌려 볼 수 있다.

**캐시가 돈이라 자리를 옮긴다.** `FalMatting`이 매팅 결과를 `docs/temp/matting-cache/`에 두는데, 그 폴더 규칙은 「스크립트로 다시 만들 수 있는 것만 둔다」이다. 지우면 재생성에 **실제로 돈이 든다.** 이번에 신규 유료 호출 열두 번이 그 폴더로 들어가므로, 백로그가 「⑤가 제일 먼저다」로 표시해 둔 이 항목을 이 슬라이스가 닫는다. 자리를 옮기거나 폴더 규칙에 예외를 적는다.

### 7.3 참조가 끊긴 브릿지 스프라이트를 지운다

`player_mage_bridge.png`는 4방향 스프라이트로 교체되면서 남은 자산이고 어느 씬·프리팹도 참조하지 않는다. 계획을 세울 때는 이것을 안 하는 쪽으로 미뤄 뒀는데, `F101`이 걸어 둔 「지우기 전에 Cocos가 참조 없는 자산을 빌드에 싣는지부터 확인한다」가 재던 것이 **안전이 아니라 우선순위**였기 때문이다 — 안 실으면 용량 문제가 아니라 정리 문제일 뿐이라 뒤로 미룰 근거가 된다는 뜻이었다. 2026-08-24에 사용자가 이번 PR에 넣기로 정해 그 저울질은 답이 났고, 남는 것은 안전 확인 하나다.

**참조가 0건인 것을 삭제 직전에 다시 확인했다.** UUID `a92ee894-3fc6-4fe9-b0fb-000a8b9fb808`으로 `game/`·`tools/`·`tests/`를 훑어 역참조가 없고, 파일명으로도 코드·씬·데이터에 걸리는 곳이 없다. 남은 언급은 전부 문서인데 그것은 지나간 기록이라 고치지 않는다([문서 참조 규칙](../spec/docs-references.md) §9).

**`player_staff.png`는 같이 지우지 않는다.** 참조가 없는 것은 같지만 이쪽은 **배선 대기**라 성격이 다르다 — 지팡이 노드 배선이 `F67`의 열린 축으로 남아 있다.

## 8. 테스트

`wf skip-test`를 쓰지 않는다. `game/assets/scripts/`는 안 건드리지만 실행기가 전부 순수 함수이고 교체하는 에셋에 규격이 있다. `tests/logic/StaffLayer.test.ts`가 넷을 든다.

### 8.1 정렬이 소품을 모르는지 재는 단언

**이것이 §4.3의 규칙을 지키는 단언이다.** 지팡이를 든 그림과 안 든 그림의 정렬 기준이 **같은 값**이어야 한다. 픽스처는 현행 열두 장과 거기에 `player_staff.png`를 합성한 열두 장이고, 합성이 순수 함수라 유료 호출도 새 에셋도 필요 없다.

| 합성 자리 | 현행 함수 | 새 기준 |
|---|---|---|
| 발 왼쪽 8px, 끝이 발 밑선 2px 위 | 발 중심이 8px 밀린다(122.5 → 114.5) | 안 움직인다(122.5 → 122.5) |
| 같은 자리, 끝이 발 밑선 3px 아래 | 바닥이 3px 내려간다(489 → 492) | 안 움직인다(489 → 489) |

**단언은 차가 0이고 허용 폭을 두지 않는다.** 값이 조금이라도 움직이면 그것은 소품이 판정에 새어 든 것이라 봐줄 여지가 없기 때문이다. 그리고 이 테스트는 지팡이 전용이 아니다 — 다음 소품이 같은 자리에 오면 합성할 PNG만 바꾸면 된다.

**이 단언이 첫 번째 RED 게이트를 만든다.** 현행 `Postprocess.ts`에서 실패하고, §7.1을 고치면 통과한다. 새 시트를 기다리지 않는다.

### 8.1.1 반대로 판정은 소품을 알아야 한다

정렬이 지팡이를 모르게 되면 「이 시트에 지팡이가 남아 있는가」를 정렬 값으로는 알 수 없다. 그건 실행 지침 §8.5의 육안 항목인데, 첫 판이 찾아낸 바깥 상자 방식이 그 자리에서는 그대로 쓸모가 있다. 옛 정의로 띠 폭 8과 32를 재서 비교한 값이다.

| 대상 | 띠 폭 8과 32의 발 중심 차 |
|---|---|
| 현행 지팡이 없는 12장 | **0.0 ~ 0.5** |
| 매팅 캐시의 지팡이 든 패널 6장 | **7.5 ~ 14.5** |

`|차| ≤ 3`으로 잡으면 통과 쪽 여유가 여섯 배, 차단 쪽 여유가 두 배 반이라 둘이 겹치지 않는다. **다만 이것은 정렬 기준이 아니라 판정 지표다** — 교체본이 정말 지팡이를 잃었는지 재는 데만 쓰고, `alignToCanvas`는 이 값을 보지 않는다. 그래서 자리도 `Postprocess.ts`가 아니라 판정 쪽(`judge.ts`가 부르는 지표)이다.

### 8.2 규격 회귀

- **희미한 알파(1~16)가 0px이다.** 실행 지침 §8.5와 같은 절대 기준으로 잡는다. §2.2대로 현행 열두 장이 0~4px이라 「현행 수준」을 기준선으로 쓰면 정본보다 느슨해지고, 새 실행기는 `normalizeAlpha`를 지나므로 이 값이 정의상 0이 된다. **이 단언이 RED 게이트를 만든다** — 현행 에셋에서 실패하고 교체본에서 통과한다
- **캔버스가 246×493이고 발 밑선이 y=489다.** 이 둘은 `alignToCanvas`가 출력에 강제하는 값이라 지팡이를 잡지 못한다. 그래도 남기는 이유는 **실행기가 올바른 캔버스·여백 인자로 돌았는지**를 재기 때문이고, 성격을 그렇게 적어 둔다
- **트림 높이가 490 이하다.** §2.2의 여유 2px을 지키는 상한이며, 넘으면 `alignToCanvas`가 던진다. 테스트가 예외보다 먼저 이유를 말해 준다
- **윤곽 후광은 이번에 기준선이 바뀐다.** 현행 값은 지팡이가 서 있던 자리를 캐릭터 윤곽 대신 재고 있어 머리 구간에서만 잰 값이다. 지팡이가 사라지면 전체 윤곽을 처음으로 재게 되므로 새 값을 기준선으로 기록하고 현행과 비교하지 않는다

### 8.3 실행기의 단위 테스트

`build.ts`가 부르는 순서와 실패 처리를 작은 합성 픽스처로 단언한다. 특히 **한 장이 규격에서 떨어지면 아무것도 안 쓰는지**를 본다. 이 스택에서 가장 비쌌던 버그가 예외도 경고도 없이 아무 일도 안 하고 반환하는 것이었다.

**지팡이 PNG 자체에는 회귀를 안 건다.** `player_staff.png`는 이번에 안 바뀌고, 몸의 발 밑선 489와 이을 값인 씬 오프셋은 배선을 안 하므로 존재하지 않는다.

## 9. 순서

phase를 병기한다. 상태 전이는 전부 `pnpm wf`로만 한다.

| # | phase | 하는 일 |
|---|---|---|
| 1 | `planning` | 사용자 `계획 승인` → `wf approve-plan` |
| 2 | `qa-setup` | `docs/qa/staff-layer-test.md` 작성 + `tests/logic/StaffLayer.test.ts`를 RED로 → `wf ready-impl` |
| 3 | `implementation` | `Postprocess.ts`의 정렬 기준을 발에 묶는다(§7.1). 합성 픽스처로 §8.1을 통과시킨다 — 여기서 첫 RED가 풀린다 |
| 4 | `implementation` | `tools/art/build.ts`를 세운다(§7.2). 캐시된 패널로 돌려 본다 |
| 5 | `implementation` | `F102` ⑤를 닫는다 — 매팅 캐시의 자리를 옮기거나 폴더 규칙에 예외를 적는다. 12회 유료 호출을 넣기 **전에** 한다 |
| 6 | `implementation` | 지팡이를 지우는 편집 프롬프트 셋을 써서 실행 지침 §8.2에 붙인다(§5.1) |
| 7 | **사람** | 사용자가 fal.ai Sandbox에서 A'·B'·C' 세 시트를 뽑는다. 판정은 §6 |
| 8 | `implementation` | `build.ts`로 열두 장을 만들어 원자적으로 교체하고 §8의 규격을 통과시킨다. `F102` ⑥의 산출물 셋이 이 실행기에서 쓰이는지 확인하고, 안 쓰이면 지운다 |
| 9 | `verification` | `wf start-verification` → QA 문서 확정 → 정본 갱신(`wf canon-done`) → `/cso` → `pass cso` → `pnpm typecheck` → `pass ts` → `pnpm check --write` → `pass lint` → 커밋 → 코드리뷰 → `pass review` |
| 10 | `user-verification` | Draft PR → 사용자가 Cocos를 열어 재임포트하고 인게임 확인 |
| 11 | `pr-ready` | 사용자 `PR 승인` → `wf approve-pr` |
| 12 | `done` | `gh pr ready` → squash merge → `wf pr-done` → gbrain 색인 갱신 |

**7번이 슬라이스 한가운데의 사람 게이트다.** 생성은 사용자가 하고 판정 기준만 이 문서가 준다. 컷이 §6에서 떨어지면 8번 이후가 대기하므로, 그 사이에 할 수 있는 3~6번을 전부 앞에 뒀다. 특히 3번과 4번은 현행 시트와 합성 픽스처만으로 세울 수 있어 대기 시간이 놀지 않는다.

**캔버스 여유 2px에 대비책을 미리 정해 둔다.** §2.2대로 트림 높이 상한이 490인데 현행 최대가 488이다. 교체본이 3px만 커도 8번이 정지한다. 그때는 `bottomMargin`을 3에서 1로 내려 2px을 산다. 그보다 더 커지면 캔버스를 키워야 하는데 246:493 종횡비가 48:96과 맞물려 있어 정본 변경이므로, 그 경우에는 8번에서 결정하지 말고 멈추고 보고한다.

**`.meta`가 이 슬라이스의 조용한 함정이다.** `player_4dir_front.png.meta`의 서브에셋이 `trimX 18 / trimY 2 / width 215 / height 488 / rawWidth 246`을 굽고 있고 `main.scene`이 그 서브에셋을 UUID로 참조한다. 픽셀을 바꾸면 Cocos가 재임포트하면서 이 값을 다시 계산하는데, `pnpm wf check-meta`는 `git ls-files` 기준 **미추적** `.meta`만 보므로 **수정된 `.meta`는 어느 게이트에도 안 걸린다.** 커밋에서 빠지면 장비마다 다른 값이 남는다. 10번에서 사용자가 에디터를 연 뒤 `git status`로 수정된 `.meta`를 직접 확인하고 함께 커밋한다.

**신규 `.meta`는 0개여야 한다.** 열두 장이 전부 기존 파일을 덮어쓰는 것이라 새 자산이 없다.

**리워크로 한 바퀴 더 돈다(2026-08-24).** 10번에서 사용자가 결함 넷을 찾았고(§6.1) 같은 날 손 위치 요구가 바뀌어(§6.2), `wf rework`로 구현에 복귀했다. 두 번째 바퀴는 6번(실행 지침에 손·팔 유지 문단을 박는다) → 7번(§5.2의 다섯 컷) → 8번(새 시트 폴더로 `build.ts` 재실행) → 9번 이후 그대로다. `crossItemViolations` 위반이 0이 되는 시점에 QA 문서가 미뤄 둔 회귀 단언도 함께 들어간다.

## 10. 정본을 어떻게 고치나

§8.2에 손 조건 셋과 편집 프롬프트 셋을 넣는 것 외에, **Trim 전제가 낡은 자리 셋을 함께 고친다.** 한 곳만 고치면 나머지가 낡은 채로 남아 다음 사람이 어느 쪽을 믿을지 모르게 된다.

- **사양서 §3.3** — 지팡이가 트림 상자를 넓혀 중심을 민다는 인과가 두 번 낡았다. Sprite Trim을 끄면서 기준이 트림 상자에서 정렬 함수로 옮겨 갔고, 이번에 그 정렬 함수가 발만 보게 되면서 **지팡이가 중심을 미는 일 자체가 없어진다**. 「소품은 정렬에 영향을 주지 않는다」로 다시 쓰고, 어떻게 그렇게 되는지는 함수 JSDoc으로 넘긴다(§7.1)
- **사양서 §3.2** — 첫 줄이 「Trim이 켜져 있어 상자를 채우는 것이 여백을 뺀 내용이기 때문이다」이고 표시 크기 계산이 트림 종횡비 기반이다. 지금은 캔버스 기준이다
- **실행 지침 §8.7** — 산문은 「Trim을 껐으면 그건 캔버스」로 고쳐져 있는데 같은 절의 표가 여전히 `표시 크기(Content Size) | 트림 상자 종횡비`다. 한 절이 자기 자신과 어긋나 있다

**같은 문서의 §8.8도 함께 고친다.** 배선은 이번에 안 하지만, §8.8이 그리기 순서의 기본을 「몸 뒤」로 적어 둔 것이 **구조적으로 불가능**하고 근거도 성립하지 않는다. 리깅 슬라이스가 그대로 따라가면 막힌 길로 들어가므로 지금 고친다.

- Cocos 3.8 매뉴얼이 노드 트리 렌더 순서를 이렇게 적는다.

  > Nodes lower in the list will occlude nodes higher in the list, and **child nodes will always cover their parent nodes.**
  >
  > — [Cocos Creator 3.8 매뉴얼, Node Tree](https://docs.cocos.com/creator/3.8/manual/en/concepts/scene/node-tree.html)

  형제 순서는 형제끼리만 정렬하는데, `Player` 노드는 몸 `cc.Sprite`를 자기 자신에 달고 있어 자식으로 넣은 지팡이는 언제나 몸 앞이다.
- §8.8이 든 근거 하나인 「잘라 낸 자리에 손이 가렸던 빈 구간이 남아도 그 손에 가려진다」도 성립하지 않는다. `player_staff.png`는 395행 전부에서 가로로 끊긴 데가 0개라 숨길 빈 구간이 없다.
- art-direction §6의 층 표는 이미 `지팡이`를 5층, `신발·장갑`을 4층에 두어 지팡이가 손 앞이다. 「항상 몸 앞」으로 고치면 두 정본이 맞는다.

**손 위치 요구가 늦게 정해져 고칠 자리가 셋 늘었다(2026-08-24).** §6.2의 결정이 바꾸는 것은 생성 프롬프트이므로 실행 지침이 먼저 받는다.

| 문서 | 무엇이 들어가나 |
|---|---|
| 실행 지침 §7.1·§7.2·§8.2.1 | 측면 두 장에서 쥔 팔이 화면 가까운 쪽이라는 프롬프트 한 줄과 그것을 재는 판정, 빈 손을 살짝 오므린 모양으로 받는다는 프롬프트 한 줄과 그것을 재는 판정 |
| 실행 지침 §8.8 | 보조 손에 들릴 방패도 판정 밖이라는 것과, 층 표 미결의 절반이 닫힌 것 |
| [판정 규칙](../spec/game-combat.md) §3 | 방패도 「장비는 외형만 바꾼다」의 예외가 아니라는 명시. 규칙은 이미 방패를 덮지만 이름 때문에 예외로 읽힐 여지가 있다 |

**비워 뒀던 자리 하나를 재생성 직전에 채웠다.** 실행 지침 §8.2.2의 편집 지시문 셋에는 이 손 요구가 없었다. 지시문은 턴어라운드에서 받은 손을 **유지**시키는 자리라 §7.1이 먼저 서야 문장이 정해지는데, 그 §7.1이 위 표에서 섰다. 그래서 세 지시문 전부에 쥔 팔이 화면 가까운 쪽이라는 문단과 빈 손이 오므린 모양이라는 문단을 박았다 — 「같은 자세, 같은 팔 위치」라는 포괄 문장은 이미 들어 있었는데도 세 시트 모두 뒷모습의 쥔 손이 편 손으로 바뀌었으므로(§6.1), **이름을 불러 주는 문장이 따로 필요하다.**

## 11. 이번에 하지 않는 것

- **지팡이 노드 배선.** §1이 이유를 든다. `F67`의 배선 축이 열린 채로 남아 리깅 슬라이스로 간다.
- **나머지 다섯 파츠의 컷.** 인페인팅 범위를 실측해야 정해지므로 `F59` ①이 든다.
- **`hurtboxHalfWidth` 반영.** 지금 `player.json`이 18이고 2026-08-07 실측이 10.9였다. 맞는 면적이 절반으로 주는 밸런스 변경이라 사양서 §12가 `F66` ③으로 라우팅해 뒀다. 이 슬라이스는 교체본에서 다시 재서 숫자를 기록만 하고 값은 안 바꾼다.
- **마법 발사 원점 이전.** 발사 앵커는 실행 지침이 리깅 트랙의 슬롯으로 잡아 둔 항목이다.
- **`F102`의 ①③④.** ①은 항목의 전제가 절반 틀렸다 — `cropColumns`가 음수 구간과 범위 초과는 이미 던지고, 실제로 새는 것은 **비정수 구간**과 **음수 `margin`**이다. 이 슬라이스의 실행기가 `panelColumns` 결과를 그대로 쓰면 그마저 안 걸리므로 항목의 서술을 고쳐 남기고 닫지 않는다.

