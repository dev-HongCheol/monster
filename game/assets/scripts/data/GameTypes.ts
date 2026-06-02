import type { I18nParams } from '../logic/I18nLogic';

/** 게임 전체 상태 */
export enum GameState {
  Playing,
  /** 레벨업으로 카드 선택을 위해 일시정지한 상태 (웨이브와 무관) */
  LevelUp,
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

/**
 * 마법 발사 패턴 (magic-system-mage.md § 3) — JSON 문자열과 일치.
 *
 * 이번 슬라이스는 `Directional` 하나(발사체 패턴 계열). 유효 발사체 수가 1이면 직선,
 * N이면 부채꼴로 발사한다. AOE/호밍/메테오/체인/무작위 폭풍은 후속 슬라이스에서 case 추가.
 */
export enum SpellPattern {
  /** aim 방향 발사체 — 유효 count만큼 부채꼴 발사(count=1이면 직선) */
  Directional = 'directional',
}

/**
 * 마법 데이터 (spells.json 항목) — 언어 중립.
 * 표시명은 `spell.<id>.name` 카탈로그 키로 해석한다(데이터에 표시 문자열 없음).
 */
export interface ISpellData {
  id: string;
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
  /** 동시 발사 수(기본). 유효 발사체 수 = 이 값 + 강화 보너스 */
  projectileCount: number;
  /** 발사 패턴 (미지정/미지 값은 Directional 폴백) */
  pattern: SpellPattern;
  /** count>=2일 때 총 부채꼴 각도(deg). 생략 시 DEFAULT_SPREAD_ANGLE_DEG */
  spreadAngleDeg?: number;
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

/**
 * 카드 데이터 (cards.json 항목 + 드로우 시 합성되는 마법 추가 카드) — 언어 중립.
 *
 * 표시명/설명은 카탈로그 키(`nameKey`/`descKey`)로 해석한다. cards.json은 `id`+`type`+`effect`만
 * 가지며, 표시 키는 `buildDrawPool`이 id 파생(정적 카드) 또는 합성(마법 카드) 시 부여한다.
 */
export interface ICardData {
  id: string;
  /** enhancement/passive는 cards.json 정적 카드, magic은 미보유 마법에서 동적 합성 */
  type: 'enhancement' | 'passive' | 'magic';
  effect: ICardEffect;
  /** type='magic'일 때 부여할 마법 id (spells.json) */
  spellId?: string;
  /** 표시 이름 카탈로그 키 (buildDrawPool에서 부여). 정적 카드=`card.<id>.name`, 마법=`spell.<id>.name` */
  nameKey?: string;
  /** 표시 설명 카탈로그 키. 정적 카드=`card.<id>.desc`, 마법=`card.add_magic` */
  descKey?: string;
  /** 설명 치환 파라미터 (마법 카드: `{ category: 'category.<cat>', tier }`) */
  descParams?: I18nParams;
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
