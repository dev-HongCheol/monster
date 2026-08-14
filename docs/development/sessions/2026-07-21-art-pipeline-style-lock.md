# 아트 파이프라인 1차 — 환경 구축 + 스타일 탐색 (F58)

- **작성일:** 2026-07-21
- **브랜치:** design/art-pipeline-style-lock
- **상태:** 화풍 **확정** — 애니 셀 + 주인공은 젊은 여성 불 마법사(2026-07-21). 아트북 셀셰이딩(v1~v3)은 취향이 아니라 폐기, 6화풍 비교 후 애니 선택. 스타일 LoRA 학습은 다음 슬라이스.
- **정본:** [`../../design/spec/art-direction.md`](../../design/spec/art-direction.md) §8·§9·부록 B. 이 문서는 그 1차 실행 기록이다.
- **셋업 절차:** [`../comfyui-setup.md`](../comfyui-setup.md) — 이 문서만으로 환경을 다시 구축할 수 있게 유지한다.
- **백로그:** [`../backlog.md`](../backlog.md) F58.

---

## 1. 이번 슬라이스 스코프

art-direction §9-1의 **1차 생성 테스트 + 스타일 확정**까지. 대비 큰 3종(처녀귀신·구미호·마법사)을 같은 베이스로 뽑아 룩의 일관성을 눈으로 검수하는 게이트다. **8GB VRAM 실측**을 반영해 LoRA 학습·로스터 12종 생성은 다음 슬라이스로 뗐다(추론은 8GB에서 되지만 학습은 빡빡 → comfyui-setup §1).

---

## 2. 환경 구축 (완료)

이 장비(RTX 3070 Ti 8GB, Python 3.12.10)에 ComfyUI를 API 서버 모드로 세웠다. 전 과정은 [`../comfyui-setup.md`](../comfyui-setup.md)에 재현 가능하게 적혀 있다. 요약:

- ComfyUI 0.28.0 (git clone) + venv(F:\ai\ComfyUI\venv) + torch 2.6.0+cu124.
- **함정 1건 — torchaudio 버전 불일치.** requirements가 PyPI 기본 torchaudio(2.11.0)를 끌어와 torch 2.6.0과 ABI가 어긋나 서버가 `WinError 127`로 죽었다. cu124용 2.6.0으로 재설치해 해결(setup §3.1).
- 베이스 체크포인트: **SDXL 1.0 base**(openrail++, 부록 C 라이선스-클린). VAE는 체크포인트 내장분 사용, 검은 이미지 없음.
- 전부 `F:\ai` 밑 격리 + 캐시(pip·HF·torch) 경로를 `F:\ai\cache`로 돌려 C: 오염 방지.

생성은 GUI 클릭 없이 ComfyUI HTTP API(`/prompt`·`/history`)로 구동했다. 드라이버 골격은 setup 부록에 있다.

---

## 3. 1차 생성 (v1)

**공통 스타일 접두(positive 앞부분):**

```
high-resolution stylized 2D game character, Korean folklore art style,
bold clean black outline, soft cel shading with 2-3 flat tones,
muted dark background so the subject pops, front-facing 3/4 top-down view,
full body, centered, plain flat background, no text, no watermark
```

**공통 네거티브:**

```
text, watermark, signature, logo, blurry, low quality, jpeg artifacts,
deformed, extra limbs, bad anatomy, extra fingers, missing fingers,
photorealistic, 3d render, realistic photo, busy background, cluttered background
```

**대상별 접미(부록 B 원전 도상):**
- **처녀귀신:** `a Korean cheonyeo virgin ghost: a young woman in a white traditional mourning hanbok, long straight black hair partly covering a pale sorrowful face, barefoot and slightly floating, pale grey-lavender tones, eerie`
- **구미호:** `a Korean kumiho nine-tailed fox spirit: a woman with fox ears and nine flowing fox tails, wearing a hanbok, cunning fox-like eyes, warm orange fur tones, agile and dangerous`
- **마법사:** `a summoned fantasy wizard hero: hooded robe, wooden staff with a glowing fire ember, Western high-fantasy look that contrasts the Korean ghosts, confident stance, warm firelight`

**샘플러 설정(전 컷 공통):** 1024×1024 · steps 30 · cfg 7.0 · sampler `dpmpp_2m` · scheduler `karras` · denoise 1.0 · seed 1·2·3.

**출력:** `F:\ai\ComfyUI\output\F58\<subject>_<seed>_00001_.png` (9장) + `_contact_sheet.png`.

### 검수 (부록 B 합격 기준)

- **(a) 하나의 게임처럼 보이는가 → 통과(가장 중요).** LoRA 없이 SDXL base만으로 세 대비 캐릭터가 같은 룩(굵은 윤곽·2~3톤 셀셰이딩·저채도 배경·매화/달 모티프)으로 읽혔다. 1차 테스트가 답하려던 **일관성**이 여기서 검증됐다.
- **(b) 실루엣·색 구분 → 대체로 통과.** 처녀귀신=흰옷+검은 머리+차가운 회보라 / 구미호=주황 여우(#FF8C2A 근접) / 마법사=후드+지팡이+불. 구미호·마법사가 둘 다 따뜻한 주황이라 색은 약간 겹치나 실루엣이 가른다.
- **(c) 소형 가독성 → 통과.** 굵은 윤곽·색블록이 20px급에서도 버틴다. 단 프레임/한자 배경이 낀 컷은 축소 시 지저분.

### 짚인 약점
1. **한복이 일본/중국풍으로 샘** — §1·§5의 한국 정체성이 약함.
2. **마법사가 귀신과 대비 안 됨** — §1·§6의 서구 판타지 대비가 안 나오고 같은 동양 로브로 묻힘.
3. **처녀귀신이 "고운 여인"에 가까움** — §5의 "무섭되 유치하지 않게"에 못 미침.
4. **프레임·한자 텍스트 잔재** — 특히 seed 2.

---

## 4. 2차 생성 (v2) — 약점 보정

방향은 유지하고 위 4약점을 프롬프트·네거티브로 조정했다. 출력: `F:\ai\ComfyUI\output\F58_v2\`.

**공통 접두:**

```
high-resolution stylized 2D game character, Korean folklore art book style,
bold clean black outline, soft cel shading with 2-3 flat tones,
full body, centered, single character isolated on a plain muted dark background,
front-facing 3/4 top-down view, no scenery, no frame, no border, no text
```

**공통 네거티브(프레임·배경 잡음·기형 억제):**

```
frame, border, ornate frame, circular frame, decorative border, meander pattern,
chinese characters, japanese text, korean text, text, watermark, signature, logo,
busy background, scenery, landscape, cherry blossom tree, plum tree,
blurry, low quality, jpeg artifacts, deformed, bad anatomy, extra limbs,
extra fingers, missing fingers, photorealistic, 3d render, realistic photo
```

**대상별 positive / 전용 네거티브:**
- **처녀귀신** — pos: `a Korean cheonyeo virgin ghost, wearing a white Korean hanbok mourning dress (jeogori top and long chima skirt with goreum ribbon), long straight black hair partly covering her face, pale lifeless grey-lavender skin, dark hollow sorrowful eyes, barefoot and slightly floating, eerie and unsettling, ghostly presence` / neg: `kimono, hanfu, chinese dress, japanese, cheerful, cute, healthy skin, smiling`
- **구미호** — pos: `a Korean kumiho fox spirit, a woman with fox ears and a sly fox-like face, nine orange-and-white fox tails fanned out behind her, wearing a Korean hanbok, cunning glowing amber eyes, warm orange fur tones, agile and dangerous` / neg: `kimono, hanfu, chinese dress, single tail, two separate foxes, several foxes`
- **마법사** — pos: `a Western high-fantasy wizard hero, tall pointed wizard hat, long flowing European mage robe, wooden staff topped with a glowing fire ember, long beard, confident heroic stance, warm firelight glow, clearly Western medieval fantasy style that contrasts the Korean ghosts` / neg: `kimono, hanbok, hanfu, asian robe, samurai, oriental, ninja, hood without a hat`

샘플러 설정은 v1과 동일(1024² · 30 · 7.0 · dpmpp_2m · karras · seed 1·2·3).

### 검수 (v1 대비 변화)
- **마법사 서구 대비(약점 2) → 해결.** v2 마법사 seed 1이 뾰족 모자 + 수염 + 불 지팡이의 정통 서구 마법사. 의상은 귀신과 대비되되 **굵은 윤곽·셀셰이딩은 공유**해 §1 의도(영웅이 시각적으로 대비되되 한 게임)와 맞는다.
- **귀신 공포감(약점 3) → 개선.** seed 2·3이 창백한 피부·공허한 눈으로 "귀신"에 근접.
- **한국색(약점 1) → 부분.** 귀신은 조금 더 한국풍이나 여전히 범동양. 구미호는 오히려 수인 전사/게임 캐릭터로 드리프트해 한복-여우에서 멀어졌다.
- **프레임·텍스트(약점 4) → 부분.** 대체로 정리됐으나 **seed 2가 여전히 프레임을 문다**(귀신·구미호·마법사 모두 seed 2). → 3차에서 그 컷을 안 고르거나 네거티브를 더 강하게.

---

## 5. 3차(v3) — 잔여 이슈 정리

v2 약점을 프롬프트·네거티브로 마저 잡았다(출력 `F:\ai\ComfyUI\output\F58_v3\`, 시드 4·5·6). 드라이버 `gen_style_test_v3.py`.
- **프레임 제거** `(frame:1.4)(border:1.4)` 가중 → 원형 프레임 사라짐.
- **색 이탈 방지** `full color` + `grayscale, monochrome` 네거티브 → 마법사 흑백 드리프트 해결.
- **구미호 회귀** 수인 전사 드리프트를 `(한복:1.3)`·여인+여우 강조 + `armor, beast warrior` 네거티브로 되돌림. seed 6은 아홉 꼬리 부챗살까지.
- **마법사 서구 대비** 세 시드 모두 일관된 서구 마법사, 풀컬러.

여기까지 **아트북 셀셰이딩 방향 자체는 기술적으로 완성**됐으나, 사용자가 **그 화풍이 취향이 아니라고 판정**했다(2026-07-21). → 방향 재검토.

---

## 6. 화풍 재검토 → 애니 확정

취향이 아닌 건 개별 캐릭터가 아니라 **그리는 방식(화풍)**이므로, 같은 캐릭터(처녀귀신)를 **확 다른 6개 화풍**으로 뽑아 비교했다(`gen_style_compare.py`, 출력 `F58_styles\`, seed 7): ① 아트북 셀 ② 사실적 공포 ③ 페인팅 ④ 애니 ⑤ 만화 ⑥ 먹선 민화.

- **사용자 선택: ④ 애니 셀.** 사실적(②③)·먹선(⑥)은 예뻐도 게임 제약 3개(호드 가독성·AI 일관성·스켈레탈 리깅, art-direction §2)와 상충해 제외. 애니는 취향에 맞으면서 그 제약을 아트북과 똑같이 만족.
- **애니로 대비 3종 재생성**(`gen_anime.py`, 출력 `F58_anime\`, 시드 7·8·9): 귀신·구미호·마법사가 애니 셀로 **일관성 재확인**(합격 a). 귀신은 빛나는 눈으로 공포감, 구미호는 한복 여우, 마법사는 서구 대비 유지.
- **마법사(주인공) = 젊은 여성 불 마법사(사용자 결정).** 색감은 애니 마법사 seed 8 기준(따뜻한 적·갈·주황 + 불빛). 여성판(`gen_wizard_female.py`, `F58_wizard_f\`) → 사용자가 seed 13 선호 + **지팡이 한 손만** 요청 → 확정판(`gen_wizard_final.py`, `F58_wizard_final\`, 시드 13·14·15·16, 한 손 지팡이 + 다른 손 불꽃). **확정 레퍼런스: `F58_wizard_final` seed 13.**
  - 단발 생성의 손목·손 글리치는 이 단계에서 무시(방향 판정 무관). 최종 주인공 에셋 제작 때 수작업 클린업·리깅에서 보정(art-direction §8-2).

---

## 7. 확정 상태 (2026-07-21)

- **화풍 확정: 애니 셀.** (아트북 셀셰이딩 폐기.)
- **주인공 확정: 젊은 여성 불 마법사** — 뾰족 모자·긴 로브·한 손 지팡이, 따뜻한 불 팔레트. 레퍼런스 `F58_wizard_final` seed 13.
- **귀신·구미호:** 애니 방향으로 `F58_anime`가 기준(귀신=빛나는 눈·흰/보라 한복, 구미호=주황 여우·한복).
- **LoRA 씨앗 세트(잠정):** 귀신 `F58_anime` s8·s7, 구미호 `F58_anime` s7·s9, 마법사 `F58_wizard_final` s13. 최종 씨앗은 LoRA 슬라이스 착수 때 다시 추린다.
- **다음 슬라이스:** 위 씨앗으로 **스타일 LoRA 학습**(8GB라 로컬 kohya 극단 최적화 vs 클라우드 GPU 판단) → 이후 로스터 12종·플레이어 스켈레탈·마법 이펙트·맵 아트를 애니 LoRA로 잠가 생성(art-direction §9).

---

## 8. 재현성 기록

- **ComfyUI:** 0.28.0 · Python 3.12.10 · torch 2.6.0+cu124 · torchaudio 2.6.0+cu124.
- **체크포인트:** `sd_xl_base_1.0.safetensors` (stabilityai/stable-diffusion-xl-base-1.0, 약 6.5GB). SHA256 `31E35C80FC4829D14F90153F4C74CD59C90B779F6AFE05A74CD6120B893F7E5B` (공식 해시와 일치 — 무결성 확인).
- **샘플러(전 배치 공통):** 1024×1024 · steps 30(확정판 32) · cfg 7.0 · sampler `dpmpp_2m` · scheduler `karras` · denoise 1.0.
- **애니 공통 스타일 접두:** `clean anime illustration, crisp clean anime lineart, vibrant cel shaded anime style, detailed anime art, full body, centered, single character isolated on a plain muted dark background, front-facing 3/4 top-down view, no scenery, no frame, no border, no text`
- **마법사(여성 확정) positive:** `(a young beautiful woman wizard:1.3), Western high-fantasy sorceress hero, long wavy hair, tall pointed wizard hat, long flowing European mage robe, (holding a single wooden staff in one hand:1.3), the other hand raised casting a small fire ember, warm firelight glow, (warm red brown and orange color palette:1.2), dramatic ember fire, dark muted background, confident heroic stance, clearly Western medieval fantasy style` / **핵심 네거티브:** `(two staffs:1.4), (both hands on staff:1.3), (old man:1.4), (beard:1.4), (male:1.2), kimono, hanbok, (frame:1.4), grayscale`
- **드라이버 스크립트(레포 밖 `F:\ai`):** `gen_style_test.py`(v1) · `_v2` · `_v3` · `gen_style_compare.py`(6화풍) · `gen_anime.py` · `gen_wizard_female.py` · `gen_wizard_final.py` · `montage.py`. 같은 프롬프트·시드·체크포인트면 같은 이미지가 나온다. 골격은 comfyui-setup 부록 A.
- **출력 경로(레포 밖, 커밋 안 함):** `F:\ai\ComfyUI\output\` 아래 `F58`(v1)·`F58_v2`·`F58_v3`·`F58_styles`·`F58_anime`·`F58_wizard_f`·`F58_wizard_final`.
