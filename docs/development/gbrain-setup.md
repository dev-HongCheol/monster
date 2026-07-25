# gbrain 셋업 — 레포 의미 검색 (문서 + 코드)

이 레포의 문서와 코드를 의미 기반으로 검색하기 위한 gbrain 설치·색인·연결 절차다. grep이 못 하는 검색, 즉 **찾으려는 대상의 정확한 단어를 모를 때** 답을 찾는 것이 목적이다. 임베딩을 로컬에서 돌리므로 비용이 들지 않고 코드가 외부로 나가지 않는다.

- **작성일:** 2026-07-25
- **브랜치:** docs/gbrain-setup
- **성격:** 재사용 셋업 레퍼런스. 다른 장비에 같은 환경을 만들 때 이 문서를 그대로 따라간다.
- **선행 판단 기록:** 도입 여부를 정할 때 쓴 실사 근거는 아래 §7에 있다. 대안으로 검토했던 손수 관리하는 AI 인덱스(`.ai/*.json`)를 폐기한 이유도 거기 있다.
- **관련 문서:** 설치 스킬은 gstack에 동봉돼 있다(`~/.claude/skills/gstack/setup-gbrain`). 이 문서는 그 스킬이 윈도우에서 막히는 지점을 우회한 실제 절차를 남긴다.

---

## 1. 무엇이 설치되는가

세 덩어리이고 서로 역할이 다르다.

| 구성 요소 | 역할 | 위치 | 크기 |
|---|---|---|---|
| gbrain CLI | 색인·검색 엔진, MCP 서버 | `~/gbrain` | 391 MB |
| Ollama + 임베딩 모델 | 텍스트를 벡터로 바꾸는 로컬 모델 | Ollama 기본 경로 | 1.2 GB |
| 브레인 (PGLite) | 벡터와 페이지가 저장되는 로컬 DB | `~/.gbrain` | 128 MB |

합계 약 1.7 GB이고 전부 로컬이다. 외부 서비스 계정도 API 키도 필요 없다.

## 2. 이 장비 실측 (2026-07-25)

| 항목 | 값 |
|---|---|
| OS | Windows 11 Pro 26200 |
| GPU | NVIDIA GeForce RTX 3070 Ti (VRAM 8 GB) |
| 셸 | Git Bash (MSYS) + PowerShell |
| bun | 1.3.14 (**npm으로 설치됨** — §5.1의 원인) |
| git | 2.50.1.windows.1 |
| node | 22.17.0 |
| gbrain | 0.42.66.0 |
| Ollama | 0.32.3 |

## 3. 왜 이 구성인가

### 3.1 임베딩은 로컬로 — 비용과 유출을 동시에 없앤다

gbrain은 임베딩 제공자를 16종 지원하고 그중 셋이 로컬이다(Ollama, llama.cpp, LiteLLM 프록시). 유료 제공자는 100만 토큰당 0.02~0.18달러이고, 무엇보다 **색인할 때마다 레포 코드가 그 제공자로 전송된다.** 이 프로젝트는 상업 배포를 염두에 두고 있어 그 전송을 기본값으로 삼을 이유가 없다.

로컬을 골라도 잃는 것이 크지 않다는 게 실측으로 확인됐다(§7). 나중에 검색 품질이 부족하다고 판단되면 유료 모델로 갈아탈 수 있다 — 단 그때 전체 재색인이 필요하다(§3.3).

### 3.2 모델은 `snowflake-arctic-embed2` — 한국어 때문이다

Ollama 레시피의 기본값은 `nomic-embed-text`(768차원)인데 영어 중심이다. 이 레포의 문서에는 **한글이 36만 자** 들어 있어 영어 전용 임베더를 쓰면 검색 품질이 떨어진다.

`snowflake-arctic-embed2`는 다국어를 겨냥한 모델이고 1024차원이며 1.2 GB로 가볍다. 더 큰 `qwen3-embed-8b`(4096차원)도 후보였으나, 이 모델로도 충분히 정확했고(§7) 8B는 맥북 같은 저사양 장비에서 색인이 무거워진다.

### 3.3 브레인은 PGLite 로컬 — 다만 모델을 나중에 바꾸기 어렵다

PGLite는 로컬 파일 하나로 끝나 계정도 네트워크도 필요 없다. 대신 브레인은 **한 장비에 하나**이므로 여러 장비가 같은 색인을 공유하려면 Supabase나 원격 MCP로 가야 한다(이 문서 범위 밖).

주의할 제약이 하나 있다. **임베딩 모델은 브레인당 고정이다.** `gbrain config set embedding_model`은 거부되는데, 차원이 바뀌면 DB 컬럼 폭이 달라지기 때문이다. 바꾸려면 `gbrain reinit-pglite` 또는 `gbrain retrieval-upgrade --to <모델> --reindex`로 **전체를 다시 색인**해야 한다. 그래서 처음 고르는 모델이 사실상 굳는다.

---

## 4. 다른 장비에서 재현하는 절차

아래 명령은 Git Bash 기준이다. `<레포>`는 이 프로젝트를 클론한 절대 경로로 바꿔 읽는다(예: `F:/work/monster`).

### 4.0 전제 조건 확인

```bash
bun --version    # 없으면 설치 필요
git --version
node --version
```

`bun`이 없으면 공식 설치를 권한다(`irm bun.sh/install.ps1|iex`). npm으로 깔아도 동작하지만 §5.1의 함정을 만난다.

### 4.1 gbrain CLI 설치

```bash
~/.claude/skills/gstack/bin/gstack-gbrain-install
```

이 스크립트가 `github.com/garrytan/gbrain`를 `~/gbrain`에 클론하고 `bun install` + `bun link`까지 한다. 윈도우에서는 gbrain의 postinstall 스크립트가 실패하는 것을 알고 `--ignore-scripts`로 우회하는 분기가 들어 있다.

마지막에 `cannot read version from package.json (install may be broken)` 경고가 뜰 수 있는데 **무시해도 된다.** `package.json`에 버전이 멀쩡히 있고 설치 스크립트의 파싱만 어긋난 것이다. 아래로 확인한다.

```bash
bun ~/gbrain/src/cli.ts --version     # gbrain 0.42.66.0
```

### 4.2 Ollama 설치

```powershell
winget install --id Ollama.Ollama --accept-package-agreements --accept-source-agreements --silent
```

설치하면 Ollama가 백그라운드 서비스로 뜨고 `http://localhost:11434`에서 응답한다.

### 4.3 임베딩 모델 받기 + 별칭 만들기

```bash
ollama pull snowflake-arctic-embed2
ollama cp snowflake-arctic-embed2 snowflake-arctic-embed-l-v2
```

두 번째 줄이 반드시 필요하다. gbrain 레시피의 허용 모델 목록에는 `snowflake-arctic-embed-l-v2`로 적혀 있는데 Ollama 라이브러리의 실제 태그는 `snowflake-arctic-embed2`라, 별칭을 만들지 않으면 색인할 때 Ollama가 "그런 모델 없다"고 답한다(§5.3).

차원이 실제로 1024인지, 한국어가 들어가는지 여기서 한 번 확인해 두면 뒤에서 헤매지 않는다.

```powershell
$body = @{ model = "snowflake-arctic-embed-l-v2"; input = "테스트 문장" } | ConvertTo-Json
$r = Invoke-RestMethod -Uri "http://localhost:11434/api/embed" -Method Post -Body $body -ContentType "application/json"
$r.embeddings[0].Count      # 1024가 나와야 한다
```

### 4.4 브레인 초기화

```bash
cd ~/gbrain
bun src/cli.ts init --pglite \
  --embedding-model ollama:snowflake-arctic-embed-l-v2 \
  --embedding-dimensions 1024
```

`--embedding-dimensions`를 반드시 넘긴다. 레시피의 기본 차원은 `nomic-embed-text` 기준 768이라, 생략하면 1024짜리 모델이 768로 잡혀 어긋난다.

초기화가 끝나면 gbrain이 선택 가능한 스킬팩 목록을 보여주며 설치할지 묻는다. **이 용도에는 필요 없으므로 건너뛴다.**

결과 확인:

```bash
cat ~/.gbrain/config.json
```

```json
{
  "engine": "pglite",
  "embedding_model": "ollama:snowflake-arctic-embed-l-v2",
  "embedding_dimensions": 1024
}
```

### 4.5 레포를 소스로 등록

```bash
cd ~/gbrain
bun src/cli.ts sources add monster --path "<레포>" --name "monster repo" --federated
```

**반드시 레포 루트를 지정한다.** `<레포>/docs`처럼 하위 디렉터리를 주면 윈도우에서 경로 포함 판정이 어긋나 색인이 거부된다(§5.2). `--federated`는 이 소스가 기본 검색 대상에 포함된다는 뜻이다.

### 4.6 색인 — 문서와 코드를 따로 돌린다

```bash
cd ~/gbrain
bun src/cli.ts sync --source monster                          # 마크다운
bun src/cli.ts sync --source monster --strategy code --full   # 코드
```

두 번째 줄의 `--full`이 없으면 **아무 일도 일어나지 않는다.** 첫 동기화가 커밋 체크포인트를 남기므로, 코드 동기화가 "변경 없음"으로 판정하고 조용히 끝난다(§5.4).

이 레포 기준 소요 시간은 문서 1분 23초(179 페이지·1,951 청크), 코드 40초(126 페이지·904 청크)다.

### 4.7 Claude Code에 MCP로 연결

```bash
claude mcp add gbrain --scope local -- bun <홈>/gbrain/src/cli.ts serve
claude mcp list        # gbrain: ... - ✔ Connected
```

`bun`으로 스크립트를 직접 실행하도록 등록하는 이유는 §5.1에 있다. `--scope local`은 이 프로젝트에서만 쓰겠다는 뜻이라 레포에 커밋되지 않고 다른 프로젝트에도 영향이 없다.

**등록 후 Claude Code를 재시작해야 한다.** MCP 서버는 세션이 시작될 때 로드되므로, 재시작 전에는 등록만 되고 도구로는 잡히지 않는다.

---

## 5. 알려진 함정 (전부 2026-07-25에 겪음)

### 5.1 `gbrain` 명령이 실행되지 않는다

`bun link`가 만든 `~/.bun/bin/gbrain.exe`를 실행하면 `bun is not installed in %PATH%`가 뜬다. bun을 **npm으로 설치한 장비**에서 생기는 문제다 — 그 경우 bun 본체가 `AppData/Roaming/npm`에 있는데, 심은 공식 설치 위치인 `~/.bun/bin/bun.exe`를 찾기 때문이다.

우회는 두 가지다. bun을 공식 설치 스크립트로 다시 깔거나, 이 문서처럼 **`bun <경로>/src/cli.ts` 형태로 직접 호출**한다. 후자를 택하면 MCP 등록도 같은 형태로 해야 한다(§4.7).

### 5.2 하위 디렉터리를 소스로 잡으면 색인이 거부된다

`<레포>/docs`를 소스 경로로 주면 이렇게 거부한다.

```
Sync scope F:\work\monster\docs resolves outside git repo F:\work\monster.
Refusing to sync: possible path traversal via --src-subpath.
```

`docs`는 명백히 레포 안인데 밖으로 판정한다. 경로 구분자가 섞이면서(`F:/...`로 입력, 내부는 `F:\...`) 포함 관계 비교가 깨지는 것으로 보인다. 경로 조작 방어 로직이 윈도우에서 오탐하는 것이므로 **레포 루트를 지정해 검사를 아예 타지 않게** 우회한다.

이미 하위 경로로 소스를 만들었다면 겹침 때문에 루트 소스를 추가할 수 없다(`overlapping sources are not allowed`). 먼저 지운다.

```bash
bun src/cli.ts sources remove <id> --dry-run   # 영향 확인
bun src/cli.ts sources remove <id> --yes
```

### 5.3 모델 이름이 gbrain과 Ollama에서 다르다

gbrain 레시피는 `snowflake-arctic-embed-l-v2`, Ollama 라이브러리 태그는 `snowflake-arctic-embed2`다. 별칭을 만들지 않고 초기화하면 색인 단계에서 모델을 못 찾는다. §4.3의 `ollama cp`가 이 간극을 메운다.

### 5.4 `--strategy code`가 조용히 아무것도 안 한다

마크다운 동기화가 커밋 체크포인트를 남긴 뒤에 코드 동기화를 돌리면, 증분 판정이 "git 변경 없음"으로 끝나 코드가 한 줄도 색인되지 않는다. 종료 코드가 0이고 오류도 없어서 성공한 것처럼 보인다. **`--full`을 함께 주어야** 한다.

색인이 실제로 됐는지는 페이지 수로 확인한다.

```bash
bun src/cli.ts sources status     # PAGES 열이 문서 + 코드 합계여야 한다
```

### 5.5 `extract`는 이 레포에서 거의 아무것도 만들지 못한다

`gbrain doctor`가 "un-extracted edges"를 경고하며 `gbrain extract --stale`을 권하는데, 실제로 돌리면 179개 문서에서 링크 **5개**가 나온다(파일시스템 소스 기준. 엔진 페이지 소스로는 0개다).

원인은 링크 문법이다. 추출기는 위키링크(`[[경로]]`)와 슬러그로 해석되는 마크다운 링크를 보는데, 이 레포는 `[표시](../qa/foo.md)` 같은 상대 경로 링크가 주류라 브레인 페이지 슬러그로 해석되지 않는다. **이건 고칠 문제가 아니다** — 지금 링크 형식은 GitHub에서 제대로 렌더되라고 쓰는 것이고, 검색 지표 하나 때문에 문서 178개의 링크를 바꾸는 것은 본말전도다.

그 결과 `gbrain doctor`의 brain score가 45/100으로 낮게 나오는데, 내역을 보면 임베딩은 35/35 만점이고 **깎이는 항목이 전부 그래프 지표**(링크 0/25·타임라인 0/15·고아 0/15)다. 실제 검색을 떠받치는 부분은 만점이므로 낮은 점수를 문제로 읽지 않는다.

### 5.6 증분 동기화가 모든 파일을 `SYMLINK_NOT_ALLOWED`로 거부한다

첫 색인 뒤 갱신하려고 `sync`를 그냥 돌리면 바뀐 파일 전부가 이렇게 막힌다.

```
Sync blocked: 6 file(s) failed to parse:
  SYMLINK_NOT_ALLOWED: 6
```

심볼릭 링크가 아닌 일반 파일인데도 그렇다. 원인은 `src/commands/sync.ts`의 `isPathSafe`가 경로 구분자를 슬래시로 하드코딩한 것이다.

```js
return real === rootReal || real.startsWith(rootReal + '/');
```

윈도우에서 `realpathSync`는 역슬래시 경로를 돌려주므로, `F:\work\monster\CLAUDE.md`가 `F:\work\monster/`로 시작하는지를 묻게 되어 **항상 거짓**이 된다. 심볼릭 링크로 레포 밖을 가리키는 것을 막으려는 검사인데 윈도우에서는 정상 파일까지 전부 걸러 낸다. §5.2와 같은 계열(POSIX 경로 가정)이다.

**우회는 `--full`이다.** 전체 동기화는 이 per-file 검사를 타지 않는다. `--skip-failed`는 쓰지 않는다 — 거부된 파일을 색인하지 않고 넘어가는 것이라, 갱신하려던 바로 그 문서가 빠진다.

증상이 조용하다는 점도 알아 둘 것. 종료 코드는 0이고, 체크포인트가 안 올라간 채 "banked 0 file(s)"만 남는다.

### 5.7 지운 파일의 페이지가 색인에 남는다

동기화는 디스크에 있는 파일을 넣을 뿐 **사라진 파일의 페이지를 지우지 않는다.** `--full`로 전체를 다시 돌려도 남는다.

이게 위험한 이유는 낡은 페이지가 조용히 있는 게 아니라 **최상위로 나오기** 때문이다. 실제로 폐기하고 삭제한 초안이 삭제 후에도 0.88로 1위에 나왔다(2026-07-25). 그 문서는 우리가 기각한 안을 별 다섯 개로 추천하고 있었다.

파일을 지웠으면 페이지도 함께 지운다.

```bash
bun src/cli.ts delete <슬러그>
```

슬러그는 검색 결과에 그대로 찍힌다(`docs/temp/claude_code_knowledge_strategy` 형태). 소프트 삭제라 72시간 안에는 복구할 수 있다.

---

## 6. 운영

### 6.1 검색하는 법

MCP로 연결했다면 Claude Code가 도구로 직접 호출한다. 셸에서 직접 쓸 때는 이렇게 한다.

```bash
cd ~/gbrain
bun src/cli.ts search "찾고 싶은 것을 문장으로"     # 의미 검색 (문서 + 코드)
bun src/cli.ts code-def <심볼명>                    # 심볼이 정의된 위치
bun src/cli.ts code-refs <심볼명>                   # 그 심볼을 쓰는 곳
```

`search`는 점수와 함께 문서 슬러그·발췌를, `code-def`/`code-refs`는 파일 경로와 줄 범위를 JSON으로 돌려준다.

### 6.2 색인을 언제 갱신하는가

색인은 특정 커밋 기준으로 굳는다(이 문서 작성 시점은 `2c117af6`). **낡은 색인은 없는 것보다 나쁘다** — 이미 고친 코드를 근거로 답하고, 그것도 "모른다"가 아니라 가장 비슷한 것을 그럴듯한 점수로 돌려준다. 실제로 삭제한 문서가 0.88로 최상위에 나온 적이 있다(2026-07-25).

**갱신 시점은 슬라이스 머지 직후다.** 이력이 늘어나는 유일한 시점이고, 머지된 것만 들어가므로 폐기될 초안이 색인을 오염시키지 않는다. 그래서 `CLAUDE.md` 워크플로 9단계(`pr-done` 다음)에 갱신이 들어가 있다.

슬라이스 **진행 중**에도 당길 수 있다 — 세션이 끊기거나 다른 장비로 넘어가 그 슬라이스의 문서가 컨텍스트에서 사라졌을 때다. 반대로 파일을 저장할 때마다 돌리거나 상시 데몬을 띄우는 것은 권하지 않는다. 슬라이스 중 문서는 계속 갈아엎히므로 확정되지 않은 초안이 색인에 들어간다.

**윈도우에서는 두 줄 모두 `--full`이 필요하다.** 증분 동기화가 경로 검사 버그로 모든 파일을 거부하기 때문이다(§5.6). `--full`이라도 내용이 안 바뀐 파일은 해시로 걸러지므로 실제 비용은 증분과 비슷하다 — 179개 문서 중 6개가 바뀐 경우 11초였다.

```bash
cd ~/gbrain
bun src/cli.ts sync --source monster --full
bun src/cli.ts sync --source monster --strategy code --full
```

**파일을 지웠다면 한 줄이 더 필요하다.** 동기화는 디스크에 있는 것을 넣을 뿐, 사라진 파일의 페이지를 지우지 않는다(§5.7).

```bash
bun src/cli.ts delete <슬러그>     # 예: docs/temp/claude_code_knowledge_strategy
```

gstack의 `/sync-gbrain` 스킬이 이 갱신을 감싸고 `CLAUDE.md`에 검색 라우팅 안내 블록을 넣어 주는데, 이 레포에는 아직 적용하지 않았다(§8).

---

## 7. 도입 판단 근거 (실측, 2026-07-25)

### 7.1 검색 품질 — grep이 못 하는 것을 한다

세 질의 모두 정답 문서를 최상위로 집었다.

| 질의 | 최상위 결과 | 점수 |
|---|---|---|
| 발사체가 일시정지 중에 계속 날아가는 문제 | `sessions/2026-07-01-projectile-pause-guard-plan` | 0.90 |
| 캐릭터 그림을 키웠더니 다리가 벽에 파묻힌다 | `qa/player-4dir-test` 「발치 오프셋」 | 0.85 |
| 적을 많이 늘리면 왜 프레임이 떨어지나 | `sessions/2026-06-17-spatial-grid-plan` | 0.84 |

두 번째가 판단의 근거였다. 같은 질문을 grep으로 던지면 `grep "파묻"`은 **무관한 인페르노 마법 문서 2건**을 돌려주고 `grep "다리가 벽"`은 0건이다. 정답에 도달하려면 "발치 오프셋"이라는 단어를 이미 알고 있어야 하는데, 모르는 것을 찾을 때 그 단어를 알 방법이 없다. 의미 검색이 메우는 자리가 정확히 여기다.

코드도 같다. "resolveMoveAtFootprint 순수 함수 구현"에 `FootprintLogic.ts:75-98`과 그 소비처인 `PlayerController.ts:175-206`을 줄 범위까지 짚어 돌려줬다.

한편 "충돌 판정 원을 발밑으로 내리는 계산" 같은 **개념 질문에는 코드보다 문서가 먼저 온다**(ADR 006이 상위). 이것은 결함이 아니라 옳은 동작이다 — 왜 그렇게 했는지는 설계 문서가, 어디에 구현됐는지는 심볼 조회가 답하는 편이 정확하다.

### 7.2 비용과 시간

| 항목 | 실측 |
|---|---|
| 색인 대상 | 72.9만 토큰 (문서 1.81 MB + 코드 681 KB) |
| 색인 시간 | 문서 1분 23초 + 코드 40초 |
| 비용 | **0원** (유료 임베더였다면 약 0.09달러) |
| 외부 전송 | **없음** |

### 7.3 손수 관리하는 인덱스를 만들지 않은 이유

원래 검토안에는 `.ai/context-index.json` 같은 파일을 만들어 문서 관계를 손으로 적어 두는 방식이 있었다. 폐기했다. 그것은 문서에서 파생된 사본이고, 이 레포는 **같은 설명이 세 곳에 복사돼 한 곳만 고치는 사고를 두 번** 겪었다(백로그 `F51`). 파생 사본은 드리프트를 막을 게이트가 없으면 반드시 낡는다.

gbrain은 같은 역할을 **자동 갱신으로** 수행한다. 색인이 코드·문서에서 직접 생성되므로 손으로 맞출 것이 없고, 낡으면 §6.2의 명령 한 줄로 다시 만든다.

---

## 8. 아직 하지 않은 것

판단이 필요하거나 실익이 낮아 보류한 항목이다.

- **`gbrain dream`(호출 그래프 구축)** — 최대 45분짜리 긴 작업이다. 돌리지 않은 상태에서도 `code-def`·`code-refs`가 동작하는 것을 확인했으므로 필요해질 때 돌린다.
- **`/sync-gbrain` 상시 운용** — 색인 갱신을 자동화하고 gstack이 관리하는 라우팅 블록을 넣어 주는 스킬이다. 아직 붙이지 않았다. 지금은 갱신을 §6.2의 명령으로 손수 돌리고, 라우팅은 `CLAUDE.md`에 직접 적은 한 문단이 대신한다(2026-07-25 추가 — 단어를 아는 검색은 Grep, 모르는 검색은 의미 검색). 스킬을 붙이면 그 문단과 스킬이 넣는 블록이 겹치므로, 도입할 때 한쪽으로 합친다.
- **여러 장비가 같은 브레인 공유** — 지금은 장비마다 로컬 브레인이다. 공유하려면 Supabase나 원격 MCP로 가야 하고, 그 경우 색인은 GPU가 있는 장비에서 한 번만 돌리고 다른 장비는 질의만 하면 된다(질의는 토큰 수십 개라 저사양 장비에서도 가볍다).
- **더 큰 임베딩 모델로 상향** — `qwen3-embed-8b`(4096차원)가 후보다. 검색 품질이 부족하다고 느껴질 때 `retrieval-upgrade --reindex`로 올린다. 색인이 2분이면 끝나므로 재색인 부담은 작다.
