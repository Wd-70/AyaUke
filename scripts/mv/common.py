"""MV 분석 공용 — 캐시 위치·모델 경로·오디오 읽기. 모든 무거운 파일은 D:\\cache 아래에 둔다(레포에 넣지 않음)."""
import os
import subprocess
from pathlib import Path

CACHE = Path(os.environ.get('AYAUKE_MV_CACHE', 'D:/cache/ayauke-mv'))
WORK = CACHE / 'work'
# 이미 받아 둔 모델을 다시 받지 않도록 기존 캐시를 가리킨다
HF_HOME = Path('D:/cache/hf')
SEPARATOR_MODELS = Path('D:/cache/ayauke-clip-analysis/models/audio-separator')
SEPARATOR_MODEL = 'model_bs_roformer_ep_317_sdr_12.9755.ckpt'
ALIGNER = 'Qwen/Qwen3-ForcedAligner-0.6B'
FFMPEG = 'C:/ffmpeg/bin/ffmpeg.exe' if Path('C:/ffmpeg/bin/ffmpeg.exe').exists() else 'ffmpeg'

for name, value in {
    'HF_HOME': HF_HOME,
    'HF_HUB_CACHE': HF_HOME / 'hub',
    'TORCH_HOME': CACHE / 'torch',
    'TMP': CACHE / 'tmp',
    'TEMP': CACHE / 'tmp',
}.items():
    os.environ.setdefault(name, str(value))
    Path(os.environ[name]).mkdir(parents=True, exist_ok=True)
os.environ.setdefault('HF_HUB_OFFLINE', '1')  # 모델은 이미 캐시에 있다 — 몰래 받지 않게


def work_dir(song: str) -> Path:
    d = WORK / song
    d.mkdir(parents=True, exist_ok=True)
    return d


def load_mono(path: Path, sr: int = 16000):
    """ffmpeg로 모노 float32 배열을 읽는다(형식 무관)."""
    import numpy as np
    raw = subprocess.run(
        [FFMPEG, '-v', 'error', '-i', str(path), '-ac', '1', '-ar', str(sr), '-f', 'f32le', '-'],
        capture_output=True, check=True,
    ).stdout
    return np.frombuffer(raw, np.float32).copy()
