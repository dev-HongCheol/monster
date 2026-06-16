/**
 * 폭발 판정에 넘기는 적 후보 한 마리 — cc 비의존(숫자만).
 *
 * 그리드-레디(백로그 G1): 호출부가 후보 목록을 만든다. 지금은 전체 활성 적,
 * 나중엔 공간 그리드 반경 질의 결과를 같은 인터페이스로 넘긴다.
 */
export interface ExplosionTarget {
  /** 적 위치 x */
  x: number;
  /** 적 위치 y */
  y: number;
  /** 적 몸 충돌 반경 */
  collisionRadius: number;
  /** 안정 식별자 = 적 spawnId (풀 재사용 오판 방지, §10.2) */
  id: number;
}

/**
 * 폭발 중심 반경 안에서 새로 맞을 적을 골라낸다 (순수, cc 비의존 — 기획 §9.3 Explosion 프리미티브).
 *
 * **시전 단위 dedup (§10.2):** `alreadyHit`에 이미 있는 적은 건너뛰고, 새로 맞은 적의 id를
 * `alreadyHit`에 더한다. 같은 시전(volley)의 여러 폭발이 같은 집합을 공유하면 한 적은 시전당
 * 1회만 맞는다(겹친 폭발 = 커버리지 이득이지 누적 아님).
 *
 * 판정은 `중심↔적 거리 <= 폭발 반경 + 적 몸 반경`이며, 제곱거리 비교로 sqrt를 피한다
 * (대량 적 성능 — 백로그 G1과 일관).
 *
 * @param centerX 폭발 중심 x
 * @param centerY 폭발 중심 y
 * @param radius 폭발 반경 (강화 배율 적용 후 유효값)
 * @param enemies 후보 적 목록 (호출부가 구성 — 그리드-레디)
 * @param alreadyHit 이 시전에서 이미 맞은 적 id 집합. 이 함수가 새로 맞은 적 id를 더한다(부수효과).
 * @returns 새로 맞을 적의 `enemies` 인덱스 목록 (호출부가 인덱스로 데미지를 적용)
 */
export function selectExplosionHits(
  centerX: number,
  centerY: number,
  radius: number,
  enemies: readonly ExplosionTarget[],
  alreadyHit: Set<number>,
): number[] {
  const hits: number[] = [];
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (alreadyHit.has(e.id)) continue;
    const dx = e.x - centerX;
    const dy = e.y - centerY;
    const reach = radius + e.collisionRadius;
    if (dx * dx + dy * dy <= reach * reach) {
      hits.push(i);
      alreadyHit.add(e.id);
    }
  }
  return hits;
}
