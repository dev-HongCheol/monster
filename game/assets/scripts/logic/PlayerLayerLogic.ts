import type { Facing } from './FacingLogic';

/**
 * 층별 프레임을 재생하는 동기화 컴포넌트가 쓰는 순수 함수들 — 시계와 프레임 번호, 프레임 이름, 층별 프레임 수
 * 검사, 빠진 프레임 처리, 방향별 겹치는 순서.
 *
 * 값과 규칙의 주인은 굽기 도구다(`tools/blender/`의 `MotionSpec.ts` · `Atlas.ts` · `LayerBake.ts`). Cocos 스크립트는
 * `game/assets` 밖을 import할 수 없어 같은 값을 여기 따로 들고, 두 쪽이 같은지는 `tests/logic/Blender3dGate.test.ts`가
 * 단언한다. 한쪽만 고치면 굽기가 잰 것과 다른 순서 · 속도 · 이름으로 재생되는데, 그림만 봐서는 드러나지 않는다.
 */

/** 구운 동작. 걷기는 이동 입력이 있을 때, 대기는 없을 때다. */
export type LayerAction = 'walk' | 'idle';

/** 겹치는 순서 안의 자리. 상의 자리에는 입은 상의 층(`topA` · `topB`)이 온다. */
export type StackSlot = 'body' | 'top' | 'staff' | 'shield';

/** 재생 상태. `elapsed`는 지금 동작의 한 주기 안에서 흐른 초다. */
export interface IAnimState {
  action: LayerAction;
  facing: Facing;
  /** 지금 동작의 한 주기 안에서 흐른 시간(초) — 주기를 넘으면 나머지로 감긴다 */
  elapsed: number;
  /** 아틀라스에서 꺼낼 프레임 번호(0부터) */
  index: number;
}

/** 한 프레임의 입력. 셋은 `PlayerController`의 getter에서 읽는다. */
export interface IAnimInput {
  facing: Facing;
  /** 이동 입력이 있는가 — 실제 변위가 아니라 입력 의도다(`FacingLogic`과 같은 기준) */
  moving: boolean;
  /** 시계를 돌려도 되는가 — 데이터가 준비됐고 게임이 Playing일 때만 참 */
  ticking: boolean;
  /** 이번 프레임에 흐른 시간(초) */
  dt: number;
}

/** 동작별 재생 속도(초당 장 수) */
export interface IAnimFps {
  walk: number;
  idle: number;
}

/** 동작별로 아틀라스에 구워진 장 수 */
export interface IAnimCounts {
  walk: number;
  idle: number;
}

/** 재생 설정. 속도는 컴포넌트 속성에서, 장 수는 아틀라스에서 온다. */
export interface IAnimConfig {
  fps: IAnimFps;
  counts: IAnimCounts;
}

/** (방향, 동작)에서 층끼리 장 수가 다른 조합 하나 */
export interface ILayerMismatch {
  facing: string;
  action: string;
  /** 층 이름 → 그 조합의 장 수. 그 조합이 없는 층은 0이다 */
  counts: Record<string, number>;
}

/**
 * 기본 재생 속도 — 굽기 도구의 확정값(`MotionSpec.ts`의 `CHOSEN_MOTION`)과 같다. 재생 속도는 굽기에 박히지 않아
 * 컴포넌트가 속성으로 받고 인게임에서 다시 맞출 수 있는데, 그 출발점이 후보 화면에서 사용자가 본 값이어야 한다.
 */
export const DEFAULT_ANIM_FPS: IAnimFps = { walk: 10, idle: 3 };

/**
 * 대기의 재생 순서 — 굽기 도구의 `IDLE_PLAYBACK.order`와 같다. 숨쉬기는 들이쉬는 절반과 내쉬는 절반이 같은 자세를
 * 거꾸로 지나가므로 세 장만 굽고 0 → 1 → 2 → 1로 되짚는다. 번호를 그대로 쓰면 0 → 1 → 2 → 0으로 돌아 내쉬는 절반이
 * 빠진다.
 */
export const IDLE_ORDER: readonly number[] = [0, 1, 2, 1];

/**
 * 방향마다 층을 겹치는 순서(아래부터) — `LayerBake.ts`의 `STACK_ORDER`와 같은 값이다(G4 §5.1 채택, 왼쪽은 §12.1).
 *
 * 무기 층은 맨살 몸으로만 가려 구워져, 옷이 맨살보다 나온 만큼의 무기 픽셀이 남아 있다. 뒤에서 보면 두 무기가 몸통보다
 * 카메라에서 멀어 그 픽셀을 상의가 덮어야 하고, 왼쪽에서 보면 지팡이만 먼 쪽 손에 있어 카메라 쪽 팔의 소매가 그
 * 앞을 지나므로 지팡이만 상의 아래다. 순서를 안 바꾸면 뒷모습에서 상의 뒤에 있어야 할 방패가 상의 앞에 그려진다
 * (G4 실측 — 상의 A에서 11장에 1,843px, 바꾸면 111px).
 */
export const STACK_ORDER: Record<Facing, readonly StackSlot[]> = {
  front: ['body', 'top', 'staff', 'shield'],
  right: ['body', 'top', 'staff', 'shield'],
  back: ['body', 'staff', 'shield', 'top'],
  left: ['body', 'staff', 'top', 'shield'],
};

/** 프레임 이름 규칙 — `Atlas.ts`의 `FRAME_NAME_PATTERN`과 같은 모양이다. */
const FRAME_NAME_PATTERN = /^([A-Za-z0-9]+)_([A-Za-z0-9]+)_([A-Za-z0-9]+)_(\d{2,})$/;

/** 시작 상태 — 정면 대기 0번. */
export function createAnimState(): IAnimState {
  return { action: 'idle', facing: 'front', elapsed: 0, index: 0 };
}

/**
 * 한 프레임만큼 시계를 돌려 다음 재생 상태를 낸다.
 *
 * - `ticking`이 거짓이면 아무것도 바꾸지 않고 같은 상태를 돌려준다 — 일시정지 · 레벨업 중에는 호출부가 아니라 이
 *   입력이 시계를 멈춘다.
 * - 동작이 바뀌면(멈춤 ↔ 걷기) 시계와 번호를 0으로 돌린다. 걷다 멈추면 대기의 첫 장부터다.
 * - 같은 동작이면 시계에 `dt`를 더하고 한 주기의 나머지로 감는다. 큰 `dt`는 여러 장을 건너뛰고, 방향만 바뀐 경우는
 *   시계와 번호가 이어진다 — 방향 전환마다 0번으로 돌아가면 좌우를 번갈아 누를 때 같은 장만 반복돼 걷지 않는
 *   것처럼 보인다.
 * - 번호는 `floor(elapsed × fps)`를 한 주기의 칸 수로 나눈 나머지다. 걷기는 그 값이 곧 프레임 번호이고, 대기는
 *   `IDLE_ORDER`를 거친다.
 *
 * @param state 직전 상태
 * @param input 이번 프레임의 방향 · 이동 · 진행 여부 · 시간
 * @param config 동작별 속도와 장 수. 장 수나 속도가 0 이하면 그 동작은 0번에 머문다
 * @returns 다음 상태. 바뀐 것이 없으면 `state` 그대로다
 */
export function advanceAnim(state: IAnimState, input: IAnimInput, config: IAnimConfig): IAnimState {
  if (!input.ticking) return state;
  const action: LayerAction = input.moving ? 'walk' : 'idle';
  if (action !== state.action) {
    return { action, facing: input.facing, elapsed: 0, index: 0 };
  }
  const fps = config.fps[action];
  const steps = action === 'walk' ? config.counts.walk : IDLE_ORDER.length;
  if (fps <= 0 || steps <= 0 || config.counts[action] <= 0) {
    return { action, facing: input.facing, elapsed: 0, index: 0 };
  }
  const period = steps / fps;
  let elapsed = state.elapsed + input.dt;
  if (elapsed >= period) elapsed %= period;
  const step = Math.floor(elapsed * fps) % steps;
  // 대기 순서표의 값이 구운 장 수를 넘으면(장이 모자란 아틀라스) 마지막 장에 머문다 — 빈 칸을 가리키지 않게
  const index = action === 'walk' ? step : Math.min(IDLE_ORDER[step], config.counts.idle - 1);
  return { action, facing: input.facing, elapsed, index };
}

/**
 * 프레임 이름을 만든다 — 확장자를 붙이지 않는다. 아틀라스 작성기(`Atlas.ts`의 `frameName`)와 같은 문자열이어야
 * 아틀라스에서 프레임이 찾아진다. 번호를 두 자리로 채우는 것은 에디터 자산 목록의 사전순을 번호순과 맞추기
 * 위해서다.
 *
 * @param layer 층 이름 (`body` · `topA` · `topB` · `staff` · `shield`)
 * @param action 동작 이름 (`walk` · `idle`)
 * @param facing 방향 이름 (`front` · `back` · `left` · `right`)
 * @param index 0부터 세는 프레임 번호
 */
export function frameName(layer: string, action: string, facing: string, index: number): string {
  return `${layer}_${action}_${facing}_${String(index).padStart(2, '0')}`;
}

/**
 * 층별 프레임 이름 목록에서 (방향, 동작)마다 장 수가 다른 조합을 찾는다.
 *
 * 한 층만 한 장이 빠지면 그 조합에서 층끼리 다른 장이 겹쳐 보인다. 어느 조합이 몇 장인지가 오류 메시지에 들어가야
 * 아틀라스 열 개 중 무엇을 다시 넣을지 알 수 있다.
 *
 * @param namesByLayer 층 이름 → 그 층의 아틀라스에 든 프레임 이름들. 이름 규칙에 안 맞는 항목은 세지 않는다
 * @returns 장 수가 층마다 같지 않은 (방향, 동작) 목록. 전부 같으면 빈 배열
 */
export function validateLayers(namesByLayer: Record<string, readonly string[]>): ILayerMismatch[] {
  const layers = Object.keys(namesByLayer);
  const counts = new Map<string, Record<string, number>>();
  for (const layer of layers) {
    for (const name of namesByLayer[layer]) {
      const match = FRAME_NAME_PATTERN.exec(name);
      if (match === null) continue;
      const key = `${match[3]}|${match[2]}`;
      let row = counts.get(key);
      if (!row) {
        row = {};
        for (const each of layers) row[each] = 0;
        counts.set(key, row);
      }
      row[layer] += 1;
    }
  }
  const mismatches: ILayerMismatch[] = [];
  for (const [key, row] of counts) {
    const values = layers.map((layer) => row[layer]);
    if (values.every((value) => value === values[0])) continue;
    const [facing, action] = key.split('|');
    mismatches.push({ facing, action, counts: row });
  }
  return mismatches;
}

/**
 * 아틀라스에서 못 찾은 프레임을 처리한다 — 직전 프레임을 유지하고, 같은 이름은 한 번만 알린다.
 *
 * `null`을 그대로 넣으면 그 장에서 층이 사라져 캐릭터가 깜빡이고, 매 프레임 로그를 남기면 초당 수십 줄이 쌓여
 * 정작 어느 이름이 빠졌는지 못 읽는다.
 *
 * @param found 아틀라스에서 찾은 프레임. 없으면 `null`
 * @param prev 직전에 그린 프레임. 처음이면 `null`
 * @param name 찾으려던 프레임 이름 — 알림을 이름마다 한 번으로 묶는 열쇠다
 * @param reported 이미 알린 이름들. 이 함수가 더한다
 * @returns 그릴 프레임과, 이번에 알려야 하는지
 */
export function resolveLayerFrame<T>(
  found: T | null,
  prev: T | null,
  name: string,
  reported: Set<string>,
): { frame: T | null; report: boolean } {
  if (found !== null) return { frame: found, report: false };
  const report = !reported.has(name);
  if (report) reported.add(name);
  return { frame: prev, report };
}

/**
 * 그 방향에서 시각 층을 겹치는 순서(아래부터). 방향에만 달렸고 동작 · 프레임과 무관하다 — G4가 재 보니 한 방향
 * 안에서는 장마다 순서가 바뀌지 않았다.
 */
export function stackOrder(facing: Facing): readonly StackSlot[] {
  return STACK_ORDER[facing];
}
