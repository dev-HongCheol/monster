# Cocos 에셋과 `.meta`

> Cocos 에셋의 `.meta`는 누가 만들고, 왜 커밋해야 하나

- **최초 작성:** 2026-11-16
- **상태:** CONFIRMED
- **이력:** 2026-11-16 — 신설

---

이 문서는 **정본**이다. 내용이 낡으면 새로 만들지 않고 이 문서를 고친다. 이력 절에는
날짜와 무엇이 바뀌었는지만 한 줄 남기고, 그렇게 정한 경위는 그 슬라이스의 세션 문서가 든다.

## 1. `.meta`는 Cocos 에디터만 만든다

`.meta`는 Cocos 에디터만 만들고, AI는 직접 만들지 않는다. 새 파일의 `.meta`가 언제 생기고 언제 커밋되는지는 그 순간의 행동으로 [`../workflow/implementation.md`](../workflow/implementation.md)와 [`../workflow/user-verification.md`](../workflow/user-verification.md)에 적혀 있다. 아트 파일의 경로 · 파일명 · 원본 자리는 [`../../design/spec/art-asset-spec.md`](../../design/spec/art-asset-spec.md) §9가 맡는다.

## 2. `.meta`가 하는 일

Cocos는 `game/assets/` 아래의 파일과 폴더마다 같은 이름의 `.meta`를 만든다. `.meta`에는 그 자산의 UUID와 설정이 들어 있고, 씬과 프리팹은 다른 자산을 경로가 아니라 이 UUID로 가리킨다.

그래서 `.meta`를 커밋하지 않으면, 다른 장비에서 클론한 뒤 Cocos가 그 자산에 `.meta`를 새로 만들면서 UUID도 새로 매긴다. 씬과 프리팹은 옛 UUID를 가리키고 있으므로 참조가 끊긴다. 공식 매뉴얼도 `.meta`를 버전 관리에 함께 올리라고 한다.

> Each file in `assets` generates a `.meta` file with the same name after importing the project, which is used to store the corresponding asset configuration and index information. The `.meta` file needs to be submitted to the version control system as well, …
>
> — [Cocos Creator 3.8 Manual — Project Structure](https://docs.cocos.com/creator/3.8/manual/en/getting-started/project-structure/) (2026-11-12 확인)

## 3. AI가 손으로 만들지 않는 이유

`.meta`에는 UUID 말고도 에디터가 자산을 읽고 채우는 값이 들어 있다. 이미지라면 크기 · 오프셋 · 테두리 값이다([Cocos Creator 3.8 Manual — meta files](https://docs.cocos.com/creator/3.8/manual/en/asset/meta.html), 2026-11-12 확인). 형식만 맞춰 손으로 만들면 이 값이 에디터가 만들 값과 달라질 수 있다. 그래서 이 프로젝트는 그 파일을 최종적으로 쓰는 Cocos가 만든 `.meta`만 믿는다.

## 4. 커밋을 빠뜨리면 무엇이 막나

루트와 `game/`의 `.gitignore`는 `.meta`를 무시하지 않을 뿐, 커밋을 강제하지는 않는다. `pnpm wf approve-pr`은 git이 추적하는 자산 파일과 그 폴더 가운데 같은 이름의 `.meta`가 추적되지 않는 것을 찾으면 `pr-ready`로 넘어가지 못하게 한다(PR 승인이 거부된다). 머지 자체를 막는 장치는 아니다. 그 검사를 언제 돌리는지는 `.claude/lib/change-set.mjs`의 `META_PATHS`가, 무엇을 검사하는지는 `.claude/workflow.mjs`의 `listMissingAssetMeta`가 정한다. 같은 검사는 `pnpm wf check-meta`로 언제든 돌릴 수 있다.
