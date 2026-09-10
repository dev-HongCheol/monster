# ComfyUI 및 MCP 브리지 원클릭 구동 스크립트
$ErrorActionPreference = "Stop"

$comfyDir = "F:\ai\ComfyUI"
$pythonExe = "$comfyDir\venv\Scripts\python.exe"
$mainPy = "$comfyDir\main.py"
$url = "http://127.0.0.1:8188"

# 1. 8188 포트 리스닝 여부 확인
$connection = Get-NetTCPConnection -LocalPort 8188 -State Listen -ErrorAction SilentlyContinue

if (-not $connection) {
    Write-Host "[ComfyUI] 서버를 새 콘솔 창에서 시작합니다..." -ForegroundColor Cyan
    Start-Process powershell.exe -ArgumentList "-NoExit", "-Command", "& '$pythonExe' '$mainPy' --listen 127.0.0.1 --port 8188" -WorkingDirectory $comfyDir
    
    # 서버 준비 대기 (최대 60초)
    Write-Host "[ComfyUI] 서버가 준비될 때까지 대기 중..." -ForegroundColor Yellow
    $ready = $false
    $timeout = 60
    $start = Get-Date
    while (((Get-Date) - $start).TotalSeconds -lt $timeout) {
        try {
            $resp = Invoke-WebRequest -Uri "$url/system_stats" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
            if ($resp.StatusCode -eq 200) {
                $ready = $true
                break
            }
        } catch {
            Start-Sleep -Seconds 1
        }
    }
    
    if ($ready) {
        Write-Host "[ComfyUI] 서버가 성공적으로 시작되었습니다 ($url)." -ForegroundColor Green
    } else {
        Write-Warning "[ComfyUI] 서버 응답 대기 시간이 초과되었습니다. 콘솔 창을 확인하세요."
    }
} else {
    Write-Host "[ComfyUI] 서버가 이미 실행 중입니다 ($url)." -ForegroundColor Green
}

# 2. 브라우저 열기 (브라우저 브리지 monster_mcp_bridge 활성화용)
Write-Host "[ComfyUI] 브라우저를 엽니다 ($url)..." -ForegroundColor Cyan
Start-Process $url

Write-Host "[ComfyUI] 준비 완료! 브라우저 탭을 열어둔 상태로 두시면 MCP가 워크플로우를 실시간 감지합니다." -ForegroundColor Green
