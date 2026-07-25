# ComfyUI 셋업 — 아트 파이프라인 실행 (F58)

이 장비에서 아트 파이프라인(art-direction.md §8)을 실제로 돌리기 위한 ComfyUI 설치·구동 절차다. 이번 슬라이스의 목표는 **1차 생성 테스트 + 스타일 확정**(부록 B)까지이고, LoRA 학습·로스터 12종 생성은 다음 슬라이스로 미룬다.

- **작성일:** 2026-07-21
- **브랜치:** design/art-pipeline-style-lock
- **성격:** 재사용 셋업 레퍼런스. 다음에 LoRA 학습·로스터 생성 때 다시 이 문서를 본다.
- **정본:** 파이프라인 설계·프롬프트·라이선스 판단은 [`../design/art-direction.md`](../design/art-direction.md) §8·§9·부록 B~D가 정본이고, 이 문서는 그 실행 절차만 다룬다.
- **관련 백로그:** [`backlog.md`](backlog.md) F58(아트 파이프라인 실행), [`backlog-implement.md`](backlog-implement.md) F59(툴체인 리스크·자동화).

---

## 1. 이 장비 실측 (2026-07-21)

| 항목 | 값 | 함의 |
|------|----|------|
| GPU | NVIDIA GeForce RTX 3070 Ti, **VRAM 8GB** | SDXL 추론은 되지만(오프로딩), 학습은 빡빡 → 학습은 다음 슬라이스·클라우드 검토 |
| 드라이버 | 591.86 | CUDA 12.x 런타임 지원 |
| Python | 3.12.10 (시스템) | venv 베이스로 사용 |
| git | 2.50.1 | clone 방식 사용 |
| 7-Zip | 있음(scoop) | portable 대안 시 압축 해제 가능 |
| F: 여유 | 83.8GB | 이번 슬라이스 소요 ~13–15GB → 넉넉 |

**VRAM 8GB의 의미를 정확히 짚는다.** art-direction §8-7이 "SDXL 권장 12GB 이상"이라 적은 것은 학습·대형 배치를 염두에 둔 값이다. 추론(이미지 한 장씩 생성)은 ComfyUI가 모델을 VRAM에 다 안 올리고 필요할 때만 올렸다 내리는 방식이라, 8GB에서도 SDXL 1.0 base를 1024×1024로 돌릴 수 있다. 다만 그 오프로딩 때문에 12GB급보다 장당 시간이 더 걸린다. **학습이 8GB에서 문제**인 이유는 별개다 — 학습은 모델 가중치 + 옵티마이저 상태 + 활성값을 동시에 VRAM에 쥐고 있어야 해서 추론과 메모리 성격이 다르고, 극단적 최적화(gradient checkpointing·8bit optimizer·배치 1)로도 아슬아슬하다. 그래서 이 문서는 **추론(생성)까지만** 다룬다.

---

## 2. 설계 결정 — 왜 이렇게 까는가

### 2.1 전부 `F:\ai\ComfyUI` 밑으로 (C: 오염 방지)

ComfyUI 본체·가상환경·torch·모델·생성 이미지를 전부 `F:\ai\ComfyUI` 아래에 둔다. 시스템 전역 설치나 관리자 권한은 쓰지 않는다.

문제는 **캐시가 기본값이면 C:로 샌다**는 것이다. pip은 받은 휠을 `%LOCALAPPDATA%\pip\Cache`에, HuggingFace 다운로더는 `%USERPROFILE%\.cache\huggingface`에, torch는 `%USERPROFILE%\.cache\torch`에 쌓는다. torch 휠 하나만 2GB가 넘으므로, 이걸 방치하면 "F:에 깐다"고 해도 수 GB가 C:에 눌어붙는다. 그래서 설치 세션에서 아래 환경변수로 캐시 경로를 전부 `F:\ai\cache` 밑으로 돌린다. 어긋나면 C: 여유가 줄고, 나중에 어디에 뭐가 쌓였는지 추적이 어려워진다.

```powershell
$env:PIP_CACHE_DIR   = "F:\ai\cache\pip"
$env:HF_HOME         = "F:\ai\cache\huggingface"
$env:TORCH_HOME      = "F:\ai\cache\torch"
$env:TMP             = "F:\ai\cache\tmp"
$env:TEMP            = "F:\ai\cache\tmp"
```

> 이 변수는 **설치·다운로드 세션에서만** 세팅하면 된다(영구 등록 불필요). 캐시는 설치가 끝나면 지워도 되는 임시 산출물이라, 공간이 급하면 `F:\ai\cache`를 통째로 비운다.

### 2.2 설치 방식 — git clone + venv (기본), portable (대안)

기본은 **git clone + venv**다. 이 장비에 Python 3.12.10이 이미 있어 그걸 venv 베이스로 쓰면 임베디드 인터프리터를 따로 받을 필요가 없고, 모든 단계가 스크립트로 재현된다. venv를 `F:\ai\ComfyUI\venv`에 두면 torch를 포함한 의존성이 전부 그 폴더 안에 담겨 2.1의 격리와도 맞는다.

**portable(대안):** ComfyUI 공식 Windows portable(`.7z`, 임베디드 Python + torch 포함)을 받아 7-Zip으로 풀어도 된다. 자체 완결이라 견고하지만, 릴리스마다 URL이 바뀌고 임베디드 Python 버전이 고정된다. git 방식이 실패할 때만 쓴다.

---

## 3. 설치 절차 (git clone + venv)

아래는 PowerShell 기준이다. `pip install torch`가 수 GB를 받으므로 **네트워크·시간이 필요**하다.

```powershell
# 0) 폴더 + 캐시 경로 (2.1의 환경변수를 먼저 세팅한 상태에서)
New-Item -ItemType Directory -Force F:\ai, F:\ai\cache | Out-Null

# 1) ComfyUI 본체
git clone https://github.com/comfyanonymous/ComfyUI F:\ai\ComfyUI

# 2) 가상환경 (시스템 Python 3.12.10 기준)
python -m venv F:\ai\ComfyUI\venv

# 3) CUDA용 torch — 3070 Ti(Ampere)는 cu124 휠로 충분.
#    torchaudio까지 셋을 한 번에 cu124로 깐다(뒤 requirements가 torchaudio를
#    PyPI 기본 빌드로 덮어써 ABI가 어긋나는 걸 예방 — 3.1 참조).
F:\ai\ComfyUI\venv\Scripts\python.exe -m pip install --upgrade pip
F:\ai\ComfyUI\venv\Scripts\python.exe -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124

# 4) ComfyUI 의존성
F:\ai\ComfyUI\venv\Scripts\python.exe -m pip install -r F:\ai\ComfyUI\requirements.txt
```

**torch가 GPU를 잡는지 먼저 확인한다**(여기서 `False`가 나오면 이후 생성이 전부 CPU로 떨어져 느려지므로, 모델 받기 전에 잡는다):

```powershell
F:\ai\ComfyUI\venv\Scripts\python.exe -c "import torch; print(torch.cuda.is_available(), torch.version.cuda, torch.cuda.get_device_name(0))"
# 기대: True 12.4 NVIDIA GeForce RTX 3070 Ti
```

### 3.1 알려진 함정 — torchaudio 버전 불일치 (겪음 2026-07-21)

3번에서 torch·torchvision만 cu124 인덱스로 깔고, 4번의 `requirements.txt`가 **torchaudio를 PyPI 기본 인덱스에서** 끌어오면 버전이 어긋난다. 실제로 torch가 `2.6.0+cu124`인데 torchaudio가 `2.11.0`(최신·CPU 빌드)으로 깔려, 서버 기동 때 torchaudio 네이티브 확장 로드가 `OSError: [WinError 127] 지정된 프로시저를 찾을 수 없습니다`로 죽는다. torchaudio가 자기 C++ 확장을 torch의 ABI에 맞춰 링크하는데 torch 버전이 다르면 심볼을 못 찾기 때문이다. ComfyUI는 `comfy/ldm/lightricks/vae/audio_vae.py`가 torchaudio를 임포트해서 이 실패가 서버 전체를 멈춘다.

**복구:** torchaudio를 torch와 **같은 버전·같은 cu124 인덱스**로 다시 깐다.

```powershell
F:\ai\ComfyUI\venv\Scripts\python.exe -m pip install "torchaudio==2.6.0" --index-url https://download.pytorch.org/whl/cu124
F:\ai\ComfyUI\venv\Scripts\python.exe -c "import torchaudio; print(torchaudio.__version__)"  # 기대: 2.6.0+cu124
```

> 아예 예방하려면 3번에서 `torch torchvision torchaudio` 셋을 **한 번에** cu124 인덱스로 깔아 두면 이후 requirements가 이미 만족된 torchaudio를 건드리지 않는다.

**확인된 동작 조합(2026-07-21):** ComfyUI 0.28.0 · Python 3.12.10 · torch 2.6.0+cu124 · torchvision 0.21.0+cu124 · torchaudio 2.6.0+cu124.

---

## 4. 모델 다운로드 (SDXL 1.0 base)

부록 C의 라이선스 판단대로 **SDXL 1.0 base(openrail++)** 를 기본 체크포인트로 쓴다. FLUX dev·NAI 유출 파생은 회피한다.

```powershell
# 체크포인트 (약 6.9GB)
curl.exe -L -o F:\ai\ComfyUI\models\checkpoints\sd_xl_base_1.0.safetensors `
  https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0/resolve/main/sd_xl_base_1.0.safetensors
```

**VAE는 일단 체크포인트 내장분을 쓴다.** SDXL base는 VAE를 품고 있어 별도 파일 없이 생성된다. 다만 8GB에서 fp16으로 돌리면 내장 VAE가 이따금 검은 이미지(NaN)를 뱉는 알려진 문제가 있다. **검은 이미지가 나오면** fp16 안정판 VAE(madebyollin/sdxl-vae-fp16-fix, MIT 라이선스 — 출처 깨끗)를 받아 `models/vae`에 넣고 워크플로에서 VAE로 지정한다:

```powershell
# 검은 이미지 증상이 있을 때만
curl.exe -L -o F:\ai\ComfyUI\models\vae\sdxl_vae_fp16_fix.safetensors `
  https://huggingface.co/madebyollin/sdxl-vae-fp16-fix/resolve/main/sdxl_vae.safetensors
```

---

## 5. 구동 — API 서버 모드

ComfyUI를 API 서버로 띄우면 GUI 클릭 없이 워크플로 JSON을 HTTP로 밀어 넣어 생성할 수 있다(art-direction §8-8). 에이전트가 생성을 주도하고 결과 PNG를 직접 열어 검수하는 방식이 여기서 나온다.

```powershell
F:\ai\ComfyUI\venv\Scripts\python.exe F:\ai\ComfyUI\main.py --listen 127.0.0.1 --port 8188
```

- **8GB에서 느리거나 OOM이 나면** `--lowvram`을 붙인다. 그래도 안 되면 `--novram`(전부 오프로딩, 가장 느림). 보통 3070 Ti 8GB는 기본값으로 SDXL 1024²가 돈다.
- 서버가 뜨면 `http://127.0.0.1:8188`에서 GUI도 열리고, 동시에 아래 API가 열린다.

### API로 생성하는 흐름

| 엔드포인트 | 용도 |
|-----------|------|
| `POST /prompt` | 워크플로 JSON(API 포맷)을 큐에 넣는다. 응답으로 `prompt_id`를 준다 |
| `GET /history/{prompt_id}` | 완료 후 결과 노드의 출력(저장된 파일명)을 준다 |
| `GET /view?filename=...&subfolder=...&type=output` | 생성 이미지 바이트를 받는다 |

생성 이미지는 `F:\ai\ComfyUI\output`에 저장되므로, 검수할 때는 그 경로의 PNG를 직접 열어 본다.

---

## 6. 재현성 기록 (규약)

art-direction §8·부록 B가 말하는 "규약으로 박는다"의 실체가 이 기록이다. 스타일 확정 때 통과한 컷마다 아래를 남겨야, 나중에 같은 이미지를 다시 뽑고 스타일 LoRA 학습 씨앗으로 쓸 수 있다. 이 셋이 없으면 "그때 그 룩"을 재현할 수 없다.

- **워크플로 JSON** (API 포맷 그대로) — 프롬프트·샘플러·스텝·CFG·해상도가 전부 들어 있다.
- **시드(seed)** — 같은 워크플로라도 시드가 다르면 다른 그림이다.
- **체크포인트/VAE 파일 해시** — 어떤 모델로 뽑았는지 고정.

레포에는 **텍스트 기록만**(워크플로 JSON·시드·해시·확정 결정) 커밋한다. 모델·생성 이미지 같은 대용량 바이너리는 `F:\ai` 밑(레포 밖)에 두고 커밋하지 않는다.

---

## 7. 이 문서가 다루지 않는 것

- **스타일 LoRA 학습** — 8GB에서 빡빡해 다음 슬라이스로 미뤘다. 로컬 kohya 극단 최적화 vs 클라우드 GPU(RunPod 등) 판단을 그때 한다.
- **로스터 12종·플레이어 스켈레탈·마법 이펙트·맵 아트 생성** — 스타일 확정(이번 슬라이스)이 선행 게이트다. 통과 후 art-direction §9 순서대로 별 슬라이스에서 진행한다.
- **스켈레탈 리깅(Spine)** — 도구 결정은 art-direction §3.2·F59 참조(DragonBones 폐기 2026-07-24, 프로덕션은 Spine). 스켈레탈 대상 제작 단계에서 다룬다.

---

## 부록 A. 생성 드라이버 (API 구동)

5절의 API를 감싼 순수 stdlib 드라이버다. GUI 없이 프롬프트를 시드별로 밀어 넣고, 완료를 폴링해 저장 파일 경로를 돌려준다. **아래는 재사용 골격이고, 슬라이스별 실제 프롬프트(공통 접두·대상별 접미·네거티브)는 그 슬라이스의 세션 문서에 남긴다**(예: `sessions/2026-07-21-art-pipeline-style-lock.md` §3·§4). 프롬프트를 여기 박아 두면 슬라이스마다 낡으므로, 골격만 여기 두고 값은 세션 문서를 정본으로 한다.

```python
import json, sys, time, urllib.request

SERVER = "http://127.0.0.1:8188"
CKPT = "sd_xl_base_1.0.safetensors"

def build_workflow(positive: str, negative: str, seed: int, prefix: str) -> dict:
    """SDXL text2img 워크플로(API 포맷). VAE는 체크포인트 내장분(노드 4의 슬롯 2)."""
    return {
        "4": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": CKPT}},
        "6": {"class_type": "CLIPTextEncode", "inputs": {"text": positive, "clip": ["4", 1]}},
        "7": {"class_type": "CLIPTextEncode", "inputs": {"text": negative, "clip": ["4", 1]}},
        "5": {"class_type": "EmptyLatentImage", "inputs": {"width": 1024, "height": 1024, "batch_size": 1}},
        "3": {"class_type": "KSampler", "inputs": {
            "seed": seed, "steps": 30, "cfg": 7.0,
            "sampler_name": "dpmpp_2m", "scheduler": "karras", "denoise": 1.0,
            "model": ["4", 0], "positive": ["6", 0], "negative": ["7", 0], "latent_image": ["5", 0]}},
        "8": {"class_type": "VAEDecode", "inputs": {"samples": ["3", 0], "vae": ["4", 2]}},
        "9": {"class_type": "SaveImage", "inputs": {"filename_prefix": prefix, "images": ["8", 0]}},
    }

def post_prompt(workflow: dict) -> str:
    data = json.dumps({"prompt": workflow}).encode()
    req = urllib.request.Request(f"{SERVER}/prompt", data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)["prompt_id"]

def wait_result(prompt_id: str, timeout_s: int = 600):
    """/history/{id}가 outputs를 담을 때까지 폴링 → 저장 파일 경로 목록."""
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        with urllib.request.urlopen(f"{SERVER}/history/{prompt_id}", timeout=30) as r:
            entry = json.load(r).get(prompt_id)
        if entry and entry.get("outputs"):
            return [f"{SERVER}/view?filename={i['filename']}&subfolder={i.get('subfolder','')}&type=output"
                    for n in entry["outputs"].values() for i in n.get("images", [])]
        time.sleep(2)
    raise TimeoutError(prompt_id)
```

**쓰는 법:** 대상마다 `positive`(공통 접두 + 대상 접미)·`negative`를 만들어 `post_prompt(build_workflow(...))`로 큐에 넣고, 반환된 `prompt_id`들을 `wait_result`로 회수한다. 저장 이미지는 `F:\ai\ComfyUI\output\<prefix>`에 떨어진다.

## 부록 B. 대조 시트(검수용)

여러 컷을 한 장에 모아 "나란히" 보는 board는 Pillow로 만든다(부록 B 합격 기준이 나란히 비교를 요구). 행=대상, 열=시드로 배치하고 라벨을 얹는다. 스크립트는 슬라이스 작업 산출물로 `F:\ai`에 두되, 재구축이 필요하면 `output/<batch>/<subject>_<seed>_*.png`를 3열 그리드로 붙이는 짧은 Pillow 스크립트면 충분하다(한글 라벨은 기본 폰트에 글리프가 없어 네모로 뜨니 영문 키를 함께 쓴다).
