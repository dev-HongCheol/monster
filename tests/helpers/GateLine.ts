/**
 * Blender가 찍은 기계 판독 줄을 stdout에서 골라 읽는 순수 파서.
 *
 * **`blender --background --python`은 스크립트가 예외를 던져도 종료 코드 0을 낸다.** 트레이스백은
 * Blender의 시작 로그에 섞여 흘러가므로, 종료 코드만 보면 실패한 실행과 성공한 실행이
 * 구별되지 않는다. 그러면 하류 판정이 낡거나 없는 PNG를 읽고 아무 값이나 보고한다.
 *
 * 그래서 파이썬 쪽은 `GATE_OK {json}` 또는 `GATE_FAIL <code> <message>` 한 줄을 찍고, 이
 * 파서가 그 줄을 찾는다. **「마지막 줄」로 읽지 않는다** — Blender는 스크립트가 끝난 뒤에도
 * 자기 종료 로그를 더 찍는다. 그리고 **그런 줄이 하나도 없으면 종료 코드와 무관하게 실패로
 * 접는다.** EEVEE가 컨텍스트를 못 잡아 Blender가 시그널로 죽으면 `--python-exit-code`도
 * `try/except`도 발화하지 않는데, 그 실행은 성공처럼 보이면서 산출물이 없다.
 */

/** 판정 줄이 하나도 없을 때 돌려주는 실패 코드. */
export const NO_GATE_LINE = 'no-gate-line';

/** 판정 줄을 읽을 수 없을 때 — `GATE_OK`의 JSON이 깨졌거나 `GATE_FAIL`에 실패 코드가 없을 때 — 돌려주는 실패 코드. */
export const BAD_GATE_PAYLOAD = 'bad-gate-payload';

/** 성공 줄 — 파이썬이 담아 보낸 값이 `payload`에 그대로 들어온다. */
export interface IGatePass {
  ok: true;
  payload: unknown;
}

/** 실패 줄. `code`로 무엇이 안 됐는지를 갈라 보고, `message`는 사람이 읽는다. */
export interface IGateFail {
  ok: false;
  code: string;
  message: string;
}

/** `parseGateLine`의 결과. */
export type GateLine = IGatePass | IGateFail;

/**
 * stdout에서 판정 줄을 골라 읽는다.
 *
 * 뒤에서부터 찾아 **마지막 판정 줄**을 쓴다. 판정 줄이 둘 이상 나오는 것은 스크립트가 단계를
 * 나눠 찍었을 때 정상이고, 그때 실행의 결말을 말하는 것은 마지막 줄이다.
 *
 * **줄 가운데 나온 `GATE_`는 고르지 않는다.** 파이썬 트레이스백이 판정 줄을 인용하는 경우가
 * 있어서, 그것을 판정으로 읽으면 실패한 실행이 성공으로 보고된다.
 *
 * @param stdout Blender 실행의 표준 출력 전문. CRLF로 와도 된다
 */
export function parseGateLine(stdout: string): GateLine {
  // 줄 끝을 셋 다 받는다. Blender를 Windows에서 돌리므로 CRLF로 오는데, `\r`을 줄 안에
  // 남기면 JSON 끝에 그것이 붙어 파싱이 깨지고 그 실패가 「판정 줄이 없다」와 구별되지 않는다.
  const lines = stdout.split(/\r\n|\r|\n/);

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();

    // 접두어를 경계까지 보고 자른다. `startsWith`만 쓰면 `GATE_OKAY` 같은 줄이 성공으로 읽힌다.
    const pass = /^GATE_OK(?:\s+(.*))?$/.exec(line);
    if (pass) {
      const payload = (pass[1] ?? '').trim();
      if (payload === '') {
        return { ok: false, code: BAD_GATE_PAYLOAD, message: 'GATE_OK 줄에 JSON이 없다' };
      }
      try {
        return { ok: true, payload: JSON.parse(payload) };
      } catch {
        // 깨진 JSON을 성공으로 읽지 않는다. 읽어 버리면 굽기는 끝났다는 보고만 남고 무엇이
        // 구워졌는지는 비어, 하류가 낡은 PNG를 재게 된다.
        return {
          ok: false,
          code: BAD_GATE_PAYLOAD,
          message: `GATE_OK의 JSON을 읽을 수 없다: ${payload}`,
        };
      }
    }

    const fail = /^GATE_FAIL(?:\s+(.*))?$/.exec(line);
    if (fail) {
      const rest = (fail[1] ?? '').trim();
      // 코드가 없는 실패 줄을 빈 코드로 돌려주면, 실행기가 README의 실패 코드 표에서 찾을 것이
      // 없어 사람이 무엇이 안 됐는지 알 길이 없다. 판정 줄 자체가 깨진 것으로 보고한다.
      if (rest === '') {
        return { ok: false, code: BAD_GATE_PAYLOAD, message: 'GATE_FAIL 줄에 실패 코드가 없다' };
      }
      const cut = rest.indexOf(' ');
      return {
        ok: false,
        code: cut < 0 ? rest : rest.slice(0, cut),
        message: cut < 0 ? '' : rest.slice(cut + 1).trim(),
      };
    }
  }

  return {
    ok: false,
    code: NO_GATE_LINE,
    message:
      'stdout에 GATE_OK·GATE_FAIL 줄이 없다 — 종료 코드와 무관하게 실패로 본다. ' +
      'Blender가 시그널로 죽으면 이 모양이 된다.',
  };
}
