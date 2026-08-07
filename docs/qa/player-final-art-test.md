# 플레이어 최종 아트 씬 반영 — 테스트 문서

- **브랜치:** `design/art-decision-audit` (PR #74)
- **성격:** 플레이어 4방향 **최종 아트**를 씬에 반영하는 변경의 검증 문서다. 방향 전환 로직 자체는 `feat/player-4dir`이 이미 구현·검증했고([`player-4dir-test.md`](player-4dir-test.md)), 여기서 바뀌는 것은 **그 로직이 물고 있는 그림과 노드 상자**뿐이다.
- **선행:** 그림을 뽑고 다듬은 절차와 실측은 [`sessions/2026-08-07-player-4dir-postprocess.md`](../development/sessions/2026-08-07-player-4dir-postprocess.md), 규격 정본은 [`asset-production-spec.md`](../design/asset-production-spec.md).

> **이 문서는 이 슬라이스의 시점 기록이다.** 다음 슬라이스가 같은 노드를 또 건드리면 그때는 이 문서를 고치지 않고 새 문서를 만든다(`CLAUDE.md` 「문서 정리 규칙」).

---

## Impact Map

| 변경 | 확인 범위 |
|---|---|
| `game/assets/art/player/player_4dir_{front,back,left,right}.png` | 네 방향 그림이 전부 최종 아트로 교체됐다(파일명 유지 = UUID 유지 = 씬 연결 유지). 방향 전환이 여전히 맞는 그림을 띄우는지 |
| `game/assets/art/player/player_staff.png` (신규) | 아직 씬에 연결하지 않는다. 배선은 **F67**. 여기서는 임포트만 확인 |
| `main.scene` `Player > UITransform` | Content Size 변경 → 표시 크기·비율. 판정에는 영향 없음(`player.json` 고정값, [ADR 007](../decisions/007-skin-hitbox-independence.md)) |
| `main.scene` `Player > Sprite` | Trim 해제 → 노드 원점 위치. **방향 전환 시 가로 미끄러짐 회귀 지점** |

**회귀로 봐야 할 것.** 그림 교체는 판정 수치를 건드리지 않으므로 전투 밸런스는 대상이 아니다. 반면 **노드 상자와 원점이 바뀌므로 이동·표시가 대상**이다.

---

## 씬 변경 사항 (확정 — 커밋된 `main.scene` 기준)

```
Canvas
 ↳ Player
    · cc.UITransform   Content Size 48×96, Anchor (0.5, 0.5)
    · cc.Sprite        Size Mode CUSTOM, Trim 해제, SpriteFrame = player_4dir_front
    · PlayerController Frame Front/Back/Left/Right (기존 연결 유지)
```

| 항목 | 이전 | 이번 | 왜 |
|---|---|---|---|
| Content Size | 72×96 | **48×96** | 72는 플레이스홀더 시절 **캔버스** 종횡비(0.75)로 계산한 값이라 캐릭터가 가로로 약 1.7배 늘어난 채 렌더되고 있었다. 최종 아트 캔버스는 246×493이고 표시 가로는 **지팡이를 뺀 몸** 기준으로 나온다 |
| `Sprite` Trim | 켜짐 | **해제** | 켜 두면 노드 상자가 트림된 픽셀에 맞는데, 머리카락이 뒤로 흘러 **측면 두 장의 트림 상자를 23px씩 반대 방향으로 민다**. 그러면 좌·우를 오갈 때 캐릭터가 가로로 9단위쯤 미끄러진다 |
| `Sprite` SpriteFrame | `player_mage_bridge` | **`player_4dir_front`** | 에디터 뷰포트 미리보기용이다. 인게임 첫 프레임은 `onLoad()`가 `_facing` 기준으로 덮어쓰므로 동작에는 영향이 없고, 에디터에서 실제와 다른 그림이 보이던 것을 맞춘 것이다 |

**Trim을 끌 수 있는 전제는 후처리가 만들었다.** 네 장이 같은 캔버스(246×493)에 같은 발 밑선(y=489)·같은 발 중심으로 정렬돼 있어서, 상자를 캔버스로 고정하면 원점이 항상 몸 중심에 온다. 정렬이 안 맞는 그림에 Trim만 끄면 이번엔 그림이 상자 안에서 제각각 앉는다.

가로 기준을 발 중심으로 잡은 이유는 머리카락이 비대칭이라 트림 중심을 쓸 수 없고, 발이 캐릭터가 실제로 서 있는 자리이자 `FootprintLogic`이 판정에 쓰는 지점이기 때문이다.

| 뷰 | 트림 상자 | 트림 중심 − 발 중심 |
|---|---|---|
| front | 216×488 | −2.5px |
| back | 210×487 | −2.0px |
| **left** | 194×483 | **−23.0px** |
| **right** | 194×483 | **+23.0px** |

---

## 에디터 연결 체크리스트 (확정 — 적용 후 커밋됨)

| # | 작업 | 상태 |
|---|------|------|
| 1 | 네 방향 PNG가 임포트되고 각 파일 아래 `spriteFrame` 서브에셋이 생겼다(파일명을 덮어썼으므로 UUID와 기존 연결은 그대로) | ✅ |
| 2 | `Player > UITransform` Content Size **48×96**, Anchor (0.5, 0.5) | ✅ |
| 3 | `Player > Sprite`의 **Trim 체크 해제** | ✅ |
| 4 | `Player > Sprite`의 SpriteFrame에 **front** 프레임 | ✅ |
| 5 | `Sprite` Size Mode가 **CUSTOM** 유지 | ✅ |
| 6 | `PlayerController`의 Frame 슬롯 넷이 방향과 맞게 유지됨(재연결 불필요 — 파일명을 덮어썼다) | ✅ |
| 7 | `player_staff.png`가 임포트됐다. **씬에는 연결하지 않는다**(F67) | ✅ |

> 2·3·4는 사용자가 Cocos에서 적용해 `main.scene`으로 커밋했다. 생성된 `.meta`도 함께 커밋했다(`player_staff.png.meta` — PNG가 추적 중인데 `.meta`가 빠져 있어 `pnpm wf check-meta`가 잡았다).

---

## 수동 테스트 체크리스트 (인게임)

**Trim 해제가 노린 것 — 이 둘이 이번 변경의 핵심이다**

- [ ] 좌 → 우, 우 → 좌로 방향을 바꿀 때 캐릭터가 **가로로 미끄러지지 않는다**. Trim이 켜져 있었다면 여기서 9단위쯤 튄다
- [ ] 인물 비율이 정상이다 — **가로로 늘어나 보이지 않는다**. `feat/player-4dir` 시점에는 늘어나 보이는 것이 알려진 상태였고(트림 상자 종횡비 0.435를 0.75 상자에 채웠다), 48×96 + Trim 해제가 그걸 닫는다

**회귀 — 방향 전환 로직 자체는 그대로여야 한다**

- [ ] 위·아래·좌·우로 걸을 때 각 방향에 맞는 그림이 뜬다(위 = 뒷모습, 아래 = 정면)
- [ ] 걷다 멈추면 마지막으로 보던 방향을 유지한다
- [ ] 방향이 바뀔 때 **발 높이가 그대로**다(네 장의 발 밑선 정합)
- [ ] 대각선으로 걸으면 좌우 그림으로 읽힌다

**크기 감각**

- [ ] 48×96이 화면에서 적절하다 — 적과 견줘 너무 작거나 크지 않다. 어긋나면 고칠 곳은 Content Size 가로이고, 캔버스나 후처리 정렬이 아니다
- [ ] 그림이 상자 밖으로 잘리지 않는다

---

## 이 문서가 다루지 않는 것

- **`hurtboxHalfWidth` 재조정** — 실측 10.9(현재 18)이지만 맞는 면적이 반으로 주는 밸런스 변경이라 **F66 ③**과 묶어 따로 판단한다. 이번 변경은 표시만 건드린다.
- **지팡이 배선** — 방향별 위치 오프셋·z 순서·표시 크기는 **F67**이다.
- **판정 수치 일반** — 스킨·그림과 무관하게 `player.json` 고정값이다([ADR 007](../decisions/007-skin-hitbox-independence.md)).
