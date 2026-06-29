// 적 이동 알고리즘의 순수 로직 (적 시스템 §3). cc import 없이 평면 좌표·시간·수치만 다뤄
// 결정적으로 테스트한다. 가변 상태(돌진 상태·타이머·잠금 방향·지그재그 위상)는 EnemyController가
// 보관하고, 이 모듈은 그 상태를 받아 다음 값을 계산하는 순수 함수만 제공한다.

/** 평면 2D 벡터 (cc.Vec3을 logic 경계 밖으로 넘기지 않기 위한 경량 타입). */
export interface Vec2 {
  x: number;
  y: number;
}

/** 돌진(lunge) 상태기계의 상태 (적 시스템 §3 — 추격→윈드업→돌진→쿨다운). */
export enum LungeState {
  /** 평소 추격. 사거리 안에 들면 윈드업으로. */
  Chase,
  /** 돌진 직전 멈칫(텔레그래프). 진입 시 방향을 잠근다. */
  Windup,
  /** 잠근 방향으로 등속 돌진. */
  Lunge,
  /** 돌진 후 재돌진 금지 쿨다운(추격은 함). */
  Cooldown,
}

/** 돌진 이동 파라미터 (enemies.json moveParams의 lunge 필드). */
export interface LungeParams {
  /** 돌진 발동 거리(px) */
  lungeRange: number;
  /** 윈드업(텔레그래프) 시간(sec) */
  lungeWindup: number;
  /** 돌진 중 속도(px/sec, 등속) */
  lungeSpeed: number;
  /** 돌진 지속 시간(sec) */
  lungeDuration: number;
  /** 돌진 후 쿨다운(sec) */
  lungeCooldown: number;
}

/** `tickLunge` 결과 — 다음 상태·잔여 타이머, 그리고 Windup 진입 에지에서만 잠금 방향. */
export interface LungeTickResult {
  state: LungeState;
  timer: number;
  /** Chase→Windup 진입 프레임에만 non-null (그 외엔 생략 → 컨트롤러가 최초값 유지). */
  lockDir?: Vec2;
}

/** 벡터를 단위 벡터로. 길이 0이면 영벡터(NaN 방지). */
function normalize(v: Vec2): Vec2 {
  const len = Math.hypot(v.x, v.y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

/**
 * 지그재그 진행 방향(단위 벡터)을 계산한다. 플레이어로 향하는 방향에 그 수직(90° CCW) 성분을
 * 사인파로 더해 좌우로 흔든다.
 * @param toPlayer 적→플레이어 벡터
 * @param elapsedSec 지그재그 위상 누적 시간(sec)
 * @param amplitude 좌우 흔들림 세기(전진 대비 수직 가중). 0이면 순수 추격.
 * @param period 1주기 시간(sec). 0 이하면 분모 0(NaN)이라 추격 방향으로 폴백.
 */
export function zigzagDirection(
  toPlayer: Vec2,
  elapsedSec: number,
  amplitude: number,
  period: number,
): Vec2 {
  const fwd = normalize(toPlayer);
  // 플레이어가 적 위에 정확히 겹치면 방향이 없다 — 영벡터를 돌려 컨트롤러가 이동을 건너뛴다.
  if (fwd.x === 0 && fwd.y === 0) return { x: 0, y: 0 };
  // period 0 이하면 sin(2π·t/0)=NaN이 새므로 흔들림 없이 추격한다.
  if (period <= 0) return fwd;
  const phase = Math.sin((2 * Math.PI * elapsedSec) / period);
  // perp = fwd를 90° CCW 회전 (-fy, fx). 좌/우 부호를 여기 한 곳에 고정한다(chirality).
  const offset = amplitude * phase;
  return normalize({ x: fwd.x - fwd.y * offset, y: fwd.y + fwd.x * offset });
}

/**
 * 돌진 상태기계를 한 틱 전진시킨다. `canAct`가 false(정지·빙결)면 FSM 전체를 동결한다 —
 * 타이머도 멈춰, 정지당한 돌진이 거리 0으로 만료돼 텔레그래프가 헛치는 것을 막는다.
 * @param state 현재 상태
 * @param timer 현재 상태의 잔여 타이머(sec)
 * @param toPlayer 적→플레이어 벡터(거리·잠금 방향 산출)
 * @param canAct 행동 가능 여부(정지·빙결이면 false → 전체 동결)
 * @param params 돌진 파라미터
 * @param dt 프레임 경과 시간(sec)
 * @returns 다음 상태·타이머(+Windup 진입 시 잠금 방향)
 */
export function tickLunge(
  state: LungeState,
  timer: number,
  toPlayer: Vec2,
  canAct: boolean,
  params: LungeParams,
  dt: number,
): LungeTickResult {
  if (!canAct) return { state, timer };
  switch (state) {
    case LungeState.Chase: {
      const dist = Math.hypot(toPlayer.x, toPlayer.y);
      // dist>0 가드: 정확히 겹치면(영벡터) 방향을 잠글 수 없어 윈드업을 건너뛴다.
      if (dist > 0 && dist <= params.lungeRange) {
        return {
          state: LungeState.Windup,
          timer: params.lungeWindup,
          lockDir: normalize(toPlayer),
        };
      }
      return { state: LungeState.Chase, timer: 0 };
    }
    case LungeState.Windup: {
      const t = timer - dt;
      // 윈드업이 끝나면 사거리와 무관하게 돌진을 수행한다(텔레그래프 약속 — 커밋).
      if (t <= 0) return { state: LungeState.Lunge, timer: params.lungeDuration };
      return { state: LungeState.Windup, timer: t };
    }
    case LungeState.Lunge: {
      const t = timer - dt;
      if (t <= 0) return { state: LungeState.Cooldown, timer: params.lungeCooldown };
      return { state: LungeState.Lunge, timer: t };
    }
    default: {
      // Cooldown: 사거리 안에 있어도 재돌진하지 않고, 타이머 소진 후에만 Chase로(재돌진 가능).
      const t = timer - dt;
      if (t <= 0) return { state: LungeState.Chase, timer: 0 };
      return { state: LungeState.Cooldown, timer: t };
    }
  }
}

/**
 * 돌진 상태별 이동 방향(단위 벡터)을 돌려준다. 컨트롤러가 여기에 속도·dt를 곱해 이동한다.
 * @param state 현재 돌진 상태
 * @param lockedDir 윈드업에서 잠근 돌진 방향(Lunge에서 사용)
 * @param toPlayer 적→플레이어 벡터(Chase·Cooldown 추격 방향)
 */
export function lungeMovement(state: LungeState, lockedDir: Vec2, toPlayer: Vec2): Vec2 {
  switch (state) {
    case LungeState.Lunge:
      return lockedDir;
    case LungeState.Windup:
      return { x: 0, y: 0 };
    default:
      return normalize(toPlayer);
  }
}

/**
 * 유격(kite) 이동 방향(단위 벡터)을 계산한다 (적 시스템 §3). 적→플레이어 거리로 분기해 선호
 * 사거리를 유지한다 — `preferredRange + band`보다 멀면 접근, `preferredRange − band`보다
 * 가까우면 후퇴, 그 사이 데드존이면 영벡터(정지)를 돌려 경계에서 접근↔후퇴가 매 프레임 뒤집히는
 * 떨림을 막는다(히스테리시스).
 * @param toPlayer 적→플레이어 벡터
 * @param preferredRange 유지하려는 선호 사거리(px). 0 이하면 추격 폴백(항상 접근).
 * @param band 데드존 절반 폭(px). 클수록 무반응 구간이 넓어져 떨림이 줄지만 반응이 둔해진다.
 */
export function kiteDirection(toPlayer: Vec2, preferredRange: number, band: number): Vec2 {
  const dist = Math.hypot(toPlayer.x, toPlayer.y);
  // 겹침(거리 0)이면 방향이 없다 — 영벡터(NaN 방지).
  if (dist === 0) return { x: 0, y: 0 };
  const toward = normalize(toPlayer);
  // preferredRange<=0이면 선호 사거리 개념이 없다 — 항상 접근(추격 폴백).
  if (preferredRange <= 0) return toward;
  if (dist > preferredRange + band) return toward; // 너무 멀다 → 접근
  if (dist < preferredRange - band) return { x: -toward.x, y: -toward.y }; // 너무 가깝다 → 후퇴
  return { x: 0, y: 0 }; // 데드존 → 정지(떨림 0)
}

/**
 * 윈드업 텔레그래프 강도(0→1)를 계산한다 — 윈드업이 진행될수록 1에 가까워지는 램프.
 * @param elapsedSec 윈드업 경과 시간(sec)
 * @param windupSec 윈드업 총 시간(sec). 0 이하면 즉시 1(완전 텔레그래프).
 */
export function windupBlend(elapsedSec: number, windupSec: number): number {
  if (windupSec <= 0) return 1;
  return Math.min(1, Math.max(0, elapsedSec / windupSec));
}

/** 돌진 도달 거리(px) = 등속 `lungeSpeed` × `lungeDuration`. 바닥 마커 길이의 기준. */
export function lungeReach(params: LungeParams): number {
  return params.lungeSpeed * params.lungeDuration;
}

/** 방향 벡터를 각도(deg)로. +x=0°, +y=90°, -x=±180°. 바닥 마커 회전에 쓴다. */
export function vectorToAngle(dir: Vec2): number {
  return (Math.atan2(dir.y, dir.x) * 180) / Math.PI;
}
