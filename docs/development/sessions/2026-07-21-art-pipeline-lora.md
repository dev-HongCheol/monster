# 아트 파이프라인 2차 — 스타일 LoRA 학습 (F58b)

- **작성일:** 2026-07-21
- **브랜치:** design/art-pipeline-lora
- **상태:** 애니 셀 **스타일 LoRA 학습 완료 + 검증 합격**(2026-07-21). 짧은 프롬프트로 대비 3종의 룩이 잠기는 것을 확인.
- **선행 슬라이스:** [`2026-07-21-art-pipeline-style-lock.md`](2026-07-21-art-pipeline-style-lock.md)(F58) — 화풍(애니 셀)·주인공(젊은 여성 불 마법사)·확정 씨앗을 여기서 결정했다. 이 문서는 그 씨앗으로 LoRA를 학습한 기록이다.
- **셋업 절차:** [`../kohya-setup.md`](../kohya-setup.md) — 이 문서만으로 학습 환경을 다시 구축할 수 있게 유지한다.
- **정본:** [`../../design/art-direction.md`](../../design/art-direction.md) §8·§9. **백로그:** [`../backlog.md`](../backlog.md) F58b.

---

## 1. 이번 슬라이스 스코프

art-direction §9의 부트스트랩 루프에서 "확정 씨앗 → **스타일 LoRA 학습**" 단계다. 선행 슬라이스(F58)가 확정한 씨앗으로 애니 셀 스타일 LoRA 하나를 로컬 8GB에서 학습하고, ComfyUI에 얹어 스타일이 잠기는지 검증하는 게이트다. 로스터 12종·플레이어 스켈레탈·마법 이펙트·맵 아트 생성은 이 LoRA를 얹어 진행하는 **다음 슬라이스**다.

**확정 씨앗(사용자 결정 2026-07-21):** `F58_anime`(귀신·구미호·마법사 s7·s8·s9, 9장) + `F58_wizard_final` s13(주인공 레퍼런스, 1장) = **10장.**

---

## 2. 로컬/클라우드 결정 — 로컬 확정

comfyui-setup §7과 F58 세션이 미뤄 둔 "로컬 kohya 극단 최적화 vs 클라우드 GPU" 판단을 이 장비 실측으로 내렸다 — **로컬.** 8GB에서 SDXL LoRA 학습이 극단 최적화 조합으로 들어가고(실측 VRAM 97%·OOM 없음), 씨앗 10장짜리 작은 학습이라 24분에 끝나 클라우드로 옮길 이유가 없다. 근거·플래그별 상세는 [`../kohya-setup.md`](../kohya-setup.md) §1·§3.

---

## 3. 환경 구축 (완료)

kohya `sd-scripts`를 ComfyUI와 별도 venv로 `F:\ai\sd-scripts`에 세웠다. 전 과정은 [`../kohya-setup.md`](../kohya-setup.md)에 재현 가능하게 있다. 요약:

- sd-scripts(HEAD `6565877`) + venv(Python 3.12.10) + torch 2.6.0+cu124 + bitsandbytes 0.49.2.
- **설치 검증:** `AdamW8bit`가 CUDA에서 실제 옵티마이저 스텝을 돌고 bf16 지원 확인(8GB 학습의 전제).
- torchaudio는 깔지 않아 ComfyUI 때의 ABI 함정(comfyui-setup §3.1)이 없었다.

---

## 4. 데이터셋 + 캡션

확정 씨앗 10장을 kohya 규약 `10_f58anime`(반복 10회 → 100장/에폭)로 두고, **스타일 캡션**을 달았다 — 트리거 `f58anime` 고정 + 대상 서술(LoRA가 "나머지=화풍"을 학습하도록). 상세 원칙은 kohya-setup §4. 캡션 예:

- 귀신: `f58anime, a Korean cheonyeo virgin ghost, young woman, white mourning hanbok, long straight black hair, pale face, glowing eerie eyes, full body, dark muted background`
- 구미호: `f58anime, a Korean kumiho nine-tailed fox spirit, young woman, fox ears, multiple orange fox tails, hanbok, amber eyes, full body, dark muted background`
- 마법사(s13): `f58anime, a young woman fire wizard, Western sorceress, ..., holding a staff in one hand, casting a fire ember in the other hand, warm firelight, full body, dark muted background`

---

## 5. 학습 실행

전체 커맨드·플래그별 이유는 kohya-setup §3·§5. 핵심 config: SDXL LoRA, 1024², dim16/alpha8, AdamW8bit, cosine lr 1e-4, bf16, gradient checkpointing, cache latents + text encoder outputs, unet-only, sdpa, no_half_vae.

**실측:** 1200스텝(100×12에폭) · **약 24분**(21:39:38→22:03:52) · VRAM 97%(7934/8192MiB) · OOM 없음 · 첫 스텝 5.6초(워밍업) 후 ~1.2초/스텝. **산출물:** 에폭 2·4·6·8·10·12 + 최종본 체크포인트 7개(각 81.5MB), `F:\ai\train\f58_anime\model\`.

> 여담: `-Probe`로 3스텝만 돌리려던 게 전체 12에폭을 완주했다 — `--max_train_steps 3`이 `--max_train_epochs 12`에 덮였기 때문(kohya-setup §7). 결과적으로 한 번에 학습이 끝나 손해는 없었다.

---

## 6. 검증 — 스타일 잠금 (합격)

LoRA를 ComfyUI `models/loras`에 넣고 **짧은 프롬프트**(트리거 + 맨몸 대상, 스타일 접두 없음)로 3종을 뽑아, 같은 시드(13)의 **LoRA 없는 베이스라인과 나란히** 비교했다. 검증 드라이버 `F:\ai\gen_lora_val.py`, 출력 `F:\ai\ComfyUI\output\F58_lora_val\`. 각 대상 프롬프트(짧은 판):

- ghost: `f58anime, a Korean cheonyeo virgin ghost, white hanbok, long black hair, full body`
- kumiho: `f58anime, a Korean kumiho nine-tailed fox spirit woman, fox ears, hanbok, full body`
- wizard: `f58anime, a young woman fire wizard, pointed hat, staff, fire ember, full body`

### 판정 (부록 B 합격 기준)

- **(a) 하나의 게임처럼 보이는가 → 통과.** 베이스라인은 회화풍·부드러운 렌더에 배경 잡물(절·꽃나무)이 가득 차 캐릭터가 묻혔다. LoRA를 얹으면 평평한 셀 셰이딩 + 굵고 깨끗한 윤곽으로, **단일 캐릭터가 어둡/단색 배경에 고립**돼 게임 에셋 형태가 되고 3종이 같은 룩으로 읽혔다. 스타일 서술을 프롬프트에서 뺐는데도 LoRA가 채운다 = 스타일이 트리거에 증류됐다.
- **(b) 실루엣·색 구분 → 통과.** 귀신=흰 한복+빛나는 붉은 눈(공포감 회복), 구미호=주황 여우+한복, 마법사=한 손 지팡이+불꽃(확정 디자인).
- **(c) 소형 가독성 → 통과.** 굵은 윤곽·색블록.

### 에폭 선택

에폭 10과 12를 같은 프롬프트·시드로 비교 → 품질·스타일 거의 동일, **과적합 징후 없음**(대상이 세 캐릭터로 고정되지 않고 배경·포즈가 다양). 스타일이 에폭 10쯤 수렴해 12까지 타지 않았다. **최종본(에폭12) 주력 + 에폭10 폴백, 사용 강도 0.8.**

### 짚인 약점 (스타일 아님 — 다음 생성 슬라이스 사안)

- 구미호가 이번 시드에서 상반신 프레이밍으로 뽑힘("full body"가 약하게 먹음). 시드/프롬프트 강조로 조정 가능.
- 단발 생성의 손목·손 글리치는 최종 에셋 제작 때 수작업 클린업(art-direction §8-2).

---

## 7. 확정 상태 (2026-07-21)

- **스타일 LoRA 완료:** `f58_anime_style.safetensors`(트리거 `f58anime`, dim16, 강도 0.8), 폴백 에폭10. `F:\ai\train\f58_anime\model\` + ComfyUI `models/loras\`.
- **다음 슬라이스(생성):** 이 LoRA를 얹어 로스터 12종·플레이어 스켈레탈·마법 이펙트·맵 아트를 애니 룩으로 잠가 생성(art-direction §9). 주인공은 스타일 LoRA 위에 **캐릭터 LoRA**를 별도 학습할지 그 슬라이스에서 판단(§8-1).

---

## 8. 재현성 기록

- **학습:** sd-scripts HEAD `6565877` · Python 3.12.10 · torch 2.6.0+cu124 · bitsandbytes 0.49.2 · accelerate 1.6.0. 커맨드 전문은 kohya-setup §5.
- **베이스 체크포인트:** `sd_xl_base_1.0.safetensors`(SHA256 `31E35C80…893F7E5B`, F58 세션 §8과 일치).
- **씨앗(레포 밖 `F:\ai`):** `F58_anime\{cheonyeo,kumiho,wizard}_{7,8,9}` + `F58_wizard_final\wizard_13`.
- **드라이버(레포 밖):** 학습 `F:\ai\train\train_f58_anime.ps1` + `accelerate_config.yaml`, 검증 `F:\ai\gen_lora_val.py`. 같은 씨앗·config·시드면 같은 결과.
- **출력(레포 밖, 커밋 안 함):** LoRA `F:\ai\train\f58_anime\model\`, 검증 이미지 `F:\ai\ComfyUI\output\F58_lora_val\`.
