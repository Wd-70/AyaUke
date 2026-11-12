"""오디오 분석 → 비트 그리드·소리 반응 곡선·구간 후보·노래 구간 (librosa)

사용: python scripts/mv/analyze.py <곡> --duration 192 [--offset 5]
출력(work/<곡>/):
  envelope.ts    works/<곡>/envelope.ts 로 그대로 복사해 쓰는 반응 곡선(onset·rms·low·high, 50fps)
  analysis.json  비트 그리드(period·phase), 실제 박 시각, 1초 단위 에너지, 구간 경계 후보, 노래하는 구간
화면에 그대로 출력하는 요약을 보고 장면(cues.json)을 짠다.

- 반주(instrumental.wav)가 있으면 onset·low·high는 반주에서 뽑는다 — 목소리에 덜 흔들려 박에 깔끔히 맞는다.
- 라이브 커버는 MR 위에서 불러 템포가 일정하므로 고정 그리드(period·phase)를 맞춘다(사무라이 하트: 손으로 잰 값과
  1ms 이내). librosa가 반 박에 찍는 경우가 있어 맞는 비율이 0.6 안팎이어도 정상 — 그리드가 의심되면 편집기 박자 탭으로 확인.
- 노래 구간(vocals)은 보컬 분리 파일에서 잰다 — 가사 없는 간주·브레이크 장면 위치를 잡는 데 쓴다.
  절을 후렴보다 20dB 가까이 작게 부르는 곡이 있어(카타포) 기준을 낮게(가장 큰 소리의 -30dB) 잡는다.
- 음높이(pitch)와 고음 후보(peaks)도 보컬 파일에서 잰다 — 지르는 순간·전조(키 올림)를 찾아 터뜨릴 시각으로 쓴다.
"""
import argparse
import json

import numpy as np

from common import work_dir

FPS = 50


def norm(a, w=1):
    a = np.convolve(a, np.ones(w) / w, mode='same')
    return np.clip(a / (np.percentile(a, 99.5) or 1), 0, 1)


def enc(a):  # 64단계, 문자 '0'(48)~'o'(111) — engine.ts decodeEnvelope와 짝
    return ''.join(chr(48 + int(round(v * 63))) for v in a)


def fit_grid(beats, lo=0.25, hi=1.0):
    """librosa 박 목록에 가장 잘 맞는 고정 그리드. 대략 템포를 먼저 잡고 세밀하게 좁힌다."""
    ib = np.median(np.diff(beats))
    best = (0, ib, 0)
    for P in np.arange(max(lo, ib * 0.97), min(hi, ib * 1.03), 0.00005):
        for ph in np.arange(0, P, 0.002):
            d = ((beats - ph + P / 2) % P) - P / 2
            sc = float(np.sum(np.exp(-(d / 0.03) ** 2)))
            if sc > best[0]:
                best = (sc, float(P), float(ph))
    return {'period': round(best[1], 5), 'phase': round(best[2], 4), 'bpm': round(60 / best[1], 2),
            'fit': round(best[0] / len(beats), 3)}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('song')
    ap.add_argument('--duration', type=float, required=True, help='MV 길이(초) = 클립 길이')
    ap.add_argument('--offset', type=float, help='파일 시각 - MV 시각 (기본: source.json의 offset)')
    ap.add_argument('--segments', type=int, default=14, help='구간 경계 후보 개수')
    a = ap.parse_args()

    import librosa

    d = work_dir(a.song)
    offset = a.offset
    if offset is None:
        offset = json.loads((d / 'source.json').read_text(encoding='utf-8'))['offset']
    sr, hop = 22050, 512

    def load(name):
        p = d / name
        if not p.exists():
            return None
        y, _ = librosa.load(str(p), sr=sr, mono=True)
        return y[int(offset * sr):int((offset + a.duration) * sr)]

    mix = load('source.wav')
    inst = load('instrumental.wav')
    voc = load('vocals.wav')
    band = inst if inst is not None else mix

    # 박
    _, beats = librosa.beat.beat_track(y=band, sr=sr, hop_length=hop, units='time')
    grid = fit_grid(np.asarray(beats))

    # 반응 곡선
    h = int(sr / FPS)
    n = int(a.duration * FPS)
    onset = librosa.onset.onset_strength(y=band, sr=sr, hop_length=h)
    rms = librosa.feature.rms(y=mix, hop_length=h)[0]
    S = np.abs(librosa.stft(band, n_fft=2048, hop_length=h))
    f = librosa.fft_frequencies(sr=sr, n_fft=2048)
    env = {'onset': norm(onset)[:n], 'rms': norm(rms, 5)[:n], 'low': norm(S[f < 150].mean(0), 2)[:n],
           'high': norm(S[f > 4000].mean(0), 2)[:n]}
    lines = [
        '// 자동 생성 — 클립 오디오 분석 결과(scripts/mv/analyze.py). 손으로 고치지 말 것.',
        '// 각 문자열은 fps 간격 샘플, 문자 코드 48..111 → 0..1 (64단계).',
        '// onset: 어택 강도 / rms: 음량 / low: 저역(킥·베이스) / high: 고역(심벌·하이햇)',
        "import type { MvEnvelope } from '../../types';",
        '',
        'export const ENVELOPE: MvEnvelope = {',
        f'  fps: {FPS},',
        *[f'  {k}: "{enc(v)}",' for k, v in env.items()],
        '};',
        '',
    ]
    (d / 'envelope.ts').write_text('\n'.join(lines), encoding='utf-8')

    # 1초 에너지, 구간 경계 후보(크로마+MFCC 군집)
    sec_rms = librosa.feature.rms(y=mix, hop_length=hop)[0]
    st = librosa.times_like(sec_rms, sr=sr, hop_length=hop)
    energy = np.array([sec_rms[(st >= s) & (st < s + 1)].mean() for s in range(int(a.duration))])
    energy = energy / (energy.max() or 1)
    chroma = librosa.feature.chroma_cqt(y=mix, sr=sr, hop_length=hop)
    mfcc = librosa.feature.mfcc(y=mix, sr=sr, hop_length=hop, n_mfcc=13)
    feat = np.vstack([librosa.util.normalize(chroma), librosa.util.normalize(mfcc)])
    bounds = librosa.frames_to_time(librosa.segment.agglomerative(feat, a.segments), sr=sr, hop_length=hop)

    # 노래하는 구간(보컬 분리 파일의 음량이 일정 이상, 0.6초 미만 틈은 잇는다)
    sung = []
    if voc is not None:
        vr = librosa.feature.rms(y=voc, hop_length=hop)[0]
        vt = librosa.times_like(vr, sr=sr, hop_length=hop)
        on = vr > max(np.percentile(vr, 95) * 0.03, 1e-4)
        start = None
        for t, v in zip(vt, on):
            if v and start is None:
                start = t
            if not v and start is not None:
                if sung and start - sung[-1][1] < 0.6:
                    sung[-1][1] = float(t)
                else:
                    sung.append([float(start), float(t)])
                start = None
        if start is not None:
            sung.append([float(start), float(vt[-1])])
        sung = [[round(s, 2), round(e, 2)] for s, e in sung if e - s > 0.3]

    # 음높이: 0.5초마다 중앙값(MIDI, 노래 안 하면 None) + 고음 후보(곡 최고음 근처를 0.4초 넘게 끈 곳)
    pitch, peaks = [], []
    if voc is not None:
        y16 = librosa.resample(voc, orig_sr=sr, target_sr=16000)
        f0, vflag, _ = librosa.pyin(y16, fmin=110, fmax=1100, sr=16000, frame_length=1024, hop_length=160)
        r16 = librosa.feature.rms(y=y16, frame_length=1024, hop_length=160)[0][:len(f0)]
        loud = r16 > np.percentile(r16, 95) * 0.03  # 노래 구간과 같은 기준 — 끝난 뒤 잡음의 가짜 음높이 제외
        midi = np.where(vflag & loud, librosa.hz_to_midi(np.nan_to_num(f0, nan=1.0)), np.nan)
        for s in range(int(a.duration * 2)):
            seg = midi[s * 50:(s + 1) * 50]
            seg = seg[~np.isnan(seg)]
            pitch.append(round(float(np.median(seg)), 1) if len(seg) > 10 else None)
        top = np.nanpercentile(midi, 99)
        hi = np.nan_to_num(midi, nan=0) >= top - 2.5
        i = 0
        while i < len(hi):
            if hi[i]:
                j = i
                while j < len(hi) and (hi[j] or (j + 5 < len(hi) and hi[j + 5])):
                    j += 1
                if j - i >= 40:
                    peaks.append({'t': round(i / 100, 2), 'len': round((j - i) / 100, 2),
                                  'note': librosa.midi_to_note(float(np.nanmedian(midi[i:j])))})
                i = j
            i += 1

    out = {'offset': offset, 'duration': a.duration, 'grid': grid, 'beats': [round(float(b), 3) for b in beats],
           'energy': [round(float(e), 2) for e in energy], 'segments': [round(float(b), 1) for b in bounds], 'sung': sung,
           'pitch': pitch, 'peaks': peaks}
    (d / 'analysis.json').write_text(json.dumps(out, ensure_ascii=False), encoding='utf-8')

    print(f"박: BPM {grid['bpm']}  period {grid['period']}  phase {grid['phase']}  (감지된 박 중 그리드에 맞는 비율 {grid['fit']})")
    print('구간 경계 후보:', ' '.join(f'{b:.1f}' for b in bounds))
    print('에너지(1초마다):')
    for i in range(0, len(energy), 16):
        print(f'  {i:>4}s ' + ' '.join(f'{v:.2f}' for v in energy[i:i + 16]))
    if sung:
        print('노래 구간:', ' '.join(f'{s:.1f}-{e:.1f}' for s, e in sung))
    if pitch:
        print('음높이(2초마다 중앙값):')
        row = [pitch[k] for k in range(0, len(pitch), 4)]
        for i in range(0, len(row), 16):
            print(f'  {i * 2:>4}s ' + ' '.join(librosa.midi_to_note(v, octave=True, unicode=False).ljust(3) if v else ' - ' for v in row[i:i + 16]))
    if peaks:
        print('고음 후보:', '  '.join(f"{p['t']:.1f}s {p['note']} {p['len']:.1f}초" for p in peaks))
    print('→', d / 'envelope.ts', '/', d / 'analysis.json')


if __name__ == '__main__':
    main()
