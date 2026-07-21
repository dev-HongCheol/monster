# 아트 파이프라인 1차 — 환경 구축 + 스타일 탐색 (F58)

- **작성일:** 2026-07-21
- **브랜치:** design/art-pipeline-style-lock
- **상태:** 진행중 — 환경 구축 완료, 1·2차 생성으로 **스타일 방향 검증**. **최종 잠금은 3차 재생성 후로 보류**(사용자 결정 2026-07-21, 토큰 사유로 3차는 추후 진행).
- **정본:** [`../../design/art-direction.md`](../../design/art-direction.md) §8·§9·부록 B. 이 문서는 그 1차 실행 기록이다.
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

## 5. 현재 판정 상태

- **스타일 방향(한국 민속 아트북 셀셰이딩)은 검증됨.** 일관성(합격 기준 a)이 base 체크포인트만으로 확인됐고, v2가 마법사 대비·공포감까지 잡았다.
- **최종 잠금은 보류.** 사용자가 3차 재생성을 원하며(잔여 이슈 정리), 토큰 사유로 3차는 추후 진행한다. 따라서 이 슬라이스는 **환경 구축 + 방향 검증까지 확정**, LoRA 씨앗 확정·학습은 3차 뒤로 넘어간다.
- 유력 씨앗 후보(잠정): 귀신 v2 seed 2·3, 구미호 v1 seed 1·3, 마법사 v2 seed 1. **3차 결과를 보고 확정.**

---

## 6. 3차 계획 (추후)

서버 재기동(comfyui-setup §5) 후 아래를 조정해 재생성한다.
1. **프레임 강력 제거** — seed 2 계열의 프레임 잔재를 네거티브 강화(가중치 상향) 또는 해당 시드 회피로 정리.
2. **구미호 회귀** — 수인 전사 드리프트를 되돌려 "한복 입은 여우 정령"으로. `fox ears + hanbok` 강조, `warrior armor, furry, beast warrior` 네거티브.
3. **마법사 s1 방향 유지** — v2 마법사 seed 1이 목표. 그 프롬프트를 고정하고 시드만 넓혀 변주.
4. 통과 컷 확정 → 재현 기록 완성 → LoRA 학습(별 슬라이스, 8GB면 클라우드 검토).

---

## 7. 재현성 기록

- **ComfyUI:** 0.28.0 · Python 3.12.10 · torch 2.6.0+cu124 · torchaudio 2.6.0+cu124.
- **체크포인트:** `sd_xl_base_1.0.safetensors` (stabilityai/stable-diffusion-xl-base-1.0, 약 6.5GB). SHA256 `31E35C80FC4829D14F90153F4C74CD59C90B779F6AFE05A74CD6120B893F7E5B` (공식 해시와 일치 — 무결성 확인).
- **워크플로:** 3절·4절의 프롬프트 + 샘플러 설정이 곧 워크플로다(드라이버 골격은 comfyui-setup 부록). 같은 프롬프트·시드·체크포인트면 같은 이미지가 나온다.
- **출력 경로:** v1 `F:\ai\ComfyUI\output\F58\`, v2 `F:\ai\ComfyUI\output\F58_v2\`(레포 밖, 커밋하지 않음).
