/**
 * 마크다운 링크·앵커 검사의 명세와 레포 전체 회귀망.
 *
 * 이 파일은 슬라이스에 묶이지 않는다. `canon-spec-move`가 도구를 세웠지만, 앞으로 문서를
 * 옮기거나 제목을 고칠 때마다 깨진 참조를 잡는 것이 이 그물의 일이다. 슬라이스 이름이 붙은
 * `CanonSpecMove.test.ts`에는 이번 이동이 끝났는지만 두고 여기와 섞지 않는다.
 *
 * `pnpm wf check-links`도 같은 함수를 부른다 — CLI에 판정을 복사하지 않고 vitest를 띄우는
 * 방식이라, 게이트와 테스트가 갈라질 여지가 없다.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  collectAnchors,
  extractLinks,
  findBrokenLinks,
  resolveTarget,
  slugifyHeading,
} from '../helpers/LinkCheck';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');

describe('extractLinks — 무엇을 링크로 세는가', () => {
  it('평범한 상대 링크를 센다', () => {
    expect(extractLinks('본문 [규약](../spec/code-conventions.md) 참고.')).toEqual([
      { line: 1, target: '../spec/code-conventions.md' },
    ]);
  });

  it('줄 번호를 1부터 보고한다', () => {
    const md = ['첫 줄', '', '셋째 줄에 [링크](a.md)가 있다.'].join('\n');
    expect(extractLinks(md)[0].line).toBe(3);
  });

  it('인라인 코드 스팬 안의 링크는 세지 않는다', () => {
    // `gbrain-setup.md:218`이 링크 문법을 설명하려고 본문에 적어 둔 형태다. 예외 목록을
    // 만들지 않고 추출기가 스팬을 벗겨서 해결한다 — 예외 목록은 한 번 생기면 계속 자란다.
    const md = '이 레포는 `[표시](../qa/foo.md)` 같은 상대 경로 링크가 주류다.';
    expect(extractLinks(md)).toEqual([]);
  });

  it('코드 펜스 안의 링크는 세지 않는다', () => {
    const md = ['```md', '[예시](없는파일.md)', '```', '', '[진짜](real.md)'].join('\n');
    expect(extractLinks(md)).toEqual([{ line: 5, target: 'real.md' }]);
  });

  it('이미지 링크도 대상에 넣는다', () => {
    // `!`가 붙어도 가리키는 파일이 없으면 렌더가 깨지는 것은 같다.
    expect(extractLinks('![상태 머신](./assets/workflow.svg)')).toEqual([
      { line: 1, target: './assets/workflow.svg' },
    ]);
  });

  it('타입·정규식 표기를 링크로 오탐하지 않는다', () => {
    // 레포에 `[number, number][]`·`[A-Z][0-9]` 꼴이 열 군데쯤 있다. 참조 스타일 링크
    // (`[표시][라벨]`)를 지원할 필요는 없고, 조용하기만 하면 된다.
    const md = '좌표는 `[number, number][]`이고 패턴은 [A-Z][0-9]다.';
    expect(extractLinks(md)).toEqual([]);
  });

  it('외부 링크도 일단 뽑는다 — 거르는 것은 resolveTarget의 일이다', () => {
    expect(extractLinks('[gstack](https://github.com/x/y)')).toEqual([
      { line: 1, target: 'https://github.com/x/y' },
    ]);
  });
});

describe('slugifyHeading — GitHub 앵커 규칙', () => {
  it('공백을 하이픈으로 바꾸고 ASCII는 소문자로 내린다', () => {
    expect(slugifyHeading('Enemy System')).toBe('enemy-system');
  });

  it('구두점을 지우되 그 자리의 공백을 합치지 않는다', () => {
    // `## 8. 전투 · 마법 시스템`이 실제로 `#8-전투--마법-시스템`으로 링크된다. 공백을 접는
    // 순진한 슬러그화는 이 **멀쩡한 링크를 깨진 것으로** 신고한다.
    expect(slugifyHeading('8. 전투 · 마법 시스템')).toBe('8-전투--마법-시스템');
  });

  it('괄호를 지운다', () => {
    expect(slugifyHeading('9. 적 시스템 (Enemy System)')).toBe('9-적-시스템-enemy-system');
  });

  it('제목 안의 굵게·코드 표기를 벗긴 뒤 슬러그화한다', () => {
    expect(slugifyHeading('**주석** 기준과 `t()` 호출')).toBe('주석-기준과-t-호출');
  });

  it('한글을 그대로 남긴다', () => {
    expect(slugifyHeading('폴더 구조')).toBe('폴더-구조');
  });
});

describe('collectAnchors — 문서가 제공하는 앵커', () => {
  it('제목을 순서대로 슬러그화한다', () => {
    const md = ['# 제목', '', '## 폴더 구조', '', '### 주석 기준'].join('\n');
    expect(collectAnchors(md)).toEqual(['제목', '폴더-구조', '주석-기준']);
  });

  it('같은 제목이 두 번이면 뒤에 -1을 붙인다', () => {
    // `environment-setup.md`의 `## 설치 확인` 중복이 실물이다. 접미사를 안 붙이면
    // `#설치-확인-1`을 가리키는 멀쩡한 링크가 깨진 것으로 잡힌다.
    const md = ['## 설치 확인', '## 설치 확인', '## 설치 확인'].join('\n');
    expect(collectAnchors(md)).toEqual(['설치-확인', '설치-확인-1', '설치-확인-2']);
  });

  it('코드 펜스 안의 # 줄은 제목이 아니다', () => {
    const md = ['## 진짜 제목', '', '```bash', '# 셸 주석이지 제목이 아니다', '```'].join('\n');
    expect(collectAnchors(md)).toEqual(['진짜-제목']);
  });

  it('CRLF 문서에서도 제목을 찾는다', () => {
    // 이 레포는 줄 끝을 섞어 쓴다 — `art-generation-playbook.md`는 CRLF이고 `conventions.md`는
    // LF다. 줄 끝의 `\r`를 그대로 두면 제목 정규식이 하나도 안 맞아 그 문서의 앵커가 **전부**
    // 없는 것이 되고, 멀쩡한 링크 열한 개가 깨진 것으로 신고된다(실제로 그렇게 났다).
    expect(collectAnchors('## 폴더 구조\r\n\r\n본문\r\n')).toEqual(['폴더-구조']);
  });
});

describe('resolveTarget — 링크를 레포 상대 경로로 푼다', () => {
  it('문서 위치를 기준으로 상대 경로를 푼다', () => {
    expect(resolveTarget('docs/development/spec/code-i18n.md', '../backlog.md')).toEqual({
      path: 'docs/development/backlog.md',
      anchor: '',
    });
  });

  it('세션 문서에서 ../decisions/는 레포 루트가 아니라 development 아래로 풀린다', () => {
    // 지금 깨져 있는 링크 여섯이 전부 이 실수다. 한 단계를 더 올라가야 `docs/decisions/`다.
    expect(
      resolveTarget(
        'docs/development/sessions/2026-05-16-cocos-setup-plan.md',
        '../decisions/001.md',
      ),
    ).toEqual({ path: 'docs/development/decisions/001.md', anchor: '' });
  });

  it('결과 구분자는 항상 슬래시다', () => {
    // Windows에서 `path.relative`가 역슬래시를 뱉으면 그 경로는 git 추적 목록과 영영
    // 일치하지 않아, 멀쩡한 링크가 전부 깨진 것으로 잡힌다.
    const r = resolveTarget('docs/development/spec/ops-build.md', '../../planning/roadmap.md');
    expect(r?.path).toBe('docs/planning/roadmap.md');
    expect(r?.path).not.toContain('\\');
  });

  it('앵커를 경로에서 떼어 낸다', () => {
    expect(resolveTarget('docs/a.md', 'b.md#폴더-구조')).toEqual({
      path: 'docs/b.md',
      anchor: '폴더-구조',
    });
  });

  it('앵커 전용 링크는 자기 파일을 가리킨다', () => {
    expect(resolveTarget('docs/a.md', '#주석-기준')).toEqual({
      path: 'docs/a.md',
      anchor: '주석-기준',
    });
  });

  it('외부 주소는 검사 대상이 아니다', () => {
    expect(resolveTarget('docs/a.md', 'https://example.com')).toBeNull();
    expect(resolveTarget('docs/a.md', 'http://example.com')).toBeNull();
    expect(resolveTarget('docs/a.md', 'mailto:x@y.z')).toBeNull();
  });
});

describe('findBrokenLinks — 판정', () => {
  const tracked = new Set(['docs/a.md', 'docs/spec/code-conventions.md']);

  it('가리키는 파일이 추적 목록에 없으면 잡는다', () => {
    const docs = [{ path: 'docs/a.md', content: '[없다](없는파일.md)' }];
    expect(findBrokenLinks(docs, tracked)).toEqual([
      { file: 'docs/a.md', line: 1, target: '없는파일.md', reason: 'missing-file' },
    ]);
  });

  it('대소문자가 다르면 깨진 것으로 잡는다', () => {
    // 존재 판정이 정확한 문자열 비교라서 얻는 성질이다. `fs.existsSync`로 하면 대소문자를
    // 무시하는 Windows에서 이 오타가 통과하고 GitHub에서만 깨진다.
    const docs = [{ path: 'docs/a.md', content: '[규약](spec/Code-Conventions.md)' }];
    expect(findBrokenLinks(docs, tracked)).toHaveLength(1);
  });

  it('파일은 있는데 앵커가 없으면 missing-anchor다', () => {
    const docs = [
      { path: 'docs/a.md', content: '[규약](spec/code-conventions.md#없는절)' },
      { path: 'docs/spec/code-conventions.md', content: '## 폴더 구조' },
    ];
    expect(findBrokenLinks(docs, tracked)).toEqual([
      {
        file: 'docs/a.md',
        line: 1,
        target: 'spec/code-conventions.md#없는절',
        reason: 'missing-anchor',
      },
    ]);
  });

  it('앵커가 있으면 통과한다', () => {
    const docs = [
      { path: 'docs/a.md', content: '[규약](spec/code-conventions.md#폴더-구조)' },
      { path: 'docs/spec/code-conventions.md', content: '## 폴더 구조' },
    ];
    expect(findBrokenLinks(docs, tracked)).toEqual([]);
  });

  it('디렉터리를 가리키는 링크는 깨진 것이 아니다', () => {
    // GitHub는 폴더 링크를 그 폴더의 목록 페이지로 연다. 추적 목록에는 파일만 있으므로
    // 폴더 이름 자체는 없는데, 그걸 깨졌다고 하면 `docs/planning/` 같은 멀쩡한 안내가
    // 전부 빨간불이 된다. 그 아래에 추적되는 파일이 하나라도 있으면 통과시킨다.
    const docs = [{ path: 'docs/a.md', content: '[정본 폴더](spec/)' }];
    expect(findBrokenLinks(docs, tracked)).toEqual([]);
  });

  it('아무 파일도 없는 폴더 경로는 깨진 것으로 잡는다', () => {
    const docs = [{ path: 'docs/a.md', content: '[없는 폴더](없는곳/)' }];
    expect(findBrokenLinks(docs, tracked)).toHaveLength(1);
  });

  it('본문을 읽지 않은 파일의 앵커는 판정하지 않는다', () => {
    // 검사 대상은 `.md`뿐이라 `.html` 목업 같은 대상은 본문을 모른다. 앵커를 확인할 수 없다는
    // 이유로 깨졌다고 하면 멀쩡한 목업 링크가 전부 빨간불이 된다.
    const docs = [{ path: 'docs/a.md', content: '[규약](spec/code-conventions.md#어떤절)' }];
    expect(findBrokenLinks(docs, tracked)).toEqual([]);
  });
});

describe('레포 전체 회귀망', () => {
  /** 추적되는 마크다운 문서를 전부 읽는다. 검사 범위를 좁히면 그만큼 사각지대가 된다. */
  function loadDocs(): { docs: { path: string; content: string }[]; tracked: Set<string> } {
    const r = spawnSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`git ls-files 실패: ${r.stderr}`);
    const tracked = new Set(r.stdout.split('\n').filter(Boolean));
    const docs = [...tracked]
      .filter((p) => p.endsWith('.md'))
      .map((p) => ({ path: p, content: fs.readFileSync(path.join(ROOT, p), 'utf8') }));
    return { docs, tracked };
  }

  it('깨진 링크가 하나도 없다', () => {
    const { docs, tracked } = loadDocs();
    const broken = findBrokenLinks(docs, tracked);
    // 배열이 아니라 **줄바꿈으로 이은 한 문자열**로 비교한다. 배열로 비교하면 vitest가
    // `…(21)`로 줄여 버려서 정작 어디가 깨졌는지 안 보인다 — 고칠 수 없는 실패 메시지다.
    const report = broken.map((b) => `${b.file}:${b.line} → ${b.target} (${b.reason})`).join('\n');
    expect(report).toBe('');
  });

  it('정본은 결정 기록으로 나가는 링크를 걸지 않는다', () => {
    // 두 `spec/README.md`가 선언만 하고 지키는 기계가 없던 규칙이다. 링크를 타고 들어간
    // 사람이 폐기된 명세를 현재 명세로 읽은 사고가 2026-08-08에 실제로 났다.
    const { docs } = loadDocs();
    const offenders: string[] = [];
    for (const doc of docs) {
      if (!/^docs\/(development|design)\/spec\//.test(doc.path)) continue;
      for (const link of extractLinks(doc.content)) {
        if (/(?:^|\/)(?:sessions|decisions)\//.test(link.target)) {
          offenders.push(`${doc.path}:${link.line} → ${link.target}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
