// 다발 발사의 방향 분포 수학 (순수, cc 비의존). 마법(SpellPatternLogic)과 적(EnemyController)이
// 공유한다 — 어느 쪽 데이터 모델(ISpellData·IEnemyAttackData)에도 의존하지 않고 숫자만 다룬다.
// 부채꼴(호)과 확산(링)은 분포 방식만 다르다: 호는 aim 중심 ±총각/2를 (count-1)로 나눠 끝점을
// 포함하고, 링은 총각을 count로 나눠 끝점 중복 없이 한 바퀴 깐다(360이면 사방 탄막).

/** 단위 방향 벡터 [x, y]. 입력 aim이 단위벡터면 출력도 단위벡터다. */
export type Dir = readonly [number, number];

/** (x, y)를 CCW로 rad 만큼 회전. 입력이 단위벡터면 출력도 단위벡터. */
function rotate(x: number, y: number, rad: number): Dir {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [x * c - y * s, x * s + y * c];
}

/**
 * 발사 수를 유효한 정수로 클램프한다. NaN/Infinity면 floor도 비유한값이라 루프가 0번 돌아
 * 무발사가 되므로(R1), 비유한값과 1 미만을 모두 1로 막는다. SpellPatternLogic.directionalPlan의
 * 규칙과 동일 — 추출 후 마법 동작이 바이트 단위로 같아야 하기 때문이다.
 */
function clampCount(count: number): number {
  const floored = Math.floor(count);
  return Number.isFinite(floored) ? Math.max(1, floored) : 1;
}

const DEG_TO_RAD = Math.PI / 180;

/**
 * 부채꼴(호) 방향 목록. aim을 중심으로 `-총각/2 ~ +총각/2`를 균등 분포한다. count=1이면 aim
 * 직선 1발, count>=2면 (count-1)로 나눠 양 끝점을 포함하고 — 홀수는 중앙 발사체가 정확히 aim,
 * 짝수는 중앙 없이 ± 대칭이 된다. 이무기(전방 부채꼴)와 마법 directional이 공유하는 기하다.
 * @param aimX 조준 단위 방향 x
 * @param aimY 조준 단위 방향 y
 * @param count 발사 수(클램프: 비유한값·1 미만은 1)
 * @param spreadAngleDeg 양 끝 사이 총 부채꼴 각도(deg)
 */
export function fanDirections(
  aimX: number,
  aimY: number,
  count: number,
  spreadAngleDeg: number,
): Dir[] {
  const n = clampCount(count);
  const dirs: Dir[] = [];
  for (let i = 0; i < n; i++) {
    // n=1이면 offset 0(직선). n>=2면 -총각/2 ~ +총각/2 균등 분포.
    const offsetDeg = n === 1 ? 0 : -spreadAngleDeg / 2 + (i * spreadAngleDeg) / (n - 1);
    dirs.push(rotate(aimX, aimY, offsetDeg * DEG_TO_RAD));
  }
  return dirs;
}

/**
 * 확산(링) 방향 목록. 총각을 `count`로 나눠 균등 분포하되 끝점을 중복하지 않는다 — 첫 방향은
 * aim이고, 이후 `총각/count`씩 회전한다. 총각이 360이면 사방 등간격 N발(탄막)이 된다. 물귀신
 * (제자리 확산 탄막)이 쓰는 기하다. (호와 달리 `count`로 나눠, 360에서 첫·끝 발사체가 겹치지 않는다.)
 * @param aimX 조준 단위 방향 x
 * @param aimY 조준 단위 방향 y
 * @param count 발사 수(클램프: 비유한값·1 미만은 1)
 * @param spreadAngleDeg 분포할 총 각도(deg). 360이면 한 바퀴 꽉 채운다.
 */
export function radialDirections(
  aimX: number,
  aimY: number,
  count: number,
  spreadAngleDeg: number,
): Dir[] {
  const n = clampCount(count);
  const dirs: Dir[] = [];
  for (let i = 0; i < n; i++) {
    // 첫 방향(i=0)은 aim. 이후 총각/count씩 회전 → 360이면 끝점이 360에 닿지 않아 중복 없음.
    const offsetDeg = n === 1 ? 0 : (i * spreadAngleDeg) / n;
    dirs.push(rotate(aimX, aimY, offsetDeg * DEG_TO_RAD));
  }
  return dirs;
}
