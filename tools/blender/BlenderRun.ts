/**
 * Blender를 띄워 굽기 스크립트 하나를 돌리고 판정 줄의 값을 돌려준다. 여러 굽기를 동시에 돌리는 풀도 든다.
 *
 * **스크립트를 가리지 않는다.** G2 실행기(`retired/gear.ts`, G4를 닫으며 지웠다)의 `bakeAsync`는 `probe_layers.py`의 인자를 그 안에서 짜서
 * 다른 스크립트를 부를 수 없었다. 걷기 굽기(`bake_motion.py`)가 생기면서 부르는 부분만 떼어 일반형으로 둔다.
 * G4의 생산 굽기 도구도 이 파일을 쓴다.
 *
 * **성공과 실패는 종료 코드가 아니라 판정 줄로 가른다.** `blender --background --python`은 스크립트가 예외를
 * 던져도 0을 낼 수 있고, EEVEE가 컨텍스트를 못 잡아 시그널로 죽으면 `--python-exit-code`도 발화하지 않는다.
 * 그래서 stdout에서 `GATE_OK` · `GATE_FAIL` 줄을 찾고(`tests/helpers/GateLine.ts`), 없으면 실패로 접는다.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parseGateLine } from '../../tests/helpers/GateLine.ts';

/** 굽기 하나가 끝나기를 기다리는 한도. 한 프로세스가 여러 장을 구우므로 넉넉히 둔다. */
const BLENDER_TIMEOUT_MS = 20 * 60 * 1000;

/** 동시에 돌리는 굽기 수. 프로세스 하나가 1~2GB라 넷이 겹쳐도 여유가 있다(2026-09-17 실측). */
export const BAKE_CONCURRENCY = 4;

/**
 * Blender 실행 파일. 환경 변수 `BLENDER`가 있으면 그 경로를, 없으면 PATH의 `blender`를 쓴다.
 *
 * Git Bash 형식 경로(`/c/Program Files/...`)는 Node가 풀지 못하므로 윈도우 형식으로 준다.
 */
export function resolveBlender(): string {
  const fromEnv = process.env.BLENDER;
  if (!fromEnv) return 'blender';
  if (!fs.existsSync(fromEnv))
    throw new Error(`환경 변수 BLENDER가 가리키는 파일이 없다: ${fromEnv}`);
  return fromEnv;
}

/**
 * 굽기 스크립트 하나를 돌리고 `GATE_OK`의 값을 돌려준다. 판정 줄이 실패면 코드와 stderr 꼬리를 담아 던진다.
 *
 * `--disable-autoexec`를 늘 준다. `.vrm`과 함께 들어온 파일이 파이썬을 자동으로 돌리지 못하게 한다.
 *
 * @param script 굽기 스크립트의 절대 경로
 * @param args 스크립트가 받는 인자(`--` 뒤에 붙는다)
 * @param label 오류 메시지 앞에 붙일 이름 — 여러 굽기가 동시에 돌 때 어느 것이 죽었는지 가른다
 */
export function runBlender(
  script: string,
  args: readonly string[],
  label: string,
): Promise<Record<string, unknown>> {
  const argv = [
    '--background',
    '--disable-autoexec',
    '--python-exit-code',
    '1',
    '--python',
    script,
    '--',
    ...args,
  ];
  return new Promise((resolve, reject) => {
    const child = spawn(resolveBlender(), argv, { windowsHide: true });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf-8');
    child.stderr.setEncoding('utf-8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`${label}: Blender가 ${BLENDER_TIMEOUT_MS / 1000}초 안에 안 끝났다`));
    }, BLENDER_TIMEOUT_MS);
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', () => {
      clearTimeout(timer);
      const line = parseGateLine(stdout);
      if (line.ok) {
        resolve((line.payload ?? {}) as Record<string, unknown>);
        return;
      }
      const tail = stderr.split('\n').slice(-12).join('\n');
      reject(new Error(`${label}: ${line.code} ${line.message}\n${tail}`));
    });
  });
}

/**
 * 일 목록을 `concurrency`개씩 동시에 돌린다. 하나가 실패해도 나머지를 끝까지 돌린 뒤 실패를 전부 모아 던진다 —
 * 중간에 끊으면 어느 것까지 구워졌는지 알 수 없고, 하나만 던지면 나머지 실패가 출력 없이 버려진다. 실패가
 * 하나면 그 오류를 그대로 던진다.
 */
export async function runPool<T>(
  jobs: readonly (() => Promise<T>)[],
  concurrency: number = BAKE_CONCURRENCY,
): Promise<T[]> {
  const results: T[] = new Array(jobs.length);
  const failures: Error[] = [];
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const index = next++;
      try {
        results[index] = await jobs[index]();
      } catch (err) {
        failures.push(err as Error);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, worker));
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1) {
    const lines = failures.map((err, i) => `  ${i + 1}. ${err.message}`).join('\n');
    throw new Error(`굽기 ${failures.length}건이 실패했다:\n${lines}`);
  }
  return results;
}

/** JSON을 쓰고 경로를 돌려준다. 폴더가 없으면 만든다. */
export function writeJson(file: string, value: unknown): string {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 1)}\n`, 'utf-8');
  return file;
}
