import { UpgradeOption, UpgradeTrack } from '../data/GameTypes';
import { UPGRADE_CAP } from './EnhancementLogic';

/**
 * 디버그 강화 시드 파일(`data/debug-enhancements.json`)의 원시 형태 — 모든 필드 선택.
 * 카드 픽 없이 강화 레벨을 미리 적용해 인페르노 등 마법의 레벨별 동작을 점검하는 DEV 전용 도구.
 * 표시 문자열은 두지 않는다(데이터 = 언어 중립). 실제 적용은 `DeckManager.applyDebugSeed`.
 */
export interface IDebugEnhancementSeed {
  /** 개별 트랙: spellId → (옵션 문자열 → 레벨 0~4) */
  individual?: Record<string, Record<string, number>>;
  /** 분류 트랙: category → (옵션 문자열 → 레벨 0~4) */
  category?: Record<string, Record<string, number>>;
  /** 전역(플레이어) 보너스: 옵션 문자열 → factor 가산 보너스(예: 0.05 → ×1.05) */
  global?: Record<string, number>;
}

/** 정규화된 강화 레벨 시드 1건 — DeckManager가 `raise`를 `level`번 호출한다. */
export interface DebugRaiseOp {
  track: UpgradeTrack;
  /** 개별=spellId, 분류=category */
  key: string;
  option: UpgradeOption;
  /** 1~UPGRADE_CAP */
  level: number;
}

/** 정규화된 전역 보너스 시드 1건 — DeckManager가 `addGlobal`에 넘긴다. */
export interface DebugGlobalOp {
  option: UpgradeOption;
  /** factor 가산 보너스 */
  bonus: number;
}

/** 시드 파싱 결과 — 개별·분류 raise 목록 + 전역 보너스 목록. */
export interface DebugSeedOps {
  raises: DebugRaiseOp[];
  globals: DebugGlobalOp[];
}

/** 유효한 옵션 문자열 집합 (UpgradeOption 값 그대로 — 'damage'·'projectile_count' 등). */
const OPTION_VALUES = new Set<string>(Object.values(UpgradeOption));

/** 옵션 문자열을 UpgradeOption으로 변환한다. 알 수 없으면 null. */
function toOption(s: string): UpgradeOption | null {
  return OPTION_VALUES.has(s) ? (s as UpgradeOption) : null;
}

/** 레벨을 0~UPGRADE_CAP 정수로 클램프한다. 비수치는 0. */
function clampLevel(n: unknown): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(UPGRADE_CAP, Math.floor(n)));
}

/** 트랙 테이블(spellId/category → 옵션 → 레벨)을 raise op 목록으로 펼친다. 레벨 0 이하는 제외. */
function collectRaises(
  track: UpgradeTrack,
  table: Record<string, Record<string, number>> | undefined,
): DebugRaiseOp[] {
  const out: DebugRaiseOp[] = [];
  if (!table || typeof table !== 'object') return out;
  for (const [key, opts] of Object.entries(table)) {
    if (!opts || typeof opts !== 'object') continue;
    for (const [optStr, lvl] of Object.entries(opts)) {
      const option = toOption(optStr);
      if (!option) continue;
      const level = clampLevel(lvl);
      if (level <= 0) continue;
      out.push({ track, key, option, level });
    }
  }
  return out;
}

/**
 * 디버그 시드 원시 객체를 적용 가능한 op 목록으로 정규화한다 — 순수 함수(cc import 없음).
 * 알 수 없는 옵션·비수치 값·범위 밖 레벨을 방어적으로 걸러 잘못된 시드가 게임을 깨지 않게 한다.
 * @param raw 시드 파일 JSON(부분/누락 가능). null/undefined면 빈 ops.
 */
export function parseDebugEnhancementSeed(
  raw: IDebugEnhancementSeed | null | undefined,
): DebugSeedOps {
  if (!raw || typeof raw !== 'object') return { raises: [], globals: [] };

  const raises = [
    ...collectRaises(UpgradeTrack.Individual, raw.individual),
    ...collectRaises(UpgradeTrack.Category, raw.category),
  ];

  const globals: DebugGlobalOp[] = [];
  if (raw.global && typeof raw.global === 'object') {
    for (const [optStr, bonus] of Object.entries(raw.global)) {
      const option = toOption(optStr);
      if (!option) continue;
      if (typeof bonus !== 'number' || !Number.isFinite(bonus)) continue;
      globals.push({ option, bonus });
    }
  }

  return { raises, globals };
}
