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
  /** XP 자동 흡수 반경 (units) — 픽업범위 패시브의 베이스값 */
  pickupRadius: number;
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
 * 강화 옵션 5종 (기획 § 7.1) — JSON/카탈로그 문자열과 일치.
 *
 * 안정적 taxonomy로 5종 전부 정의한다. `Damage`·`Cooldown`·`ProjectileCount`가 카드·적용에 배선됨.
 * `Range`·`Duration`은 splash/AOE/DOT 효과 레이어가 생기면 매트릭스·적용을 연결한다(후속).
 */
export enum UpgradeOption {
  Damage = 'damage',
  Cooldown = 'cooldown',
  ProjectileCount = 'projectile_count',
  Range = 'range',
  Duration = 'duration',
}

/** 강화 트랙 (기획 § 6.1) — 개별(선택 마법) / 분류. 두 트랙은 독립 관리(§ 7.2). */
export enum UpgradeTrack {
  /** 선택 마법 1종에만 적용 */
  Individual = 'individual',
  /** 해당 분류 마법 전체에 적용 */
  Category = 'category',
}

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
  /**
   * 발사체 수 강화 허용 여부 (기획 §8). 자기중심 광역(인페르노·프로스트 노바)만 `false` —
   * 부채꼴로 퍼질 방향이 없어 발사체 수가 의미 없다. 생략 시 허용(기본 true).
   */
  allowsProjectileCount?: boolean;
}

/** 강화 카드가 올릴 대상 — 트랙·옵션·대상 키(개별=spellId, 분류=category) (기획 § 6.1·§ 8) */
export interface IUpgradeEffect {
  track: UpgradeTrack;
  option: UpgradeOption;
  /** 개별 트랙=마법 id, 분류 트랙=분류 값(SpellCategory) */
  target: string;
}

/** 카드 효과 수치 */
export interface ICardEffect {
  /** 최대 HP 추가량 (플레이어 강화) */
  maxHpBonus?: number;
  /** 이동속도 보너스 factor 가산 (가산·상한 없음, 예: 0.10 → 속도 ×1.10) */
  moveSpeedBonus?: number;
  /** 픽업범위 보너스 factor 가산 (가산·상한 없음, 예: 0.30 → 반경 ×1.30) */
  pickupRangeBonus?: number;
  /** 전역(플레이어) 데미지 factor 가산 — 모든 마법 공통, 위계상 개별·분류보다 작다(예: 0.05 → ×1.05) */
  damageMult?: number;
  /** 전역(플레이어) 쿨다운 factor 가산 — 양수=단축(예: 0.05 → 쿨다운 ÷1.05) */
  cooldownMult?: number;
  /** 강화 카드(type='upgrade')가 +1레벨 올릴 트랙/옵션/대상 */
  upgrade?: IUpgradeEffect;
}

/**
 * 카드 데이터 (cards.json 항목 + 드로우 시 합성되는 마법 추가 카드) — 언어 중립.
 *
 * 표시명/설명은 카탈로그 키(`nameKey`/`descKey`)로 해석한다. cards.json은 `id`+`type`+`effect`만
 * 가지며, 표시 키는 `buildDrawPool`이 id 파생(정적 카드) 또는 합성(마법 카드) 시 부여한다.
 */
export interface ICardData {
  id: string;
  /**
   * enhancement/passive는 cards.json 정적 카드, magic은 미보유 마법에서 동적 합성,
   * upgrade는 개별/분류 강화 카드(보유 마법·분류 × 옵션)에서 동적 합성.
   */
  type: 'enhancement' | 'passive' | 'magic' | 'upgrade';
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
  /** 이동 알고리즘 (적 시스템 §3). v1은 "chase" 고정 — 데이터 자리만(런타임 분기 없음) */
  movement: string;
  /** 역할·스탯 프로필 라벨 (적 시스템 §4). standard|swarmer|tank — 그룹화/도감용 */
  role: string;
  /** placeholder 색 (적 시스템 §7). hex 문자열. Sprite 컬러에 적용 */
  tint: string;
  /** 시각 크기 배율 (적 시스템 §7). node scale에 적용 */
  threatScale: number;
}

/**
 * 가중 스폰 테이블 한 구간 (spawn-table.json 항목).
 *
 * `fromWave` 오름차순 구간 목록으로, 현재 웨이브 이하인 마지막 구간의 `weights`로
 * 적 종류를 가중 추출한다. (적 시스템 디자인 §8.1 — 후반 웨이브일수록 강한 적 가중치 ↑)
 */
export interface ISpawnTableEntry {
  /** 이 구간이 적용되기 시작하는 웨이브 번호 (이상) */
  fromWave: number;
  /** enemyId → 가중치. 합이 100일 필요 없음(상대 비율). */
  weights: Record<string, number>;
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
