import { type ISpellData, SpellPattern } from '../data/GameTypes';

/** count>=2일 때 적용하는 기본 총 부채꼴 각도(deg). 마법별 spreadAngleDeg로 덮어쓸 수 있다. */
export const DEFAULT_SPREAD_ANGLE_DEG = 10;

/**
 * 한 발의 발사 사양 — cc 비의존(숫자만).
 * 방향은 단위벡터다(입력 aim이 단위벡터라는 가정 하에 회전으로 생성).
 */
export interface ShotSpec {
  /** 단위 방향 x */
  dirX: number;
  /** 단위 방향 y */
  dirY: number;
  /** 발사체 이동 속도 (units/sec) */
  speed: number;
  /** 1발 데미지(전역 강화는 caster가 곱) */
  damage: number;
  /** 발사체 충돌 반경 */
  radius: number;
}

/** 발사 컨텍스트 — 조준 단위벡터 + 유효 발사체 수 */
export interface FireContext {
  /** 조준 단위 방향 x */
  aimX: number;
  /** 조준 단위 방향 y */
  aimY: number;
  /** 유효 발사체 수(기본 + 강화 보너스). caster가 해석해 전달. <=0이면 1로 클램프 */
  count: number;
}

/** (x, y)를 CCW로 rad 만큼 회전한 벡터. 입력이 단위벡터면 출력도 단위벡터. */
function rotate(x: number, y: number, rad: number): readonly [number, number] {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [x * c - y * s, x * s + y * c];
}

/**
 * 마법 + 컨텍스트로 이번 발사의 ShotSpec 목록을 만든다 (순수, cc 비의존).
 *
 * 설계 doc(2026-06-02-spell-pattern-engine-plan.md) 근거:
 * - `Directional`: count=1이면 aim 직선 1발, count>=2이면 aim 중심 부채꼴로 균등 분포.
 *   홀수는 중앙 발사체가 정확히 aim, 짝수는 중앙 없이 ± 대칭.
 * - 미지정/미지 pattern은 Directional로 폴백(데이터 누락 시 크래시 방지).
 * - aim은 단위벡터 가정(영벡터 가드는 호출자 SpellCaster 책임).
 *
 * @param spell 마법 데이터 (속도/데미지/반경/패턴/부채꼴 각도 출처)
 * @param ctx 조준 방향 + 유효 발사체 수
 * @returns 생성할 발사체별 ShotSpec 목록
 */
export function buildFirePlan(spell: ISpellData, ctx: FireContext): ShotSpec[] {
  switch (spell.pattern) {
    case SpellPattern.Directional:
      return directionalPlan(spell, ctx);
    case SpellPattern.Nova:
      // 자기중심 즉발 버스트는 발사체를 만들지 않는다(§9.2). 실제 발동은 SpellCaster._castNova(컴포넌트).
      return [];
    // 후속 패턴(Aura/메테오/체인/무작위 폭풍)은 여기에 case 추가.
    default:
      // 미지정/미지 패턴은 Directional로 폴백(데이터 누락 시 크래시 방지)
      return directionalPlan(spell, ctx);
  }
}

/** 방향성 부채꼴 발사 계획. */
function directionalPlan(spell: ISpellData, ctx: FireContext): ShotSpec[] {
  // count가 NaN/Infinity면 floor도 비유한값 → Math.max(1, NaN)=NaN으로 루프가 0번 돌아
  // 무발사가 된다(R1). 비유한값은 1발로 클램프.
  const floored = Math.floor(ctx.count);
  const n = Number.isFinite(floored) ? Math.max(1, floored) : 1;
  const totalDeg = spell.spreadAngleDeg ?? DEFAULT_SPREAD_ANGLE_DEG;
  const shots: ShotSpec[] = [];

  for (let i = 0; i < n; i++) {
    // n=1이면 offset 0(직선). n>=2이면 -총각/2 ~ +총각/2 균등 분포.
    const offsetDeg = n === 1 ? 0 : -totalDeg / 2 + (i * totalDeg) / (n - 1);
    const [dirX, dirY] = rotate(ctx.aimX, ctx.aimY, offsetDeg * (Math.PI / 180));
    shots.push({
      dirX,
      dirY,
      speed: spell.projectileSpeed,
      damage: spell.damage,
      radius: spell.projectileRadius,
    });
  }
  return shots;
}
