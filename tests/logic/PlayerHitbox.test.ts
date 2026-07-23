import { describe, expect, it } from 'vitest';
import { circleIntersectsBox } from '../../game/assets/scripts/logic/HitboxLogic';

/**
 * 플레이어 AABB 피해 히트박스 판정 순수 로직 (ADR 006, 2026-07-23-player-hitbox-plan.md).
 *
 * 플레이어의 피해 히트박스 = 축정렬 박스(중심 + 반너비 halfW·반높이 halfH). 적·적 발사체는 원
 * (중심 + 반지름). `circleIntersectsBox`는 둘의 겹침을, 원 중심을 박스 범위로 clamp한 최근접점과
 * 원 중심 사이 거리로 판정한다 — `ObstacleLogic.resolveCircleMove`의 사각형 침투식과 동형이다.
 * 접함(거리 == 반지름)은 겹침이 아니다(`< r²`로 판정) — resolveCircleMove가 `d2 >= r2`를 "안 밀어냄"
 * 으로 보는 것과 일치시켜, 이동 해소와 피해 판정이 같은 경계 규약을 쓴다.
 *
 * 소비처 배선(EnemyController._checkContactDamage 1곳 + EnemyProjectile._checkPlayerHit 1곳)과
 * player.json 데이터 로드는 cc 의존이라 여기서 다루지 않는다(7단계 수동 QA).
 */

// 플레이어 피해 박스 실측값(player.json): 36×60 → 반너비 18·반높이 30.
const PW = 18;
const PH = 30;

describe('circleIntersectsBox — 원(적) 대 박스(플레이어 피해 히트박스)', () => {
  it('원 중심이 박스 안이면 겹친다', () => {
    expect(circleIntersectsBox(0, 0, 8, 0, 0, PW, PH)).toBe(true);
  });

  it('원이 박스에서 충분히 멀면 안 겹친다', () => {
    expect(circleIntersectsBox(100, 0, 8, 0, 0, PW, PH)).toBe(false);
  });

  it('면에 정확히 접하면(거리 == 반지름) 겹침이 아니다', () => {
    // 오른면 x=18에서 반지름 8만큼 떨어진 x=26 → 최근접점 (18,0), 거리 8 == r
    expect(circleIntersectsBox(PW + 8, 0, 8, 0, 0, PW, PH)).toBe(false);
  });

  it('면을 반지름보다 가깝게 파고들면 겹친다', () => {
    expect(circleIntersectsBox(PW + 8 - 1, 0, 8, 0, 0, PW, PH)).toBe(true);
  });

  it('세로로 긴 박스는 머리 높이 명중을 잡는다 (원-원이면 놓칠 지점)', () => {
    // y=28은 박스 높이(±30) 안이라 겹침. 반지름 25 원(옛 판정)이면 원점에서 28>25라 놓쳤을 지점.
    expect(circleIntersectsBox(0, 28, 2, 0, 0, PW, PH)).toBe(true);
  });

  it('좌우로 스쳐 지나가는 원은 안 겹친다 (세로 원이면 났을 억울한 피격 제거)', () => {
    // x=28은 박스 폭(±18) 밖. 최근접점 (18,0), 거리 10 > 반지름 8.
    // 높이(30)에 맞춘 원이었다면 28<30이라 억울하게 맞았을 지점.
    expect(circleIntersectsBox(28, 0, 8, 0, 0, PW, PH)).toBe(false);
  });

  it('코너 근처 — 최근접점이 코너, 접함은 겹침 아님·더 크면 겹침', () => {
    // 코너 (18,30)에서 (3,4)만큼 밖 → 거리 5. r=5면 접함(false), r=6이면 겹침(true).
    expect(circleIntersectsBox(PW + 3, PH + 4, 5, 0, 0, PW, PH)).toBe(false);
    expect(circleIntersectsBox(PW + 3, PH + 4, 6, 0, 0, PW, PH)).toBe(true);
  });

  it('박스 중심이 원점이 아니어도(플레이어 위치) 동작한다', () => {
    expect(circleIntersectsBox(100, 200, 8, 100, 200, PW, PH)).toBe(true);
    expect(circleIntersectsBox(100 + PW + 20, 200, 8, 100, 200, PW, PH)).toBe(false);
  });
});
