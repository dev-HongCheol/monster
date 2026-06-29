// 적 능동 공격(발사체)의 순수 상태기계 (적 시스템 §5·§6). cc import 없이 평면 좌표·시간·수치만
// 다뤄 결정적으로 테스트한다. 가변 상태(공격 상태·타이머·잠근 조준 방향)는 EnemyController가
// 보관하고, 이 모듈은 그 상태를 받아 다음 값을 계산하는 순수 함수만 제공한다.
// MovementLogic의 돌진 FSM(tickLunge)과 동형 구조다.

import type { Vec2 } from './MovementLogic';

/** 공격 쿨다운 하한(sec) — cooldown 0/음수 데이터가 매 프레임 발사로 폭주하는 것을 막는다. */
export const MIN_ATTACK_COOLDOWN_SEC = 0.1;

/** 공격 상태기계의 상태 (적 시스템 §5 — 조준→텔레그래프→발사→쿨다운). */
export enum AttackState {
  /** 평소 조준. 사거리 안 + 발동 가능이면 텔레그래프로. */
  Aim,
  /** 발사 직전 멈칫(윈드업 점멸 텔레그래프). 진입 시 조준 방향을 잠근다. */
  Telegraph,
  /** 발사 에지(정확히 한 틱). */
  Fire,
  /** 발사 후 재발사 금지 쿨다운. */
  Cooldown,
}

/** 공격 FSM 파라미터 (enemies.json attack 필드에서 추출). */
export interface AttackParams {
  /** 발사 사거리(px). 이 안에 플레이어가 있어야 텔레그래프 시작. 0 이하면 무제한. */
  range: number;
  /** 텔레그래프(윈드업) 시간(sec). 0이면 사실상 즉발. */
  telegraphTime: number;
  /** 공격 쿨다운(sec). MIN_ATTACK_COOLDOWN_SEC로 하한 클램프. */
  cooldown: number;
}

/** `tickAttack` 결과 — 다음 상태·타이머, Telegraph 진입 시 잠금 방향, Fire 에지 발사 신호. */
export interface AttackTickResult {
  state: AttackState;
  timer: number;
  /** Aim→Telegraph 진입 프레임에만 non-null (그 외엔 생략 → 컨트롤러가 최초값 유지). */
  lockDir?: Vec2;
  /** 이 틱에 발사하면 true (Telegraph→Fire 에지에서 정확히 한 번). */
  fired?: boolean;
}

/** 벡터를 단위 벡터로. 길이 0이면 영벡터(NaN 방지). */
function normalize(v: Vec2): Vec2 {
  const len = Math.hypot(v.x, v.y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

/**
 * 공격 상태기계를 한 틱 전진시킨다. `canAct`가 false(정지·빙결)면 FSM 전체를 동결한다 —
 * 타이머도 멈춰, 정지당한 적이 텔레그래프만 흘려보내고 헛쏘는 것을 막는다(돌진 FSM과 동형).
 * @param state 현재 상태
 * @param timer 현재 상태의 잔여 타이머(sec)
 * @param toPlayer 적→플레이어 벡터(거리·잠금 방향 산출)
 * @param canAct 행동 가능 여부(정지·빙결이면 false → 전체 동결)
 * @param params 공격 파라미터
 * @param dt 프레임 경과 시간(sec)
 * @returns 다음 상태·타이머(+Telegraph 진입 시 잠금 방향, +Fire 에지에서 fired)
 */
export function tickAttack(
  state: AttackState,
  timer: number,
  toPlayer: Vec2,
  canAct: boolean,
  params: AttackParams,
  dt: number,
): AttackTickResult {
  if (!canAct) return { state, timer };
  switch (state) {
    case AttackState.Aim: {
      const dist = Math.hypot(toPlayer.x, toPlayer.y);
      // range<=0이면 사거리 무제한. dist>0 가드: 정확히 겹치면(영벡터) 방향을 잠글 수 없어 건너뛴다.
      const inRange = params.range <= 0 || dist <= params.range;
      if (dist > 0 && inRange) {
        return {
          state: AttackState.Telegraph,
          timer: params.telegraphTime,
          lockDir: normalize(toPlayer),
        };
      }
      return { state: AttackState.Aim, timer: 0 };
    }
    case AttackState.Telegraph: {
      const t = timer - dt;
      // 윈드업이 끝나면 사거리와 무관하게 발사한다(텔레그래프 약속 — 커밋).
      if (t <= 0) return { state: AttackState.Fire, timer: 0, fired: true };
      return { state: AttackState.Telegraph, timer: t };
    }
    case AttackState.Fire: {
      // Fire는 정확히 한 틱 — 즉시 Cooldown으로(발동당 1타 보장). cooldown은 하한 클램프.
      return {
        state: AttackState.Cooldown,
        timer: Math.max(params.cooldown, MIN_ATTACK_COOLDOWN_SEC),
      };
    }
    default: {
      // Cooldown: 사거리 안이어도 재발사하지 않고, 타이머 소진 후에만 Aim으로(재발사 가능).
      const t = timer - dt;
      if (t <= 0) return { state: AttackState.Aim, timer: 0 };
      return { state: AttackState.Cooldown, timer: t };
    }
  }
}
