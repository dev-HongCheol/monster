/** 궤도 오브 한 개의 월드 좌표. */
export interface OrbPosition {
  x: number;
  y: number;
}

/** 시전(spawn) 시 고정하는 한 궤도의 스냅샷 입력. */
export interface OrbitSpawnConfig {
  /** 오브 수 (기본 + 강화 보너스) */
  count: number;
  /** 오브 충돌 반경 (= 오브 크기, 범위 강화 반영 후) */
  orbSize: number;
  /** 타격당 피해 (강화·페널티 반영 후) */
  damage: number;
  /** 활성 수명 (sec, 지속 강화 반영 후) */
  lifetime: number;
  /** 회전 속도 (deg/sec) */
  rotationSpeedDeg: number;
}

/** advance가 돌려주는 활성 궤도 한 줄 — 이번 프레임 타격에 쓸 스냅샷. */
export interface ActiveOrbit {
  spellId: string;
  count: number;
  orbSize: number;
  damage: number;
}

/** advance 결과 — 이번 프레임 활성 궤도 목록 + 이번 프레임 만료된 궤도 id 목록. */
export interface OrbitAdvanceResult {
  active: ActiveOrbit[];
  expired: string[];
}

/** 인접 오브가 겹치지 않게 두는 간격 여유 비율 (중심간 현 ≥ 2·orbSize·(1+GAP)). */
export const ORB_GAP = 0.15;
/** 링이 플레이어에 파묻히지 않게 두는 여유 (units). */
export const ORB_MARGIN = 10;

/** 한 궤도의 런타임 상태 (단일 인스턴스 — 재시전은 갱신). */
interface OrbitState {
  /** 누적 회전각 (deg, 0~360) */
  theta: number;
  /** 남은 활성 수명 (sec) */
  remainingLife: number;
  count: number;
  orbSize: number;
  damage: number;
  rotationSpeedDeg: number;
}

/**
 * 궤도형(Orbit) 마법의 회전·활성 수명·재타격 락아웃·링 기하를 관리하는 순수 로직 — cc import 없음.
 *
 * 인페르노 슬라이스(`2026-06-24-inferno-plan.md`) 근거:
 * - 마법 1종당 궤도 하나(단일 인스턴스). 재시전은 수명·수·크기·데미지를 새 스냅샷으로 갱신(§6.4).
 * - 회전·수명 진행(`advance`), 동적 링 반경(`ringRadius`), 오브 배치(`orbPositions`)는 순수 함수.
 * - 같은 (오브, 적) 짝의 매 프레임 도배를 막는 재타격 락아웃(`canHit`/`registerHit`/`tickRehit`, §6.1).
 */
export class OrbitLogic {
  /** spellId → 궤도 상태 (단일 인스턴스) */
  private _orbits = new Map<string, OrbitState>();
  /** `${spellId}:${orbIndex}:${spawnId}` → 잔여 재타격 락아웃(sec). spellId까지 키에 넣어 둘 이상의 궤도
   *  마법이 같은 (오브 인덱스, 적)에서 서로의 락아웃을 덮어쓰지 않게 한다(궤도별 독립). */
  private _rehit = new Map<string, number>();

  /**
   * 궤도를 시전(또는 갱신)한다. 이미 있으면 회전각(theta)은 이어가고 나머지 수치는 새 스냅샷으로
   * 덮어쓴다 — 재시전이 인스턴스를 둘로 늘리지 않고, 각도가 튀지 않게 한다(§6.4 단일 인스턴스 갱신).
   * @param spellId 마법 id
   * @param cfg 이번 시전의 스냅샷(오브 수·크기·피해·수명·회전속도)
   */
  spawn(spellId: string, cfg: OrbitSpawnConfig): void {
    const existing = this._orbits.get(spellId);
    this._orbits.set(spellId, {
      theta: existing?.theta ?? 0,
      remainingLife: cfg.lifetime,
      count: cfg.count,
      orbSize: cfg.orbSize,
      damage: cfg.damage,
      rotationSpeedDeg: cfg.rotationSpeedDeg,
    });
  }

  /**
   * 모든 활성 궤도의 회전각을 전진시키고 수명을 깎는다. 수명이 다한 궤도는 제거하고 expired에 담는다.
   * @param dt 프레임 델타 (sec)
   * @returns 이번 프레임 활성 궤도 + 만료된 궤도 id
   */
  advance(dt: number): OrbitAdvanceResult {
    const active: ActiveOrbit[] = [];
    const expired: string[] = [];
    for (const [spellId, o] of this._orbits) {
      o.theta = (o.theta + o.rotationSpeedDeg * dt) % 360;
      if (o.theta < 0) o.theta += 360; // 음수 회전속도 방어 — 항상 0~360
      o.remainingLife -= dt;
      if (o.remainingLife <= 0) {
        this._orbits.delete(spellId);
        expired.push(spellId);
      } else {
        active.push({ spellId, count: o.count, orbSize: o.orbSize, damage: o.damage });
      }
    }
    return { active, expired };
  }

  /**
   * 동적 링 반경을 계산한다 (§6.2) — 오브끼리 겹치거나(① 간격) 플레이어에 파묻히지(② 여유) 않게,
   * 휴식 거리 바닥값(③) 이상으로. 셋 중 가장 큰 값을 쓴다.
   * @param count 오브 수
   * @param orbSize 오브 충돌 반경
   * @param playerRadius 플레이어 충돌 반경
   * @param baseRing 기본(최소) 링 반경 = 데이터 `orbitRadius`
   * @param gap 인접 오브 간격 여유 비율 (데이터 `orbGap`, 생략 시 `ORB_GAP`). 음수면 겹침을 허용해
   *   간격 항이 작아져 링이 안쪽으로 당겨진다.
   */
  ringRadius(
    count: number,
    orbSize: number,
    playerRadius: number,
    baseRing: number,
    gap: number = ORB_GAP,
  ): number {
    // ① 인접 오브 안 겹치게: 중심간 현 2R·sin(π/N) ≥ 2·orbSize → R ≥ orbSize·(1+gap)/sin(π/N).
    //    gap<0이면 겹침 허용(현 < 2·orbSize). count<2면 분모 sin(π/1)=0이라 0 나눗셈 → 간격 항 0(방어).
    const spacingRing = count >= 2 ? (orbSize * (1 + gap)) / Math.sin(Math.PI / count) : 0;
    // ② 플레이어에 안 파묻히게.
    const clearanceRing = playerRadius + orbSize + ORB_MARGIN;
    return Math.max(spacingRing, clearanceRing, baseRing);
  }

  /**
   * 한 궤도의 오브들을 360/N 균등 각도로 배치한 월드 좌표를 돌려준다. 회전각(theta)은 내부 상태에서 읽는다.
   * @param spellId 마법 id (회전각 출처)
   * @param count 오브 수
   * @param ring 링 반경 (`ringRadius` 결과)
   * @param cx 중심 x (플레이어 위치)
   * @param cy 중심 y
   */
  orbPositions(
    spellId: string,
    count: number,
    ring: number,
    cx: number,
    cy: number,
  ): OrbPosition[] {
    const theta = this._orbits.get(spellId)?.theta ?? 0;
    const step = count > 0 ? 360 / count : 360;
    const positions: OrbPosition[] = [];
    for (let i = 0; i < count; i++) {
      const rad = ((theta + i * step) * Math.PI) / 180;
      positions.push({ x: cx + ring * Math.cos(rad), y: cy + ring * Math.sin(rad) });
    }
    return positions;
  }

  /** 모든 재타격 락아웃을 dt만큼 감소시키고 0 이하가 된 것을 해제한다. */
  tickRehit(dt: number): void {
    for (const [key, remaining] of this._rehit) {
      const next = remaining - dt;
      if (next <= 0) this._rehit.delete(key);
      else this._rehit.set(key, next);
    }
  }

  /**
   * 이 (마법, 오브, 적) 짝이 지금 타격 가능한지 — 락아웃에 없으면 가능.
   * @param spellId 마법 id (궤도별 독립 락아웃)
   * @param orbIndex 오브 인덱스
   * @param spawnId 적 spawnId (풀 재사용 안정 식별자)
   */
  canHit(spellId: string, orbIndex: number, spawnId: number): boolean {
    return !this._rehit.has(`${spellId}:${orbIndex}:${spawnId}`);
  }

  /**
   * 이 (마법, 오브, 적) 짝에 재타격 락아웃을 건다.
   * @param spellId 마법 id (궤도별 독립 락아웃)
   * @param orbIndex 오브 인덱스
   * @param spawnId 적 spawnId
   * @param cooldownSec 락아웃 시간 (sec)
   */
  registerHit(spellId: string, orbIndex: number, spawnId: number, cooldownSec: number): void {
    this._rehit.set(`${spellId}:${orbIndex}:${spawnId}`, cooldownSec);
  }
}
