import { describe, expect, it } from 'vitest';
import { ObjectPoolLogic } from '../../game/assets/scripts/logic/ObjectPoolLogic';

/**
 * 계획 문서(2026-06-06-object-pooling-plan.md §2.2)의 순수 풀 장부.
 * 가용 목록 재사용 / 생성 팩토리 주입 / idle 보관 한도(maxFree) / 카운터.
 * cc 비의존이라 결정적으로 테스트 가능. 실제 cc.Node 토글은 PoolManager 책임.
 *
 * 테스트에서 항목 타입 T는 number — 단조 증가 카운터를 create로 주입해
 * "신규 생성 vs 재사용"을 항목 동일성(===)으로 검증한다.
 */
function makeFactory(): () => number {
  let n = 0;
  return () => ++n;
}

describe('ObjectPoolLogic — 신규 풀', () => {
  it('free/total/active 모두 0', () => {
    const pool = new ObjectPoolLogic<number>();
    expect(pool.freeCount).toBe(0);
    expect(pool.totalCount).toBe(0);
    expect(pool.activeCount).toBe(0);
  });
});

describe('ObjectPoolLogic — acquire (빈 풀)', () => {
  it('빈 풀이면 create()를 호출해 새 항목을 만들고 추적한다', () => {
    const pool = new ObjectPoolLogic<number>();
    let created = 0;
    const make = () => ++created;

    const item = pool.acquire(make);

    expect(item).toBe(1);
    expect(created).toBe(1);
    expect(pool.totalCount).toBe(1);
    expect(pool.activeCount).toBe(1);
    expect(pool.freeCount).toBe(0);
  });
});

describe('ObjectPoolLogic — release', () => {
  it('항목을 가용 목록으로 반환하고 true를 돌려준다', () => {
    const pool = new ObjectPoolLogic<number>();
    const a = pool.acquire(makeFactory());

    const retained = pool.release(a);

    expect(retained).toBe(true);
    expect(pool.freeCount).toBe(1);
    expect(pool.activeCount).toBe(0);
    expect(pool.totalCount).toBe(1);
  });
});

describe('ObjectPoolLogic — 재사용', () => {
  it('release 후 acquire는 create 재호출 없이 그 항목을 반환한다', () => {
    const pool = new ObjectPoolLogic<number>();
    let created = 0;
    const make = () => ++created;

    const a = pool.acquire(make); // created=1
    pool.release(a);
    const b = pool.acquire(make); // 재사용 — create 호출 안 함

    expect(b).toBe(a);
    expect(created).toBe(1); // 신규 생성 없음
    expect(pool.totalCount).toBe(1); // 누적 불변
    expect(pool.activeCount).toBe(1);
    expect(pool.freeCount).toBe(0);
  });

  it('가용분이 모두 소진되면 다시 create한다', () => {
    const pool = new ObjectPoolLogic<number>();
    let created = 0;
    const make = () => ++created;

    const a = pool.acquire(make); // 1
    pool.release(a);
    pool.acquire(make); // 재사용(a)
    pool.acquire(make); // 가용 없음 → 신규 2

    expect(created).toBe(2);
    expect(pool.totalCount).toBe(2);
    expect(pool.activeCount).toBe(2);
  });
});

describe('ObjectPoolLogic — 다중 acquire/release', () => {
  it('acquire 3 / release 2 / acquire 2 시 재사용분만 반환하고 신규 생성은 없다', () => {
    const pool = new ObjectPoolLogic<number>();
    let created = 0;
    const make = () => ++created;

    const a = pool.acquire(make); // 1
    const b = pool.acquire(make); // 2
    const c = pool.acquire(make); // 3
    expect(pool.activeCount).toBe(3);
    expect(pool.totalCount).toBe(3);

    pool.release(a);
    pool.release(b);
    expect(pool.freeCount).toBe(2);
    expect(pool.activeCount).toBe(1);

    const r1 = pool.acquire(make);
    const r2 = pool.acquire(make);

    expect(created).toBe(3); // 신규 생성 없음 — 재사용만
    expect([r1, r2]).toContain(a);
    expect([r1, r2]).toContain(b);
    expect(r1).not.toBe(c);
    expect(r2).not.toBe(c);
    expect(pool.freeCount).toBe(0);
    expect(pool.activeCount).toBe(3);
    expect(pool.totalCount).toBe(3);
  });
});

describe('ObjectPoolLogic — 보관 한도(maxFree)', () => {
  it('한도 내 release는 보관(true), 초과 release는 폐기(false) + 총량 감소', () => {
    const pool = new ObjectPoolLogic<number>(2); // idle 최대 2개 보관
    const make = makeFactory();

    const a = pool.acquire(make);
    const b = pool.acquire(make);
    const c = pool.acquire(make);
    expect(pool.totalCount).toBe(3);

    expect(pool.release(a)).toBe(true); // free=1
    expect(pool.release(b)).toBe(true); // free=2 (한도 도달)
    expect(pool.release(c)).toBe(false); // 한도 초과 → 폐기

    expect(pool.freeCount).toBe(2);
    expect(pool.totalCount).toBe(2); // c 폐기 → 누적 감소
    expect(pool.activeCount).toBe(0);
  });

  it('maxFree=0(기본)이면 무제한 보관', () => {
    const pool = new ObjectPoolLogic<number>(0);
    const make = makeFactory();
    const items = [pool.acquire(make), pool.acquire(make), pool.acquire(make)];

    for (const it of items) expect(pool.release(it)).toBe(true);

    expect(pool.freeCount).toBe(3);
    expect(pool.totalCount).toBe(3);
  });
});

describe('ObjectPoolLogic — 멱등 release', () => {
  it('같은 항목을 중복 release해도 가용 목록에 중복 적재하지 않는다', () => {
    const pool = new ObjectPoolLogic<number>();
    const a = pool.acquire(makeFactory());

    expect(pool.release(a)).toBe(true);
    expect(pool.release(a)).toBe(true); // 멱등 no-op (폐기 신호 false 아님)

    expect(pool.freeCount).toBe(1); // 중복 적재 없음
    expect(pool.totalCount).toBe(1);
    expect(pool.activeCount).toBe(0);
  });
});
