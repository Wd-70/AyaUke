"""보컬/반주 분리 (BS-RoFormer, GPU) → work/<곡>/vocals.wav, instrumental.wav

사용: python scripts/mv/separate.py samurai-heart
가사 정렬은 보컬만 있는 쪽이 훨씬 정확하고, 반주 쪽은 비트·악기 분석에 깨끗하다.
모델은 클립 분석 작업 때 받아 둔 것(D:\\cache\\ayauke-clip-analysis\\models\\audio-separator)을 그대로 쓴다.
"""
import argparse
import json
import logging

from common import SEPARATOR_MODEL, SEPARATOR_MODELS, work_dir


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('song')
    ap.add_argument('--force', action='store_true', help='이미 있어도 다시 분리')
    a = ap.parse_args()

    import torch
    from audio_separator.separator import Separator

    d = work_dir(a.song)
    src = d / 'source.wav'
    if (d / 'vocals.wav').exists() and not a.force:
        print(json.dumps({'cached': str(d / 'vocals.wav')}))
        return
    if not torch.cuda.is_available():
        raise SystemExit('CUDA를 못 찾았어요 — CPU로는 몇 십 분 걸립니다')
    sep = Separator(
        model_file_dir=str(SEPARATOR_MODELS), output_dir=str(d), output_format='WAV',
        log_level=logging.WARNING, use_soundfile=True, use_autocast=True,
        mdxc_params={'segment_size': 256, 'override_model_segment_size': False, 'batch_size': 1, 'overlap': 2, 'pitch_shift': 0},
    )
    sep.load_model(model_filename=SEPARATOR_MODEL)
    sep.separate(str(src), custom_output_names={'Vocals': 'vocals', 'Instrumental': 'instrumental'})
    print(json.dumps({'vocals': str(d / 'vocals.wav'), 'instrumental': str(d / 'instrumental.wav'),
                      'device': torch.cuda.get_device_name(0)}))


if __name__ == '__main__':
    main()
