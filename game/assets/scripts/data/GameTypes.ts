import type { I18nParams } from '../logic/I18nLogic';

/** 게임 전체 상태 */
export enum GameState {
  Playing,
  /** 레벨업으로 카드 선택을 위해 일시정지한 상태 (웨이브와 무관) */
  LevelUp,
  GameOver,
  Victory,
  /** ESC로 연 수동 일시정지 상태 (LevelUp과 별개 — 카드 선택 아님) */
  Paused,
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
  /** 자기중심 즉발 버스트 — 시전 시 플레이어 위치 반경에 1회 피해(발사체 없음). 기획 §9.2 Self-AoE/Nova */
  Nova = 'nova',
  /**
   * 궤도 — 시전 시 플레이어 주위 링 위에 오브 N개가 360/N 균등 배치로 회전, 활성 수명 동안 접촉 타격
   * (발사체 없음). 기획 §9.2 Orbit. 실제 발동은 SpellCaster._castOrbit(컴포넌트).
   */
  Orbit = 'orbit',
}

/**
 * 명중 시 거는 상태이상(CC) 설정 (기획 §9.4·§11). `Projectile`이 단일 명중 시 확률을 굴려
 * 적의 컨트롤 슬롯에 건다. `kind`는 CC 종류로 `StatusEffectLogic.ControlStrength`에 대응한다
 * (이번 슬라이스는 `'stun'`만 배선 — `'slow'`·`'freeze'`는 후속 슬라이스).
 */
export interface ISpellStatusEffect {
  /** CC 종류 — 정지/슬로우/빙결 */
  kind: 'stun' | 'slow' | 'freeze';
  /** 발동 확률 (0~1) */
  chance: number;
  /** 기본 지속시간 (sec) — 지속(Duration) 강화가 곱하는 대상(§10.3 A3) */
  durationSec: number;
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
   * 발사체 수 강화 허용 여부 (기획 §8). 자기중심 즉발 광역(프로스트 노바)만 `false` —
   * 부채꼴로 퍼질 방향이 없어 발사체 수가 의미 없다. (인페르노는 궤도형이라 오브 수 = 발사체 수 ✅.)
   * 생략 시 허용(기본 true).
   */
  allowsProjectileCount?: boolean;
  /**
   * 명중 시 효과 (기획 §9.3·§11). `'explosion'`이면 명중 지점 반경 폭발(직격 피해 없이 폭발만),
   * 생략/`'single'`이면 단일 명중. 폭발형은 `explosionRadius`가 필요하다.
   */
  hitEffect?: 'single' | 'explosion';
  /**
   * 기본 폭발 반경 (units). `hitEffect='explosion'`일 때 사용한다. 범위(Range) 강화가
   * 곱하는 대상이며(§10.3·A3), 이 필드 유무가 범위 강화 카드 적격을 가른다.
   */
  explosionRadius?: number;
  /**
   * 명중 시 거는 상태이상(CC) — 라이트닝 볼트의 확률 정지 등(§9.4·§11). 이 필드 유무가
   * 지속시간(Duration) 강화 카드 적격을 가른다(§10.3 A3, `isDurationCapable`).
   */
  onHitStatus?: ISpellStatusEffect;
  /**
   * 궤도(Orbit) 패턴 — 오브가 도는 기본(최소) 링 반경 (units). 동적 링 확장의 바닥값이며(오브 수·크기로
   * 겹침 회피 시 더 커짐), 이 필드 유무가 범위(Range) 강화 카드 적격을 가른다(§10.3, `isRangeCapable`).
   * 범위 강화가 곱하는 대상은 오브 크기(`projectileRadius`)다.
   */
  orbitRadius?: number;
  /**
   * 궤도(Orbit) 패턴 — 인접 오브 간격 여유 비율 (생략 시 기본 `ORB_GAP`=0.15). 동적 링이 오브끼리
   * 안 겹치게 둘 때 쓰는 여유다. **음수면 겹침을 허용**해, 오브가 많을수록(간격 항 지배) 링이 그만큼
   * 안쪽으로 당겨진다(발사체 많을 때 조금씩 겹치며 가까이). 오브가 적을 땐 바닥값(`orbitRadius`)·
   * 파묻힘 여유가 지배해 영향이 거의 없다. 소비처: `OrbitLogic.ringRadius`.
   */
  orbGap?: number;
  /** 궤도(Orbit) 패턴 — 오브 회전 속도 (deg/sec). 고정값(강화 대상 아님). */
  rotationSpeedDeg?: number;
  /** 궤도(Orbit) 패턴 — 같은 (오브, 적) 짝의 재타격 락아웃 (sec). 매 프레임 도배 방지(§6.1). */
  rehitCooldownSec?: number;
  /**
   * 궤도(Orbit) 패턴 — 오브 활성 수명 (sec). 시전 후 이 시간 동안 돌고 전부 사라진다. 이 필드 유무가
   * 지속시간(Duration) 강화 카드 적격을 가른다(§10.3 A3, `isDurationCapable`). 지속 강화가 곱하는 대상.
   */
  lifetimeSec?: number;
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

/**
 * 이동 알고리즘별 파라미터 (적 시스템 §11 moveParams). 전 필드 선택적 — 지그재그 적은 lunge
 * 필드가 없고 돌진 적은 zigzag 필드가 없다. 유격(S2)의 `preferredRange`도 같은 블록에 들어온다.
 * 분모·정규화에 쓰이는 값(`zigzagPeriod` 등)은 0을 쓰지 않는다(0이면 런타임 NaN — MovementLogic 가드 참조).
 */
export interface IEnemyMoveParams {
  /** 지그재그 좌우 흔들림 세기 (전진 대비 수직 가중) */
  zigzagAmplitude?: number;
  /** 지그재그 1주기 시간(sec) — 0/음수 금지 */
  zigzagPeriod?: number;
  /** 돌진 발동 거리(px) */
  lungeRange?: number;
  /** 돌진 전 윈드업(텔레그래프) 시간(sec) */
  lungeWindup?: number;
  /** 돌진 중 속도(px/sec, 등속) */
  lungeSpeed?: number;
  /** 돌진 지속 시간(sec) */
  lungeDuration?: number;
  /** 돌진 후 재돌진 금지 쿨다운(sec) */
  lungeCooldown?: number;
  /** 유격(kite) 선호 사거리(px). 0이면 추격 폴백(항상 접근). */
  preferredRange?: number;
}

/** 적 능동 공격 블록 (적 시스템 §5·§11). 접촉만 하는 적은 생략(능동 공격 안 함). */
export interface IEnemyAttackData {
  /** 공격 타입 (적 시스템 §5). S2a는 'projectile_single'만 배선 — 미지 값은 무공격 폴백. */
  type:
    | 'contact'
    | 'lunge'
    | 'projectile_single'
    | 'projectile_fan'
    | 'projectile_spread'
    | 'melee_sweep';
  /** 발동당 1회 버스트 피해 (접촉 DoT와 별개 — §5 분리 데미지 모델) */
  damage: number;
  /** 공격 주기(sec) — 발동 간격. 0이면 하한으로 클램프. */
  cooldown: number;
  /** 텔레그래프(윈드업 점멸) 길이(sec, §6). 0이면 즉발. */
  telegraphTime: number;
  /** 발사 사거리(px) — 이 거리 안에 플레이어가 있을 때만 발사. 생략/0이면 무제한. */
  range?: number;
  /** 발사체 공격일 때만 */
  projectile?: {
    /** 발사 수(S2a는 1, 부채꼴·확산은 S2b) */
    count: number;
    /** 부채꼴 총 각도(deg, S2b) */
    spreadAngleDeg?: number;
    /** 발사체 속도(px/sec) */
    speed: number;
    /** 발사체 충돌 반경(px) */
    radius: number;
  };
  /** 근접 휘두르기 공격일 때만 (melee_sweep) */
  melee?: {
    /** 휘두르기 부채꼴 각도(deg) — 적별 차별화(두억시니 150·야차 120·그슨대 90) */
    coneAngleDeg: number;
    /** 휘두르기 사거리(px) — 이 안에 플레이어가 있어야 텔레그래프 시작·명중 판정 */
    range: number;
  };
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
  /** 이동 알고리즘 (적 시스템 §3). "chase"|"zigzag"|"lunge" — 미구현·미지 값은 chase 폴백 */
  movement: string;
  /** 역할·스탯 프로필 라벨 (적 시스템 §4). standard|swarmer|tank — 그룹화/도감용 */
  role: string;
  /** placeholder 색 (적 시스템 §7). hex 문자열. Sprite 컬러에 적용 */
  tint: string;
  /** 시각 크기 배율 (적 시스템 §7). node scale에 적용 */
  threatScale: number;
  /** 이동 enum별 파라미터 (적 시스템 §11). 접촉 추격 적은 생략 가능 */
  moveParams?: IEnemyMoveParams;
  /** 능동 공격 블록 (적 시스템 §5). 접촉만 하는 적은 생략 — 능동 공격 안 함. */
  attack?: IEnemyAttackData;
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
