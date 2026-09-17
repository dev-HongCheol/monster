# 3D 캐릭터 2라운드 G2 — 판정에 쓴 그림

2026-09-15 ~ 2026-09-17 G2(툰 · 가림 · 외곽선 · 고도 · 크기 · 화풍) 판정에 실제로 쓴 시트와 흉내다. `docs/temp/`에서 도구가 만든 산출물 중 판정의 근거가 된 장만 여기로 복사해 추적한다(2026-09-17 사용자 결정 — 종전에는 커밋하지 않았다). 무엇을 왜 정했는지는 [G2 검토 문서](../../../docs/development/sessions/2026-09-17-blender-3d-gate-round2-g2-review.md)가, 수치 원본은 [G2 문서](../../../docs/development/sessions/2026-09-15-blender-3d-gate-round2-g2-toon.md) §8이 든다.

전부 도구로 다시 만들 수 있다(순서와 명령은 G2 문서 §8.6). 다시 만든 것이 여기 장과 다르면 도구나 입력이 바뀐 것이다.

| 파일 | 무엇 | 만든 도구 | 판정 |
|---|---|---|---|
| `weapons_sheet.png` · `weapons_chosen.png` | 지팡이 셋 · 방패 셋 후보와 채택 컷(지팡이 orb · 방패 round) | `weapons.ts` | G1 무기(2026-09-16) |
| `composite_a.png` · `composite_b.png` | 몸 · 상의 · 지팡이 · 방패 층을 겹친 정면(상의 A · B). 가림과 층 합성 테두리를 보는 그림 | `layers.ts stack` | G2 가림 · 층 합성 |
| `composite_a_720p.png` · `composite_b_720p.png` | 위 둘을 게임 크기(48×96)로 줄인 것 | `layers.ts stack` | 층 합성 테두리는 이 크기에서 본다 |
| `sheet_cape.png` | 망토 세 번째 판 — 앞 · 뒤 · 3/4, 원본 · 720p, 층 합성 | `gear.ts` | 통과(2026-09-17) |
| `sheet_wings.png` | 날개 두 번째 판 | `gear.ts` | 통과(2026-09-17) |
| `sheet_armor.png` | 화려한 장비(금색 어깨판 · X자 끈 · 배판 · 뿔 · 보석) 다섯 번째 판, 왼쪽 측면 포함 | `gear.ts` | 통과(2026-09-17) |
| `sheet_ornament.png` | 얇은 장식(허리 술 다섯 · 고리 사슬) | `gear.ts` | 술은 720p에서 사라지고 사슬은 점으로 남는다 |
| `sheet_aura.png` | 몸을 감싸는 오라(첫 판) | `gear.ts` | 접고 발밑 마법진으로 바꿈 |
| `sheet_outline_compare_front.png` | 정면에서 외곽선 없음 · 인버티드 헐 · Line Art · 후처리를 장비 경우별로 나란히 | `outline.ts` | 인버티드 헐로 결정(2026-09-17) |
| `sheet_outline_hull.png` | 채택한 헐 1을 경우 × 방향으로 | `outline.ts` | |
| `sheet_elevation.png` | 카메라 고도 0° · 15° · 30° · 45° 후보(발밑 마법진 포함)를 출하 2D · 귀신 표본과 실제 표시 크기로 | `elevation.ts` | 15° 결정(2026-09-17) |
| `player_p15_720p.png` · `player_top_b_p15_720p.png` | 15° 플레이어 상의 A · B + 마법진, 720p 크기 그대로(117×107). 사용자가 다른 도구로 화면을 꾸밀 때 붙이는 낱장 | `elevation.ts` | |
| `ghost_1_720p.png` · `ghost_2_720p.png` | 도깨비 70 · 처녀귀신 50 단위 낱장(옛 규격 크기) | `elevation.ts` | |
| `mock_720p.png` · `mock_iphone16pro.png` | 첫 게임 화면 흉내(플레이어 96 · 도깨비 70 · 처녀귀신 50). 아이폰 판은 실물 크기 감각용 | 일회성 스크립트(지움) | 플레이어가 크고 몬스터가 작다 → 크기 재설정 |
| `mock_a_720p.png` · `mock_b_720p.png` | 최종 흉내 — 플레이어 80%, 몬스터 넷은 `collisionRadius` 직선(50 · 58 · 73 · 75), 상의 A · B | `mock.ts` | 크기 · 화풍 게이트 통과(2026-09-17) |

귀신 표본 원본 넷은 [`art-source/enemies/2026-09-17-ghost-samples/`](../../enemies/2026-09-17-ghost-samples/)에 있다.
