import { type SpellCategory, UpgradeOption } from '../data/GameTypes';
import { formatTimer } from './HudFormatLogic';
import { categoryInitial } from './SpellIconRowLogic';

/**
 * 결과 화면 런 통계 조립 순수 로직 — cc import 없음(ADR 002).
 *
 * 씬 전환으로 매니저(특히 `DataManager`)가 파괴돼 result 씬에는 존재하지 않으므로, 표시에 필요한
 * 이름·분류·티어는 **스냅샷 시점(메인 씬, DataManager 생존)에 이미 해석**해 `GameResult`에 담는다.
 * 이 함수는 해석된 값만 받아 시간 포맷·정렬·강화 브레이크다운을 조립한다(표시 규칙의 정본).
 * 데이터 정합 가드(미존재 적/마법 제외)는 해석 계층(스냅샷)이 담당한다.
 */

/** 한 옵션(데미지/쿨다운)의 3티어 강화 레벨 + 최종 배율 — GameResult 스냅샷 원본. */
export interface UpgradeTierSnapshot {
  /** 전역(플레이어) 레벨 */
  g: number;
  /** 분류 레벨 */
  c: number;
  /** 개별(마법) 레벨 */
  i: number;
  /** 최종 강화 배율 = 개별 × 분류 × (1+전역) — 효과 % 산출용 */
  factor: number;
}

/**
 * 결과 화면용 마법 강화 스냅샷 (마법별). 표시에 필요한 분류·티어까지 포함해 result 씬에서
 * DataManager 없이 라벨을 만들 수 있게 한다.
 */
export interface ResultSpellSnapshot {
  id: string;
  /** 분류 — 티어 라벨(분류 이니셜)용 */
  category: SpellCategory;
  /** 등급 — 티어 라벨·정렬용 */
  tier: number;
  /** 데미지 옵션 티어 레벨 + 배율 */
  dmg: UpgradeTierSnapshot;
  /** 쿨다운 옵션 티어 레벨 + 배율 */
  cd: UpgradeTierSnapshot;
}

/** 패시브 한 종의 레벨(획득 횟수) + 누적 보너스. */
export interface PassiveSnapshot {
  /** 획득 횟수(레벨) — 티어 없는 단일 트랙 */
  level: number;
  /** 누적 보너스값 (최대HP는 flat, 이동·픽업은 비율) */
  bonus: number;
}

/** 킬 종류별 한 행 — 적 이름은 스냅샷 시점에 이미 해석(§2 OUT 한국어 고정, 미존재 적은 제외됨). */
export interface ResultKillView {
  name: string;
  count: number;
}

/** `buildResultStats` 입력 — GameResult 스냅샷의 통계 부분(전부 해석 완료, 순수). */
export interface ResultStatsInput {
  /** 생존 시간(초) */
  survivalSec: number;
  /** 도달 레벨 */
  level: number;
  /** 적 종류별 킬 (이름 해석 완료 — 미존재 적은 스냅샷에서 이미 제외) */
  kills: ResultKillView[];
  /** 보유 마법 강화 스냅샷 (데이터 정합 getSpell=null은 스냅샷에서 이미 제외) */
  spells: ResultSpellSnapshot[];
  /** 플레이어 패시브 레벨/보너스 */
  passives: {
    maxHp: PassiveSnapshot;
    moveSpeed: PassiveSnapshot;
    pickup: PassiveSnapshot;
  };
}

/** 마법 강화 브레이크다운 한 줄(옵션별). */
export interface ResultUpgradeView {
  /** 강화 옵션 — 데미지 또는 쿨다운 */
  option: UpgradeOption.Damage | UpgradeOption.Cooldown;
  /** 전역 레벨 */
  global: number;
  /** 분류 레벨 */
  category: number;
  /** 개별 레벨 */
  individual: number;
  /** 최종 효과 % — 데미지 +증가, 쿨다운 −단축 (반올림 정수) */
  effectPct: number;
}

/** 결과 화면용 마법 한 행. */
export interface ResultSpellView {
  id: string;
  /** 분류 이니셜 + 티어 (예: "F1") */
  tierLabel: string;
  /** 이름 i18n 키 (예: "spell.fireball.name") — 렌더 시 t()로 해석 */
  nameKey: string;
  /** 데미지·쿨다운 강화 브레이크다운 */
  upgrades: ResultUpgradeView[];
}

/** 결과 화면 뷰모델 — `ResultController`가 라벨/RichText로 렌더. */
export interface ResultStatsView {
  /** 생존 시간 mm:ss */
  survivalTime: string;
  /** 도달 레벨 */
  level: number;
  /** 킬 총계 = 표시된 종류별 킬의 합 */
  killTotal: number;
  /** 킬 종류별 (count 내림차순) */
  killsByType: ResultKillView[];
  /** 보유 마법 (티어 오름차순) */
  spells: ResultSpellView[];
  /** 패시브 레벨/보너스 */
  passives: {
    maxHp: PassiveSnapshot;
    moveSpeed: PassiveSnapshot;
    pickup: PassiveSnapshot;
  };
}

/** 데미지 최종 효과 % = +(factor−1). 반올림 정수. */
function damagePct(factor: number): number {
  return Math.round((factor - 1) * 100);
}

/**
 * 쿨다운 최종 효과 % = 단축 −(1−1/factor). 배율이 쿨다운을 나눠 줄이므로 음수.
 * `(1/factor − 1)`로 쓰면 −(1−1/factor)와 값이 같으면서 factor=1일 때 −0이 아닌 +0을 낸다. 반올림 정수.
 */
function cooldownPct(factor: number): number {
  return Math.round((1 / factor - 1) * 100);
}

/** 한 옵션의 브레이크다운 뷰를 조립한다(세 티어 레벨 + 최종 효과 %). */
function upgradeView(
  option: UpgradeOption.Damage | UpgradeOption.Cooldown,
  tiers: UpgradeTierSnapshot,
  effectPct: number,
): ResultUpgradeView {
  return {
    option,
    global: tiers.g,
    category: tiers.c,
    individual: tiers.i,
    effectPct,
  };
}

/**
 * 해석 완료된 런 통계 스냅샷을 결과 화면 뷰모델로 조립한다(순수).
 * 시간 포맷·킬 종류별(내림차순)·마법 라벨(티어 오름차순)·강화 레벨 브레이크다운(3티어 + 효과%)·패시브.
 * 동률은 입력 순서를 보존한다(명시적 안정 정렬).
 * @param input GameResult 스냅샷의 통계 부분(이름·분류·티어 해석 완료)
 */
export function buildResultStats(input: ResultStatsInput): ResultStatsView {
  // 킬: count 내림차순(동률은 입력 순서 보존). 총계 = 합.
  const kills: ResultKillView[] = input.kills
    .map((k, idx) => ({ k, idx }))
    .sort((a, b) => b.k.count - a.k.count || a.idx - b.idx)
    .map((e) => e.k);
  const killTotal = kills.reduce((sum, k) => sum + k.count, 0);

  // 마법: 티어 오름차순(동률은 입력=획득 순서 보존). 라벨 + 강화 브레이크다운.
  const spells: ResultSpellView[] = input.spells
    .map((snap, idx) => ({ snap, idx }))
    .sort((a, b) => a.snap.tier - b.snap.tier || a.idx - b.idx)
    .map(({ snap }) => ({
      id: snap.id,
      tierLabel: `${categoryInitial(snap.category)}${snap.tier}`,
      nameKey: `spell.${snap.id}.name`,
      upgrades: [
        upgradeView(UpgradeOption.Damage, snap.dmg, damagePct(snap.dmg.factor)),
        upgradeView(UpgradeOption.Cooldown, snap.cd, cooldownPct(snap.cd.factor)),
      ],
    }));

  return {
    survivalTime: formatTimer(input.survivalSec),
    level: input.level,
    killTotal,
    killsByType: kills,
    spells,
    passives: input.passives,
  };
}
