# MV 분석 환경 만들기 — D:\cache\ayauke-mv\venv (레포 밖). 한 번만 실행.
# 사용: powershell -File scripts/mv/setup.ps1
param([string]$Python = 'python')
$ErrorActionPreference = 'Stop'
$cache = 'D:\cache\ayauke-mv'
New-Item -ItemType Directory -Path "$cache\tmp" -Force | Out-Null
$env:TMP = "$cache\tmp"; $env:TEMP = $env:TMP
$pipCache = 'D:\cache\ayauke-clip-analysis\pip'  # 클립 분석 때 받은 torch 휠 재사용
$venv = "$cache\venv"
if (-not (Test-Path "$venv\Scripts\python.exe")) { & $Python -m venv $venv }
$py = "$venv\Scripts\python.exe"
$cuda = @('torch==2.8.0', 'torchaudio==2.8.0', 'torchvision==0.23.0')

& $py -m pip install --cache-dir $pipCache -r (Join-Path $PSScriptRoot 'requirements.txt')
if ($LASTEXITCODE -ne 0) { throw '패키지 설치 실패' }
# qwen-asr은 정렬기만 쓰므로 웹 데모 의존성(gradio·flask 등) 없이
& $py -m pip install --no-deps qwen-asr==0.0.6
# 의존성이 바꿔 놓은 torch를 CUDA판으로 되돌린다
& $py -m pip install --cache-dir $pipCache --force-reinstall --no-deps @cuda --index-url https://download.pytorch.org/whl/cu128
if ($LASTEXITCODE -ne 0) { throw 'CUDA PyTorch 설치 실패' }
& $py -c "import torch; assert torch.cuda.is_available(), 'CUDA 없음'; from qwen_asr import Qwen3ForcedAligner; import audio_separator, faster_whisper; print(torch.__version__, torch.cuda.get_device_name(0))"
if ($LASTEXITCODE -ne 0) { throw '검증 실패' }
Write-Output "준비 완료: $py"
