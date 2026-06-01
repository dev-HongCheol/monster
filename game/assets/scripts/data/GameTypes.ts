/** 게임 전체 상태 */
export enum GameState {
  Playing,
  WaveClear,
  GameOver,
  Victory,
}

/** 플레이어 기본 수치 (player.json) */
export interface IPlayerBaseData {
  maxHp: number;
  /** 이동 속도 (units/sec) */
  speed: number;
  /** 거리 기반 충돌 반경 */
  collisionRadius: number;
}

/** 마법 분류 (기획 § 1) — JSON 문자열과 일치 */
export enum SpellCategory {
  Fire = 'fire',
  Ice = 'ice',
  Lightning = 'lightning',
  Support = 'support',
}

/** 마법 등급 (기획 § 2) — 1~4 */
export type SpellTier = 1 | 2 | 3 | 4;

/** 마법 데이터 (spells.json 항목) */
export interface ISpellData {
  id: string;
  name: string;
  /** 분류 (화염/얼음/번개/보조) */
  category: SpellCategory;
  /** 등급 (1~4) */
  tier: SpellTier;
  /** 1발 데미지 */
  damage: number;
  /** 발사체 이동 속도 (units/sec) */
  projectileSpeed: number;
  /** 발사체 충돌 반경 */
  projectileRadius: number;
  /** 자동 사격 쿨다운 (sec) */
  cooldown: number;
  /** 동시 발사 수 */
  projectileCount: number;
}

/** 카드 효과 수치 */
export interface ICardEffect {
  /** 대미지 배율 가산 (예: 0.2 → +20%) */
  damageMult?: number;
  /** 쿨다운 배율 가산 (예: -0.2 → -20%) */
  cooldownMult?: number;
  /** 최대 HP 추가량 */
  maxHpBonus?: number;
}

/** 카드 데이터 (cards.json 항목) */
export interface ICardData {
  id: string;
  name: string;
  description: string;
  type: 'enhancement' | 'passive';
  effect: ICardEffect;
}

/** 적 기본 수치 (enemies.json 항목) */
export interface IEnemyData {
  id: string;
  name: string;
  maxHp: number;
  /** 이동 속도 (units/sec) */
  speed: number;
  /** 접촉 시 초당 데미지 */
  contactDamagePerSec: number;
  /** 거리 기반 충돌 반경 */
  collisionRadius: number;
  /** 사망 시 드롭하는 XP 량 */
  xpDrop: number;
}

/** 경험치 공식 데이터 (experience.json) */
export interface IXPData {
  /** 레벨 1→2에 필요한 기본 XP */
  baseXp: number;
  /** 레벨마다 요구 XP에 곱하는 배율 (예: 1.2 = 120%) */
  xpMultiplier: number;
}

/** 씬 간 결과 데이터 전달용 전역 객체 */
export const GameResult = {
  waveReached: 0,
  gameVictory: false,
};
