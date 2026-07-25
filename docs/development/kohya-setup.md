# kohya sd-scripts 셋업 — 스타일 LoRA 학습 (F58b)

이 장비에서 아트 파이프라인의 **스타일 LoRA 학습**을 실제로 돌리기 위한 kohya `sd-scripts` 설치·구동 절차다. [`comfyui-setup.md`](comfyui-setup.md)가 **추론(이미지 생성)** 환경이라면, 이 문서는 그 위에 얹을 **애니 셀 스타일 LoRA를 학습**하는 환경을 다룬다. comfyui-setup §7이 "다음 슬라이스로 미룬다"고 남긴 바로 그 학습이 여기서 이뤄졌다.

- **작성일:** 2026-07-21
- **브랜치:** design/art-pipeline-lora
- **성격:** 재사용 셋업 레퍼런스. 다음에 캐릭터 LoRA를 학습하거나 스타일 LoRA를 다시 구울 때 이 문서를 본다.
- **정본:** 파이프라인 설계·라이선스 판단은 [`../design/art-direction.md`](../design/art-direction.md) §8(특히 §8-1 스타일 LoRA)·부록 C가 정본이고, 이 문서는 그 실행 절차만 다룬다. 확정 씨앗·화풍 결정의 배경은 세션 기록 [`sessions/2026-07-21-art-pipeline-style-lock.md`](sessions/2026-07-21-art-pipeline-style-lock.md), 학습 실행 기록은 [`sessions/2026-07-21-art-pipeline-lora.md`](sessions/2026-07-21-art-pipeline-lora.md).
- **관련 백로그:** [`backlog.md`](backlog.md) F58(아트 파이프라인 실행)의 잔여였던 F58b.

---

## 1. 설계 결정 — 왜 이렇게 학습하는가

### 1.1 로컬 vs 클라우드 — 로컬로 확정

art-direction §8-7과 comfyui-setup §1·§7이 "8GB라 학습은 빡빡 → 로컬 kohya 극단 최적화 vs 클라우드 GPU(RunPod 등) 판단을 그때 한다"고 미뤄 둔 결정이다. 이 장비 실측으로 판단하면 **로컬이 명확히 낫다.**

추론이 8GB에서 되는 것과 학습이 되는 것은 메모리 성격이 다르다(comfyui-setup §1). 학습은 모델 가중치·옵티마이저 상태·활성값을 동시에 VRAM에 쥐어야 해서 더 빡빡하다. 그런데 아래 §3의 극단 최적화 조합을 쓰면 SDXL LoRA 학습이 8GB에 들어간다 — 실측으로 1024² 학습이 **VRAM 97%(7934/8192MiB)로 OOM 없이** 돌았다. 게다가 이번 작업은 씨앗 10장에서 스타일 LoRA 하나를 굽는 작은 일이라 학습 스텝이 적어(1200스텝, 약 24분), 8GB의 "느림"이 실질 문제가 되지 않는다. 로스터 12종을 대량 생성하는 게 아니라 **LoRA 하나를 굽는** 일이다. 클라우드는 비용·씨앗 업로드가 붙는데 로컬로 되는 일을 옮길 이유가 없다.

### 1.2 왜 `sd-scripts`인가 (kohya_ss GUI 대신)

kohya 학습 도구는 두 층이다 — 실제 학습 스크립트인 `kohya-ss/sd-scripts`와, 그 위에 Gradio GUI를 씌운 `bmaltais/kohya_ss`다. 우리는 **`sd-scripts`(CLI + 인자)** 를 쓴다. ComfyUI를 GUI 클릭이 아니라 HTTP API로 굴린 것(comfyui-setup §5)과 같은 이유다 — 같은 인자·씨앗·체크포인트면 같은 LoRA가 나와 "규약으로 박는다"가 문자 그대로 가능하고(art-direction §8-3), 실행이 스크립트로 재현된다. GUI는 재현 기록을 남기지 않으므로 쓰지 않는다.

### 1.3 전부 `F:\ai` 밑 격리

comfyui-setup §2.1과 같다. `sd-scripts` 본체·venv·torch를 전부 `F:\ai\sd-scripts` 아래 두고, 캐시(pip·HuggingFace·torch)는 `F:\ai\cache`로 돌려 C: 오염을 막는다. ComfyUI와 **별도 venv**를 쓰는 이유는, 학습 쪽 의존성(bitsandbytes·accelerate 등)이 추론 환경을 건드리지 않도록 격리하기 위해서다. 아래 설치 세션에서 이 환경변수를 먼저 세팅한다.

```powershell
$env:PIP_CACHE_DIR = "F:\ai\cache\pip"
$env:HF_HOME       = "F:\ai\cache\huggingface"
$env:TORCH_HOME    = "F:\ai\cache\torch"
$env:TMP           = "F:\ai\cache\tmp"
$env:TEMP          = "F:\ai\cache\tmp"
```

---

## 2. 설치 절차

```powershell
# 1) sd-scripts 본체
git clone https://github.com/kohya-ss/sd-scripts F:\ai\sd-scripts

# 2) 가상환경 (시스템 Python 3.12.10)
python -m venv F:\ai\sd-scripts\venv

# 3) CUDA용 torch를 먼저 — 3070 Ti(Ampere)는 cu124.
#    requirements.txt가 torch를 고정하지 않으므로(각자 CUDA에 맞게 깔라는 방침),
#    여기서 cu124 torch를 먼저 깔아 두면 뒤 requirements가 torch를 건드리지 않는다.
#    (ComfyUI 때 겪은 torchaudio ABI 함정과 같은 결의 예방 — §7 참조.)
F:\ai\sd-scripts\venv\Scripts\python.exe -m pip install --upgrade pip
F:\ai\sd-scripts\venv\Scripts\python.exe -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cu124

# 4) sd-scripts 의존성 (accelerate·transformers·diffusers·bitsandbytes 등)
F:\ai\sd-scripts\venv\Scripts\python.exe -m pip install -r F:\ai\sd-scripts\requirements.txt
```

설치 후 **8GB 학습의 핵심 의존성인 bitsandbytes 8bit 옵티마이저가 CUDA에서 실제로 도는지** 확인한다(임포트만으로는 부족 — Windows에서 CUDA 바이너리 로드가 별개로 실패할 수 있다). 여기서 막히면 §3의 `AdamW8bit`를 못 써 8GB 학습이 불가능하므로, 학습 전에 잡는다.

```powershell
F:\ai\sd-scripts\venv\Scripts\python.exe -c "import torch, bitsandbytes as bnb; p=torch.nn.Parameter(torch.randn(64,64,device='cuda')); o=bnb.optim.AdamW8bit([p],lr=1e-3); p.sum().backward(); o.step(); print('AdamW8bit CUDA OK, bf16', torch.cuda.is_bf16_supported())"
# 기대: AdamW8bit CUDA OK, bf16 True
```

**확인된 동작 조합(2026-07-21):** sd-scripts(HEAD `6565877`) · Python 3.12.10 · torch 2.6.0+cu124 · torchvision 0.21.0+cu124 · bitsandbytes 0.49.2 · accelerate 1.6.0 · transformers 4.54.1 · diffusers 0.32.1.

---

## 3. 8GB 극단 최적화 — 플래그별 이유

SDXL LoRA 학습을 8GB에 밀어 넣는 것은 아래 플래그들의 합작이다. 하나라도 빠지면 OOM으로 떨어질 수 있으니, 각 플래그가 무엇을 아끼는지를 남긴다.

| 플래그 | 무엇을 아끼나 |
|--------|--------------|
| `--cache_latents --cache_latents_to_disk` | VAE로 이미지를 잠재값으로 미리 변환해 디스크에 캐시 → 학습 중 VAE를 VRAM에서 뺀다. |
| `--cache_text_encoder_outputs --cache_text_encoder_outputs_to_disk` | 캡션의 텍스트 인코더 출력도 미리 계산·캐시 → 학습 중 텍스트 인코더 2개를 VRAM에서 뺀다. |
| `--network_train_unet_only` | U-Net만 학습(텍스트 인코더 LoRA는 만들되 학습 안 함). 텍스트 인코더 출력을 캐시하는 것과 짝이 맞고, 스타일 LoRA엔 표준. |
| `--gradient_checkpointing` | 역전파용 활성값을 저장 대신 재계산 → 활성값 메모리를 크게 줄인다(대신 속도는 조금 손해). |
| `--optimizer_type AdamW8bit` | 옵티마이저 상태(모멘텀·분산)를 8bit로 → 상태 메모리 1/4. bitsandbytes가 제공. |
| `--mixed_precision bf16` | Ampere가 지원하는 bf16 혼합정밀 → 활성값·연산 메모리 절감(fp16보다 수치 안정). |
| `--sdpa` | 어텐션을 torch 내장 SDPA로 → xformers 설치·버전 매칭 없이 메모리 효율 어텐션. |
| `--no_half_vae` | 잠재값 캐시 계산 때 VAE를 fp32로 → SDXL VAE의 fp16 NaN(검은 잠재) 회피. |

여기에 학습 품질용으로 `--min_snr_gamma 5`(수렴 개선), `--noise_offset 0.05`(씨앗들이 어두운 배경이라 어두운 톤 학습을 돕는다)를 더한다.

> **실측 VRAM:** 위 조합으로 1024² 학습이 **97%(7934/8192MiB)** 를 썼다 — 들어가되 아슬아슬하다. Linux였다면 `PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True`로 조각화 여유를 더하겠지만 **Windows는 이 옵션을 지원하지 않는다**(런타임 경고로 확인 — §7). 대신 Windows에서 동작하는 `max_split_size_mb:256`으로 큰 블록 분할을 막아 파편화를 줄인다. 이번 학습은 이미지가 전부 1024² 고정이라 스텝마다 메모리가 일정해 OOM 없이 완주했다.

---

## 4. 데이터셋 구성 — kohya 규약 + 스타일 캡션

kohya는 학습 이미지 폴더를 `<반복횟수>_<개념>` 이름의 하위 폴더로 읽는다. 확정 씨앗 10장(F58_anime의 귀신·구미호·마법사 s7·s8·s9 + F58_wizard_final s13)을 `10_f58anime`(반복 10회)에 두면, 10장 × 10반복 = 에폭당 100장이 된다.

```
F:\ai\train\f58_anime\
  img\
    10_f58anime\          # 반복 10회
      cheonyeo_7.png / .txt
      ... (10쌍)
  model\                  # LoRA 출력
  log\                    # 텐서보드 로그
```

**스타일 캡션 원칙(중요):** 각 캡션은 `f58anime, <대상 서술>` 꼴이다. **스타일 트리거(`f58anime`)는 모든 이미지에 고정**하고, **대상은 자세히 서술**한다(예: 귀신 = 흰 한복·검은 머리·빛나는 눈). LoRA는 "캡션으로 설명되지 않은 나머지"를 학습하는데, 대상을 캡션이 이미 설명해 버리면 남는 건 **화풍(셀 셰이딩·굵은 윤곽·톤)**뿐이다 — 그래서 트리거에 스타일이 증류된다. 만약 대상을 서술하지 않고 트리거만 주면, 트리거가 스타일 대신 "이 세 캐릭터"를 외워 스타일이 대상에 묶인다. 그러면 다른 대상(로스터 12종)에 얹었을 때 룩이 흔들린다.

---

## 5. 학습 실행 + 재현 기록

`accelerate launch`로 SDXL LoRA 학습 스크립트를 돌린다. 단일 GPU·bf16 설정은 `accelerate_config.yaml`에 박아 `--config_file`로 넘긴다(대화형 `accelerate config` 회피). 전체 인자는 아래와 같다.

```powershell
accelerate launch --num_cpu_threads_per_process 4 --config_file F:\ai\train\accelerate_config.yaml `
  F:\ai\sd-scripts\sdxl_train_network.py `
  --pretrained_model_name_or_path "F:\ai\ComfyUI\models\checkpoints\sd_xl_base_1.0.safetensors" `
  --train_data_dir "F:\ai\train\f58_anime\img" `
  --output_dir "F:\ai\train\f58_anime\model" --output_name "f58_anime_style" `
  --logging_dir "F:\ai\train\f58_anime\log" --caption_extension ".txt" `
  --resolution 1024,1024 --enable_bucket --min_bucket_reso 512 --max_bucket_reso 1280 `
  --network_module networks.lora --network_dim 16 --network_alpha 8 `
  --train_batch_size 1 --max_train_epochs 12 --save_every_n_epochs 2 `
  --learning_rate 1e-4 --unet_lr 1e-4 --optimizer_type AdamW8bit `
  --lr_scheduler cosine --lr_warmup_steps 50 `
  --mixed_precision bf16 --save_precision fp16 --gradient_checkpointing `
  --cache_latents --cache_latents_to_disk `
  --cache_text_encoder_outputs --cache_text_encoder_outputs_to_disk `
  --network_train_unet_only --sdpa --no_half_vae `
  --noise_offset 0.05 --min_snr_gamma 5 `
  --max_data_loader_n_workers 1 --seed 42 --save_model_as safetensors
```

- **재현 조합:** 위 인자 + 씨앗 10장 + 체크포인트 `sd_xl_base_1.0.safetensors`(SHA256 `31E3…7E5B`, 세션 기록 §8과 일치)면 같은 LoRA가 나온다.
- **실측(2026-07-21):** 1200스텝(100장/에폭 × 12에폭) · **약 24분** · VRAM 97% · OOM 없음. 첫 스텝은 CUDA 워밍업으로 ~5.6초, 이후 ~1.2초/스텝으로 안정.
- **산출물:** `F:\ai\train\f58_anime\model\`에 에폭 2·4·6·8·10·12 체크포인트 + 최종본(`f58_anime_style.safetensors`), 각 81.5MB(SDXL LoRA dim16).

레포에는 **텍스트 기록만** 커밋한다(위 커맨드·씨앗 목록·해시·확정 결정). 씨앗 이미지·모델·LoRA 같은 대용량 바이너리는 `F:\ai` 밑(레포 밖)에 두고 커밋하지 않는다(comfyui-setup §6과 동일 규약).

---

## 6. 검증 — 스타일 잠금 확인 (합격)

학습한 LoRA를 ComfyUI `models/loras`에 넣고, **짧은 프롬프트**(트리거 `f58anime` + 맨몸 대상, 스타일 접두 없음)로 대비 3종을 뽑아 **LoRA 없는 베이스라인과 같은 시드로 나란히** 비교했다(art-direction 부록 B의 합격 기준). 목적은 "스타일 서술을 프롬프트에서 빼도 LoRA가 애니 셀 룩을 채우는가"다.

- **베이스라인(LoRA 없음):** 회화풍·부드러운 렌더, 배경에 절·꽃나무 같은 잡물이 가득 차 캐릭터가 묻힘 → 게임 에셋이 아니라 일러스트.
- **LoRA(에폭12 @ 강도 0.8):** 평평한 셀 셰이딩 + 굵고 깨끗한 윤곽, **단일 캐릭터가 어둡거나 단색인 배경에 고립**돼 게임 에셋으로 바로 쓸 형태. 대비 3종이 **같은 룩(한 게임)**으로 읽힌다(§8-1의 "스타일 하나, 대상만 바꾼다"가 실현). 귀신은 빛나는 붉은 눈으로 공포감, 마법사는 한 손 지팡이 + 다른 손 불꽃의 확정 디자인, 구미호는 여우귀·꼬리·한복을 유지했다.
- **에폭 선택:** 에폭 10과 12가 품질·스타일에서 거의 구분되지 않았고 둘 다 과적합 징후(대상이 세 캐릭터로 고정되는 현상)가 없었다 — 스타일이 에폭 10쯤 수렴했고 12까지도 타지 않았다는 뜻이다. **최종본(에폭12)을 주력, 에폭10을 폴백**으로 둔다. 사용 강도는 0.8이 기본.

검증 이미지 9장 생성은 약 2분(장당 ~13초, 모델이 VRAM에 상주). 생성 드라이버 골격은 comfyui-setup 부록 A, 이번 검증 프롬프트는 세션 기록 [`sessions/2026-07-21-art-pipeline-lora.md`](sessions/2026-07-21-art-pipeline-lora.md)에 있다.

---

## 7. 알려진 함정

- **`expandable_segments`는 Windows 미지원.** 조각화 완화용 `PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True`는 Linux 전용(CUDA VMM)이라 Windows에선 `not supported on this platform` 경고와 함께 무시된다(no-op). Windows에선 `max_split_size_mb:256`을 쓴다(§3).
- **`--max_train_steps`는 `--max_train_epochs`에 덮인다.** 짧게 3스텝만 돌려 확인하려고 `--max_train_steps 3`을 줘도, `--max_train_epochs 12`가 있으면 sd-scripts가 스텝 예산을 에폭에서 다시 계산해 12에폭 전체를 돈다. 진짜로 몇 스텝만 돌리려면 `--max_train_epochs`를 빼고 `--max_train_steps`만 준다.
- **torchaudio는 여기서 깔지 않는다.** ComfyUI(comfyui-setup §3.1)는 torchaudio ABI 불일치로 서버가 죽었지만, sd-scripts의 `requirements.txt`엔 torchaudio가 없고 §2에서 `torch torchvision`만 cu124로 깔아 그 함정 자체가 없다.
- **HuggingFace symlink 경고.** 첫 실행 때 CLIP 토크나이저를 받으며 "심볼릭 링크 미지원" 경고가 뜬다(무해). `$env:HF_HUB_DISABLE_SYMLINKS_WARNING = "1"`로 끈다.
- **PowerShell에서 `2>&1`로 학습 로그를 합치지 말 것.** sd-scripts는 로그·진행바를 stderr로 뿜는데, PowerShell에서 `2>&1`로 성공 스트림에 합치면 각 줄이 `NativeCommandError`로 감싸져 로그가 오염되고, `$ErrorActionPreference="Stop"`이면 무해한 경고에 스크립트가 죽는다. stderr는 파일로 **직접 리다이렉트**(`2>파일`)해야 원본 로그가 남는다.

---

## 8. 이 문서가 다루지 않는 것

- **로스터 12종·플레이어 스켈레탈·마법 이펙트·맵 아트 생성** — 스타일 LoRA가 준비됐으니 이제 이 LoRA를 얹어 생성하는 단계다. art-direction §9 순서대로 별 슬라이스에서 진행한다.
- **캐릭터 LoRA(주인공)** — 여러 파츠·미래 스킨에서 같은 인물을 유지하려면 스타일 LoRA 위에 캐릭터 LoRA를 하나 더 학습한다(art-direction §8-1). 이 문서의 스타일 LoRA와 별개 학습이며, 데이터셋·트리거를 따로 잡는다.
- **스켈레탈 리깅(Spine)** — art-direction §3.2·F59. 스켈레탈 대상 제작 단계에서 다룬다. DragonBones 폐기(2026-07-24), 프로덕션은 Spine.
