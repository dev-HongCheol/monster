
# QA 체크리스트 — 플레이어(불 마법사) 브릿지 스프라이트 교체

- **브랜치:** feat/player-mage-art
- **계획:** [`../development/sessions/2026-07-22-player-mage-art-plan.md`](../development/sessions/2026-07-22-player-mage-art-plan.md)
- **성격:** 아트/에셋 + 에디터 교체 슬라이스. 순수 로직 변경 없음(자동 테스트 skip). 검증은 전부 에디터 조립 + 인게임 육안.
- **정본:** [`../design/art-direction.md`](../design/art-direction.md) §6

---

## Impact Map (회귀 확인 범위)

| 변경 | 확인 범위 |
|------|-----------|
| `main.scene` `Player` 노드의 `Sprite` `_spriteFrame`·`_color`, `UITransform` `_contentSize` | 플레이어 렌더(그림·크기·정렬). **게임플레이(이동·충돌·픽업·카메라)는 무변경이어야 함** — `player.json` 값과 `playerNode.position`만 읽으므로 아트 교체가 영향 주면 안 됨(회귀 신호) |
| 신규 마법사 PNG 임포트(`game/assets`) | 다른 씬/프리팹 참조 없음(플레이어 전용). |

## 씬 변경 사항

`main.scene` > `Player` 노드(`_name: "Player"`, 레이어 DEFAULT):
- `Sprite._spriteFrame`: 기본 placeholder(`57520716…@f9941`) → **신규 마법사 스프라이트프레임**
- `Sprite._color`: 파랑(r0 g100 b255) → **흰색(255,255,255,255)** (그림 원색이 그대로 나오도록)
- `UITransform._contentSize`: 50×50 → **아래 조립 레시피의 값** (종횡비 보존)
- `Player._lscale`: **(1,1,1) 유지** (노드 스케일로 크기 조정 금지)

## 에디터 조립 레시피 (구체 수치 — 순서대로)

> 사이징을 임의 배치로 떠넘기지 않는다. 아래 규칙대로 계산해 넣는다.

1. **PNG 임포트** — 클린업한 투명 마법사 PNG를 **`game/assets/art/player/player_mage_bridge.png`**로 넣는다(아트가 처음 들어오므로 `art/player/` 폴더 신설). 정적 씬 할당이라 `resources/`가 아니다(런타임 `resources.load` 대상만 거기 둔다). Inspector에서:
   - Type = **sprite-frame**
   - Filter Mode = **Bilinear** (2배 소스가 깨끗이 다운스케일되도록)
   - Alpha 프리멀티플라이 = **끔(straight alpha)** (엠버·발광 엣지 헤일로 방지)
   - Mipmap = 끔(2D 고정 카메라라 불필요)
2. **스프라이트프레임 바인딩** — `Player` > `Sprite` 컴포넌트의 `SpriteFrame` 슬롯에, 임포트된 에셋의 **스프라이트프레임 서브에셋**(`<uuid>@<sub>`)을 드래그. **Texture2D를 넣지 않는다**(펼쳐서 하위 spriteFrame을 집는다).
3. **색 초기화** — `Sprite` > Color = **흰색**(255,255,255,255).
4. **크기(contentSize)** — `UITransform`:
   - 종횡비는 소스 그대로. 소스가 `W×H`면 `contentSize`도 그 비율(`W':H' = W:H`).
   - **몸통 코어 실루엣(모자·로브 넘침 제외)이 대략 지름 50px**(= `collisionRadius 25` × 2)에 오도록 전체 크기를 잡는다. 마법사는 전신이라 모자 끝·로브 자락은 50px 밖으로 넘쳐도 된다(그 부분은 비충돌).
   - **확정 (채택 이미지 `player_mage_bridge.png` = 788×1012, 사용자 설정 2026-07-22): `contentSize = 50 × 64`** (종횡비 788:1012 ≈ 0.78 보존). **작게 잡는 이유:** 충돌이 단일 원(지름 50px = `collisionRadius 25` × 2)이라, 캐릭터를 히트박스 크기 정도로 작게 두면 원이 캐릭터를 거의 감싸 위아래 어긋남이 몇 px로 사라진다(원래 50×50 placeholder 스케일 복귀, VS·Brotato 방식). 크게 그리면 원이 몸통 밴드만 덮어 위아래가 안 맞는다. 비율 유지한 채 눈으로 미세조정(예 44×56 ~ 54×69). 반드시 contentSize로 조정하고 노드 스케일은 (1,1,1) 유지. 정본: `../design/art-direction.md` §3.3.
5. **노드 스케일 금지** — 크기는 오직 contentSize로. `Player` 노드 `Scale`은 (1,1,1) 그대로. (노드 스케일을 주면 리깅 때 같은 노드의 `ArmatureDisplay`로 이월돼 숨은 재작업이 됨.)
6. **피벗 정렬** — PNG를 캐릭터의 의도한 피벗(발밑 또는 몸 중심) 기준으로 생성해, 앵커(0.5,0.5)·트림 중심이 노드 원점과 맞게 한다. 어긋나면 그림이 논리 위치에서 밀려 보인다.

## 에디터 연결 체크리스트

| 대상 | 값 | 상태 |
|------|-----|------|
| `Player` > `Sprite` > `SpriteFrame` | 신규 마법사 스프라이트프레임(서브에셋) | ❌ → 사용자 |
| `Player` > `Sprite` > `Color` | 흰색 255,255,255,255 | ❌ → 사용자 |
| `Player` > `UITransform` > `Content Size` | **50 × 64** (작은 캐릭터 = 원 히트박스 크기, 종횡비 788:1012 보존) | ✅ 설정됨(2026-07-22) |
| `Player` > `Scale` | (1,1,1) 유지 | ❌ → 사용자 |

## 수동 테스트 체크리스트

- [x] 게임을 켜면 플레이어가 **파란 상자가 아니라 마법사 그림**으로 보인다.
- [x] 그림이 **정사각으로 눌리지 않았다**(종횡비 정상).
- [x] 그림이 논리 위치에 **정렬**돼 있다(적 접촉·피격 지점이 그림 중심과 어긋나지 않음).
- [x] **엠버/발광 엣지 알파가 깔끔**하다(검은 테두리·잘린 반투명 없음).
- [x] 스타일이 **F58b 애니 셀 룩**과 일치한다.
- [x] **게임플레이 불변 확인:** 이동 속도, 적과의 충돌 판정, 경험치 픽업 반경이 교체 전과 동일하다(그림만 바뀌고 수치 무변경).
- [x] 카메라가 플레이어를 그대로 따라간다.

## 자동 테스트

- **skip** — 순수 로직 `.ts` 변경이 없다(스프라이트는 씬에 정적 할당, `PlayerController` 무변경, 충돌·픽업은 `player.json` 데이터). 단언할 순수 함수가 없어 테스트는 연극이 된다. 사유는 `pnpm wf skip-test`로 기록.

## 참고 (다음 슬라이스로)

- 이 스프라이트 교체는 **리깅 슬라이스에서 `ArmatureDisplay`로 대체**되며 버려진다(계획 §6). 브릿지 스프라이트다.
- 7단계 Draft PR의 씬 diff는 아직 커밋 안 된 이미지/`.meta`의 UUID를 참조한다 — 워크플로우상 정상(Cocos가 7단계에 `.meta` 생성, 8단계 커밋). dangling 참조 아님.
