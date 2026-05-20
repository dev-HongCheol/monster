/** 게임 전체 상태 */
export enum GameState {
  Playing,
  GameOver,
}

/** 플레이어 기본 수치 */
export interface IPlayerData {
  maxHp: number;
  /** 이동 속도 (units/sec) */
  speed: number;
  /** 자동 사격 쿨다운 (sec) */
  attackCooldown: number;
  /** 발사체 이동 속도 (units/sec) */
  bulletSpeed: number;
  /** 발사체 1발 데미지 */
  bulletDamage: number;
}

/** 적 기본 수치 */
export interface IEnemyData {
  maxHp: number;
  /** 이동 속도 (units/sec) */
  speed: number;
  /** 접촉 시 초당 데미지 */
  contactDamagePerSec: number;
  /** 거리 기반 충돌 반경 */
  collisionRadius: number;
}
