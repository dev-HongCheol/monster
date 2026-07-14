# 코드 리뷰 이슈 — 스폰 기하 (feat/spawn-geometry)

- **리뷰 커밋:** `8ee72f2`(base) → `2551e3c`(head)
- **리뷰 방식:** `superpowers:requesting-code-review` 패턴, 별도 subagent dispatch
- **계획 문서:** [`../development/sessions/2026-07-14-spawn-geometry-plan.md`](../development/sessions/2026-07-14-spawn-geometry-plan.md)

---

## Critical

없음.

---

## Important

### I-1. 재활용된 적이 여전히 피해를 받아 유령 킬 + 엉뚱한 XP를 만든다 — **수정됨**

- **위치:** `components/EnemyController.ts:251` (`takeDamage`)
- **문제:** `_startDeath`는 `_dead = true`를 세우고 `takeDamage`가 그걸 보고 막는다. 그런데 `recycle()`은 적을 활성 목록에서 빼면서 `_despawned`만 세우고, `takeDamage`는 `_despawned`를 **보지 않는다.**

  공간 그리드는 프레임당 1회만 재구축되는데(`GameManager.ts:215`) `EnemySpawner`는 프레임 도중에 재활용한다. 그래서 그 프레임에 이미 만들어진 그리드가 **풀에 들어간 적**을 `Projectile._checkEnemyHit`에 넘길 수 있다. `enemy?.isValid` 가드는 이걸 못 거른다 — `isValid`는 **파괴** 여부이지 활성 여부가 아니다. 발사체는 사거리 제한이 없고 아레나 경계에서만 컬링되므로(`Projectile.ts:179`), 회수 거리(2200) 밖에 서 있는 적 옆까지 날아갈 수 있다.
- **결과:** 회수된 적이 `takeDamage`를 통과 → `_startDeath` → `registerKill`(**결과 화면에 유령 킬**) + `_dropXpItem`(**아무도 없는 곳에 경험치 낙하**).
- **수정:** `takeDamage`가 `_despawned`도 함께 막는다. 근거 주석을 함께 남겼다.

  ```ts
  if (this._dead || this._despawned) return;
  ```

### I-2. 카메라 좌표가 비유한값이면 NaN 스폰 좌표가 새어 나간다 — **수정됨**

- **위치:** `logic/SpawnGeometry.ts` (`clipSegments`)
- **문제:** 뷰 절반·여유·난수·아레나는 전부 정규화·NaN 테스트가 있는데 `cam`·`player`만 없었다. `cam.x = NaN`이면 `fixed < min || fixed > max`도 `to <= from`도 전부 false라(모든 NaN 비교가 false) 길이 NaN인 구간이 들어가고, `total = NaN`이라 `total <= 0` 폴백도 건너뛴 채 NaN 좌표가 반환된다.
- **왜 중요한가:** 이번 슬라이스가 이 결함을 **증폭**한다. NaN 좌표의 적은 재활용 비교(`NaN > recycleSq` = false)도 교전 판정(`NaN <= engageSq` = false)도 전부 빠져나가, **영원히 회수되지 않으면서 이동 중 상한을 점유**한다. 25마리면 스폰이 영구 정지한다. 계획 §3 방어 경로가 지목한 바로 그 유령인데, `viewHalfW <= 0` 가드는 뷰 경로만 막고 카메라 경로는 열려 있었다.
- **수정:** `normPoint`로 `cam`·`player`를 정규화하고, `total > 0` 비교를 `!(total > 0)`으로 뒤집어 NaN도 폴백으로 몰았다. 스윕 쪽은 I-4의 `classifyByDistance`가 비유한 거리를 **회수**로 분류해 유령이 스스로 청소되게 했다. NaN 카메라·플레이어 좌표 테스트 추가.

### I-3. 폴백의 아레나 없음 분기가 플레이어 위치를 그대로 돌려준다 — **수정됨**

- **위치:** `logic/SpawnGeometry.ts` (`farthestInsidePoint` → `fallbackSpawnPoint`)
- **문제:** 두 줄 위 주석과 계획 결정 8이 "퇴화 입력에서 절대 플레이어 근처를 돌려주지 않는다"를 이 폴백의 존재 이유로 못 박았는데, 아레나 없음 분기는 **플레이어 좌표를 정확히** 반환했다. 현재 도달 불가(아레나가 없으면 유효 둘레가 항상 양수)지만, 도달하면 이 모듈이 막으려던 단 하나를 한다.
- **수정:** 스폰 사각형 위쪽 변(`player.y + hh`)을 돌려준다. 함수명도 `fallbackSpawnPoint`로 바꿨다(더 이상 "가장 먼 안쪽 점"만 하는 게 아니다).

### I-4. 매 프레임 스윕 — 이번 슬라이스에서 가장 위험한 로직인데 테스트가 없다 — **수정됨**

- **위치:** `systems/EnemySpawner.ts` (`_sweepEnemies`)
- **문제:** 계획 결정 3이 기각 재추첨을 버린 이유가 "알고리즘이 테스트 밖에 남는다(ADR 002 위반)"였는데, 그 비판이 `_sweepEnemies`에 그대로 적용된다. 회수/교전/이동 분류는 **배선이 아니라 판단 규칙**이고, 새 위험(상한 유계성·순회 중 변형·재활용과 사망의 구분)이 전부 여기 있다.
- **수정:** 순수 함수 `classifyByDistance(distSq, engageSq, recycleSq): 'engaged' | 'inbound' | 'recycle'`로 추출하고 스포너가 그걸 쓴다. 경계값 6개 테스트 추가. 이 추출이 **I-2를 바로 드러냈다** — 순진한 비교에서 NaN이 조용히 `inbound`로 빠지는 것을 테스트가 잡는다.

---

## Minor

### M-1. `cam`과 `player`를 바꿔 넘겨도 타입이 통과한다 — **수정됨**

- **위치:** `logic/SpawnGeometry.ts` (`offViewSpawnPoint`)
- **문제:** 인자 8개에 `cam`·`player`가 **둘 다 `Vec2`**로 나란히 있었다. 호출부에서 순서를 바꾸면 이 슬라이스가 고친 회귀(플레이어 기준으로 뽑아 적이 화면 안에서 스폰)가 그대로 되살아나는데, **어떤 테스트도 못 잡는다** — 카메라 회귀 가드는 순수 함수를 올바른 인자로 부르고, `EnemySpawner`의 인자 순서를 단언하는 것은 없다.
- **수정:** `SpawnField` 옵션 객체로 받는다. 이름이 붙어 순서 사고가 불가능해졌다. `spawnPerimeterLength`도 같은 객체를 쓴다.

### M-2. `_warnDegenerateOnce`가 "once"가 아니다 — **수정됨(이름·주석)**

- **위치:** `systems/EnemySpawner.ts`
- **문제:** 래치를 퇴화 분기에서만 세우므로 정상 경로에서는 `spawnPerimeterLength`가 **매 스폰마다** 돈다(`clipSegments`가 스폰당 2회).
- **판단:** 검사 자체는 매 스폰 도는 게 **맞다** — 맵 교체·창 크기 변경으로 상태가 뒤집힐 수 있다. 잠글 것은 **경고 출력**이다. 스폰은 초당 0.5~2회라 비용은 무시할 수준이고, 계획 §4가 스폰 경로 할당 최적화를 명시적으로 스코프 밖에 뒀다. 이름이 거짓말한 것이므로 `_warnIfDegenerate`로 바꾸고 의도를 주석에 적었다.

### M-3. 순서 불변식 테스트가 문서보다 약하게 단언한다 — **수정됨**

- **위치:** `tests/logic/SpawnGeometry.test.ts`
- **문제:** 주석은 `engagementRadius < maxSpawnDistance ≤ clampRecycleDistance`를 "모든 종횡비·여유에서" 보장한다고 했는데, 행렬 테스트는 첫 부등호만 단언했다. 또 `viewHalf = 0`에서는 엄격 `<`가 `=`로 퇴화하는데 행렬이 그 경우를 훑지 않았다.
- **수정:** 행렬에 `clampRecycleDistance` 고리를 추가하고(요청값 0·500·2200·NaN 전부), 퇴화 뷰에서 두 거리가 같아진다는 사실을 별도 테스트로 명시했다(실제 스폰 경로는 `viewHalfW <= 0`에서 그 프레임을 건너뛰므로 도달하지 않는다).

### M-4. 스윕에 `isValid` 가드가 없다 — **수정됨**

- **위치:** `systems/EnemySpawner.ts` (`_sweepEnemies`)
- **문제:** 형제 순회들(`GameManager.ts:206`·`:221`, `Projectile.ts:117`, `SpellCaster.ts:455`)은 전부 `enemy?.isValid`를 확인하는데 스윕만 빠졌다. 현재는 안전하지만(`maxFree = 0`이라 풀이 노드를 파괴하지 않는다) 일관성이 깨진 자리는 함정이 된다.
- **수정:** 가드 추가.

### M-5. `as [number, boolean][]` 캐스트 — **수정됨**

- **위치:** `logic/SpawnGeometry.ts` (`clipSegments`)
- **수정:** 타입이 붙은 `EDGES` 상수로 바꿔 단언을 제거했다.

### M-6. 카메라를 한 프레임 낡은 값으로 읽는다 — **의도된 것(주석으로 명시)**

- `EnemySpawner.update()`가 읽는 위치는 `CameraController.lateUpdate()`가 쓴 값이라 한 프레임 낡았다. 최대 오차는 카메라 속도 × 1프레임(300px/s에서 약 5px)이고 여유(margin 100)가 통째로 흡수한다. 재계산하지 **않는 것**이 이 설계의 핵심이므로(복제본을 들면 F42 카메라 스무딩에서 말없이 어긋난다) 그대로 두고, 나중에 "버그로 발견"되지 않도록 코드에 근거 주석을 남겼다.

---

## 계획 문서 자체의 문제 (구현이 아니라 계획이 틀림) — **수정됨**

계획 §3의 코드 블록이 `offViewSpawnPoint(cam, viewHalfW, viewHalfH, margin, arena, radius, roll)`로 **`player` 없이** 선언돼 있는데, 같은 절의 사후조건 산문은 퇴화 폴백이 "플레이어에게서 가장 먼 아레나 안쪽 점"을 돌려주라고 요구한다. 플레이어 없이는 불가능하다. 구현이 `player`를 추가한 것이 맞고 계획이 자체 모순이었다. 나중에 누가 시그니처를 "되돌리지" 않도록 계획의 스니펫을 실제 API(`SpawnField` 객체)로 고쳤다.
