/**
 * fal.ai 매팅 모델 호출 — 키 로딩·업로드·호출·내려받기·캐시가 여기 모인다.
 *
 * 판정과 크롭이 순수 함수인 것과 달리 이 파일은 네트워크와 돈을 만진다. 그래서 지키는
 * 것이 셋이다. **캐시**로 같은 입력에 두 번 과금하지 않고, **호출 상한**으로 요율을 모르는
 * 모델이 계정 잔액까지 태우는 일을 막고, **크기 단언**으로 잘린 응답이 조용히 통과하는
 * 것을 막는다. 마지막 하나가 특히 중요한데, PNG 디코더는 대개 지연 로딩이라 응답이
 * 중간에 끊겨도 예외 없이 열리고 그림만 잘려 있다.
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fal } from '@fal-ai/client';
import { decodePng } from './PngCodec.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** 받은 PNG를 두는 자리. `docs/temp/`는 `.gitignore` 대상이라 결과물이 커밋되지 않는다. */
const CACHE_DIR = path.join(ROOT, 'docs/temp/matting-cache');

/**
 * 한 번 실행에서 허용하는 최대 호출 수.
 *
 * `birefnet/v2`가 compute second 과금이라 장당 단가가 미리 정해져 있지 않다. 상한이 없으면
 * 루프 하나가 잘못 돌 때 실질 한도가 계정 잔액뿐이 된다. 판정에 필요한 호출은 패널 3장 ×
 * 모델 2종 = 6회이고, 전량 재처리도 13장 × 1종 = 13회다.
 */
const MAX_CALLS_PER_RUN = 30;

let callsMade = 0;

/** 매팅 결과 한 장과 그것이 어디서 왔는지. */
export interface IMatteResult {
  /** 매팅된 PNG 바이트(알파 포함) */
  bytes: Uint8Array;
  /** 캐시에서 꺼냈으면 true — 이번 실행에서 과금되지 않았다는 뜻이다 */
  cached: boolean;
  /** 캐시 파일 경로. 사람이 눈으로 열어 보려면 여기다 */
  cachePath: string;
}

/**
 * `FAL_KEY`를 환경변수에서 찾고, 없으면 레포 루트의 `.env`에서 읽는다.
 *
 * 환경변수를 먼저 보는 이유는 임시로 다른 키를 쓸 때 파일을 안 고쳐도 되게 하기 위해서다.
 *
 * @throws 양쪽 다 없거나 값이 비어 있으면
 */
export function loadFalKey(): string {
  const fromEnv = process.env.FAL_KEY?.trim();
  if (fromEnv) return fromEnv;

  const envFile = path.join(ROOT, '.env');
  if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
      const m = /^\s*FAL_KEY\s*=\s*(.*)$/.exec(line);
      if (!m) continue;
      const value = m[1].trim().replace(/^["']|["']$/g, '');
      if (value) return value;
    }
  }

  throw new Error(
    'FAL_KEY가 없다. `.env.example`을 `.env`로 복사해 값을 채우거나 환경변수로 둔다.',
  );
}

/** 캐시 파일명 — 모델과 입력 바이트가 같으면 같은 이름이 나온다. */
function cacheKey(model: string, bytes: Uint8Array): string {
  const digest = createHash('sha256').update(bytes).digest('hex').slice(0, 16);
  return `${model.replace(/\//g, '_')}__${digest}.png`;
}

/**
 * 패널 한 장을 매팅 모델에 넣고 알파가 붙은 PNG를 받는다.
 *
 * @param bytes 배경이 남아 있는 원본 패널 PNG
 * @param model fal 엔드포인트 전체 경로(예: `fal-ai/bria/background/remove`)
 * @returns 매팅 결과. 같은 입력을 다시 넣으면 캐시에서 꺼내 과금이 없다
 * @throws 호출 상한을 넘겼거나, 응답 크기가 입력과 다르거나, 내려받기가 실패하면
 */
export async function matte(bytes: Uint8Array, model: string): Promise<IMatteResult> {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const cachePath = path.join(CACHE_DIR, cacheKey(model, bytes));
  if (fs.existsSync(cachePath)) {
    return { bytes: new Uint8Array(fs.readFileSync(cachePath)), cached: true, cachePath };
  }

  if (callsMade >= MAX_CALLS_PER_RUN) {
    throw new Error(`호출 상한 ${MAX_CALLS_PER_RUN}회를 넘었다 — 루프를 확인한다.`);
  }

  fal.config({ credentials: loadFalKey() });

  // 입력은 공개로 올릴 수밖에 없다. 모델 러너가 이 URL을 **평범한 HTTP GET으로 내려받기**
  // 때문이다 — 2026-08-21에 `initialAcl: { default: 'forbid' }`로 올려 봤더니 공개 GET이 403이
  // 되면서 러너도 못 받았고, 호출이 422 `file_download_error`로 떨어졌다. 그래서 노출을 막는
  // 수단은 접근 제어가 아니라 **수명**이다. 한 시간이면 호출이 끝나고도 남는다.
  const uploaded = await fal.storage.upload(new File([bytes], 'panel.png', { type: 'image/png' }), {
    lifecycle: { expiresIn: '1h' },
  });

  // 상한은 실제로 과금이 발생하는 이 자리에서 센다. 업로드나 검증에서 떨어진 호출까지
  // 세면 「과금된 호출 N회」가 거짓이 되고, 그 숫자를 보고 비용을 판단하게 된다.
  callsMade++;
  const result = await fal.subscribe(model, { input: { image_url: uploaded } });
  const url = (result.data as { image?: { url?: string } }).image?.url;
  if (!url) throw new Error(`${model} 응답에 image.url이 없다: ${JSON.stringify(result.data)}`);

  const response = await fetch(url);
  if (!response.ok) throw new Error(`결과 내려받기 실패(${response.status}): ${url}`);
  const out = new Uint8Array(await response.arrayBuffer());

  // 잘린 응답은 예외 없이 열리고 그림만 짧다. 여기서 막지 않으면 판정이 잘린 그림을 잰다.
  const before = decodePng(bytes);
  const after = decodePng(out);
  if (before.width !== after.width || before.height !== after.height) {
    throw new Error(
      `${model}이 크기를 바꿨다: ${before.width}×${before.height} → ${after.width}×${after.height}`,
    );
  }

  fs.writeFileSync(cachePath, out);
  return { bytes: out, cached: false, cachePath };
}

/** 이번 실행에서 실제로 과금된 호출 수. 캐시로 처리된 것은 세지 않는다. */
export function callsUsed(): number {
  return callsMade;
}
