"""가사 강제 정렬 (Qwen3-ForcedAligner, 일본어·한국어·영어 등) → 편집기에서 바로 열리는 lyrics.json 초안

whisper처럼 '받아 적기'가 아니라 이미 아는 가사를 소리에 맞춰 붙이므로 오청취가 없다.
보컬만 분리한 파일(separate.py)에 맞춘다.

사용:
  # 새 곡: 가사 텍스트(한 줄 = 한 소절, 부른 순서대로·반복 후렴도 다 적기)
  python scripts/mv/align_lyrics.py <곡> --lyrics 가사.txt --lang Japanese
  # 기존 lyrics.json을 다시 맞추고(연출 힌트 x/y/punch·번역 유지) 기존 타이밍과 차이를 본다
  python scripts/mv/align_lyrics.py <곡> --from-json src/components/mv/works/<곡>/lyrics.json --lang Japanese

가사.txt 형식: 한 줄에 한 소절. 덩어리(화면에 따로 나타나는 단위)는 ' | '로 나눈다(없으면 공백·전각 공백 기준).
  탭 뒤에 번역을 적으면 ko로 들어간다.  예) どっか上の空で　| さっぱり聞いてないんだろう？<TAB>어딘가 건성으로…
출력: work/<곡>/lyrics.aligned.json (편집기 형식). 끝까지 못 맞춘 줄은 '확인 필요'로 출력한다.
시각은 MV 시각(클립 시작 = 0) — source.json의 offset(앞 여유)을 자동으로 뺀다.
"""
import argparse
import json
import re
import unicodedata
from pathlib import Path

from common import ALIGNER, load_mono, work_dir

SR = 16000


def kept(ch: str) -> bool:  # 정렬기가 남기는 글자(문자·숫자·')와 같은 규칙
    return ch == "'" or unicodedata.category(ch)[0] in 'LN'


def parse_txt(path: Path):
    lines = []
    for raw in path.read_text(encoding='utf-8').splitlines():
        if not raw.strip():
            continue
        text, _, ko = raw.partition('\t')
        if '|' in text:
            parts = [p.strip() for p in text.split('|')]
            chunks = [p + ('　' if i < len(parts) - 1 else '') for i, p in enumerate(parts) if p]
        else:
            chunks = re.findall(r'\S+[\s　]*', text.strip())
        if not any(kept(c) for ch in chunks for c in ch):
            continue
        lines.append({'end': 0, **({'ko': ko.strip()} if ko.strip() else {}), 'chunks': [{'t': 0, 'text': c} for c in chunks]})
    return lines


def char_times(lines, words):
    """정렬된 단어들을 원문 글자 위치로 되돌린다 — 덩어리가 단어 중간에서 나뉘어도 글자 단위로 시각을 매긴다."""
    stream = [(li, ci, k) for li, l in enumerate(lines) for ci, c in enumerate(l['chunks'])
              for k, ch in enumerate(c['text']) if kept(ch)]
    chars = ''.join(lines[li]['chunks'][ci]['text'][k] for li, ci, k in stream)
    times, pos = [None] * len(stream), 0
    for w, s, e in words:
        at = chars.find(w, pos)
        if at < 0:
            continue  # 정규화로 글자가 달라진 드문 경우 — 앞 글자 시각으로 메운다
        for j in range(len(w)):
            times[at + j] = (s + (e - s) * j / len(w), s + (e - s) * (j + 1) / len(w))
        pos = at + len(w)
    last = (0.0, 0.0)
    for i, v in enumerate(times):
        if v is None:
            times[i] = (last[1], last[1])
        last = times[i]
    return stream, times


def voice_mask(wav, hop=320):
    """보컬 파일에서 소리가 나는 프레임(20ms)."""
    import numpy as np
    n = len(wav) // hop
    rms = np.sqrt(np.mean(wav[:n * hop].reshape(n, hop) ** 2, axis=1))
    return rms > max(np.percentile(rms, 95) * 0.12, 1e-4), hop / SR


class Aligner:
    """
    정렬기는 '오디오 전체를 덮는 가사'를 전제로 한다. 가사에 비해 오디오가 훨씬 길거나(간주·3분 통째) 반주가 크게 새면
    줄들이 한 시각에 눌려 무너진다. 그래서
      1) 목소리가 없는 1초 넘는 구간을 잘라 이어 붙인 오디오에 맞추고,
      2) 제대로 맞은 줄(글자 길이 정상·순서 맞음·창 끝에 붙지 않음)만 확정해 닻으로 삼고,
      3) 무너진 줄들은 앞뒤 닻 사이 좁은 구간에서 다시 맞추기를 반복한다(같은 구간이 또 실패하면 반씩 나눈다).
    끝까지 확정 못 한 줄은 '확인 필요'로 돌려준다.
    """

    MAX_VOICED = 160.0  # 모델 학습 길이(180초) 안쪽

    def __init__(self, model, wav, lines, lang):
        self.model, self.wav, self.lines, self.lang = model, wav, lines, lang
        self.mask, self.step = voice_mask(wav)
        self.ct = [None] * len(lines)  # 줄마다 글자별 (시작, 끝)
        self.ok = [False] * len(lines)
        self.chars = [sum(kept(ch) for c in l['chunks'] for ch in c['text']) for l in lines]
        self.tried = set()

    def voiced(self, t0, t1, gap=1.0, pad=0.3):
        i0, i1 = int(t0 / self.step), min(len(self.mask), int(t1 / self.step))
        segs = []
        for i in range(i0, i1):
            if self.mask[i]:
                a, b = max(t0, i * self.step - pad), min(t1, (i + 1) * self.step + pad)
                if segs and a - segs[-1][1] < gap:
                    segs[-1][1] = b
                else:
                    segs.append([a, b])
        return segs or [[t0, t1]]

    def at_voiced(self, t0, t1, frac):
        """[t0, t1]의 목소리 시간 중 frac 지점."""
        segs = self.voiced(t0, t1)
        left = sum(b - a for a, b in segs) * frac
        for a, b in segs:
            if left <= b - a:
                return a + left
            left -= b - a
        return t1

    def align(self, idx, t0, t1):
        """idx 줄들을 [t0, t1]의 목소리 부분에 맞추고, 제대로 맞은 줄을 확정한다."""
        import numpy as np
        segs = self.voiced(t0, t1)
        comp = np.concatenate([self.wav[int(a * SR):int(b * SR)] for a, b in segs])
        cum = np.cumsum([0.0] + [b - a for a, b in segs])

        def back(t):
            k = min(max(int(np.searchsorted(cum, t, side='right')) - 1, 0), len(segs) - 1)
            return segs[k][0] + (t - cum[k])

        sub = [self.lines[i] for i in idx]
        text = '\n'.join(''.join(c['text'] for c in l['chunks']) for l in sub)
        res = self.model.align(audio=(comp, SR), text=text, language=self.lang)[0]
        words = [(it.text, back(it.start_time), back(it.end_time)) for it in res]
        stream, times = char_times(sub, words)
        per = [[] for _ in idx]
        for (li, _, _), v in zip(stream, times):
            per[li].append(v)
        prev = t0 - 1
        for j, i in enumerate(idx):
            T = per[j]
            s0, e1 = T[0][0], max(e for _, e in T)
            flat = sum(e - s < 0.005 for s, e in T) / len(T)
            good = (flat < 0.3 and 0.06 * len(T) <= e1 - s0 <= max(2.5, 1.2 * len(T))
                    and s0 >= prev - 0.15 and s0 > t0 + 0.01 and e1 < t1 - 0.01)
            if not self.ok[i]:
                self.ct[i] = T
            if good:
                self.ok[i] = True
                prev = e1

    def bounds(self, run, start, end):
        before = [i for i in range(run[0]) if self.ok[i]]
        after = [i for i in range(run[-1] + 1, len(self.lines)) if self.ok[i]]
        t0 = max(e for _, e in self.ct[before[-1]]) + 0.02 if before else start
        t1 = self.ct[after[0]][0][0] - 0.02 if after else end
        return t0, max(t1, t0 + 0.5)

    def runs(self):
        out, cur = [], []
        for i, ok in enumerate(self.ok):
            if not ok:
                cur.append(i)
            elif cur:
                out.append(cur)
                cur = []
        return out + ([cur] if cur else [])

    def solve(self, start, end):
        stalled = set()
        for _ in range(16):
            runs = [r for r in self.runs() if tuple(r) not in stalled]
            if not runs:
                break
            for run in runs:
                key = tuple(run)
                t0, t1 = self.bounds(run, start, end)
                voiced = sum(b - a for a, b in self.voiced(t0, t1))
                if voiced > self.MAX_VOICED or key in self.tried:
                    if len(run) == 1:
                        stalled.add(key)
                        continue
                    # 너무 길거나 이미 실패한 구간 — 가사 글자 수 비율로 나눠 따로 맞춘다
                    h = len(run) // 2
                    cut = self.at_voiced(t0, t1, sum(self.chars[i] for i in run[:h]) / sum(self.chars[i] for i in run))
                    self.align(run[:h], t0, cut)
                    self.align(run[h:], cut, t1)
                    stalled.add(key)  # 같은 묶음은 다시 나누지 않는다(작아진 묶음은 새로 시도)
                else:
                    self.align(run, t0, t1)
                    self.tried.add(key)
        return [i for i, ok in enumerate(self.ok) if not ok]

    def refine(self, starts, end):
        """
        줄 시작 시각(편집기에서 탭한 값, ±0.5초 정도 오차 허용)을 믿고, 줄마다 좁은 창에서 덩어리·글자 시각만 맞춘다.
        자동 모드가 무너지는 후렴(떼창·반주가 큰 곳)에서도 줄 단위 창이면 정확하다.
        """
        for i in range(len(self.lines)):
            t0 = starts[i] - 0.6
            t1 = (starts[i + 1] if i + 1 < len(starts) else end) + 0.2
            self.align([i], max(0.0, t0), t1)
            T = self.ct[i]
            # 첫 글자가 창 시작에 붙었으면(앞쪽 소리를 끌어다 붙인 것) 탭한 시각을 쓴다
            if T[0][0] < t0 + 0.1:
                T[0] = (starts[i], max(starts[i], T[0][1]))
        return [i for i, ok in enumerate(self.ok) if not ok]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('song')
    src = ap.add_mutually_exclusive_group(required=True)
    src.add_argument('--lyrics', type=Path)
    src.add_argument('--from-json', type=Path)
    ap.add_argument('--lang', default='Japanese', help='Japanese / Korean / English / Chinese …')
    ap.add_argument('--audio', default='vocals.wav', help='work/<곡>/ 안의 파일 (기본 vocals.wav)')
    ap.add_argument('--offset', type=float, help='파일 시각 - MV 시각 (기본: source.json의 offset)')
    ap.add_argument('--start', type=float, default=0.0, help='이 MV 시각부터 찾는다(앞쪽 잡담을 건너뛸 때)')
    ap.add_argument('--lead', type=float, default=0.0, help='덩어리를 이만큼 일찍 띄움(초) — 화면에 미리 보이게')
    ap.add_argument('--refine', action='store_true',
                    help='--from-json의 줄 시작 시각(편집기에서 줄마다 탭한 값)을 믿고 줄 안 덩어리만 맞춘다 — 가장 정확')
    ap.add_argument('--jitter', type=float, default=0.0, help=argparse.SUPPRESS)  # 검증용: 줄 시작을 ±이만큼 흔든다
    a = ap.parse_args()
    if a.refine and not a.from_json:
        ap.error('--refine 은 --from-json 과 함께 (줄 시작 시각이 필요)')

    import torch
    from qwen_asr import Qwen3ForcedAligner

    d = work_dir(a.song)
    offset = a.offset
    if offset is None:
        meta = d / 'source.json'
        offset = json.loads(meta.read_text(encoding='utf-8'))['offset'] if meta.exists() else 0.0
    old = None
    if a.from_json:
        old = json.loads(a.from_json.read_text(encoding='utf-8'))['lines']
        lines = json.loads(json.dumps(old))
    else:
        lines = parse_txt(a.lyrics)

    wav = load_mono(d / a.audio, SR)
    model = Qwen3ForcedAligner.from_pretrained(ALIGNER, dtype=torch.bfloat16, device_map='cuda:0')
    al = Aligner(model, wav, lines, a.lang)
    if a.refine:
        unsure = al.refine([l['chunks'][0]['t'] + offset + a.jitter * ((hash((k, 7)) % 1001) / 500 - 1)
                            for k, l in enumerate(lines)], len(wav) / SR)
    else:
        unsure = al.solve(offset + a.start, len(wav) / SR)

    for li, l in enumerate(lines):
        T = iter(al.ct[li])
        for c in l['chunks']:
            ts = [next(T) for ch in c['text'] if kept(ch)]
            if ts:
                c['t'] = round(max(0.0, ts[0][0] - offset - a.lead), 2)
        l['end'] = round(max(e for _, e in al.ct[li]) - offset + 0.25, 2)
    for l, n in zip(lines, lines[1:]):  # 다음 줄과 겹치지 않게
        l['end'] = round(min(l['end'], n['chunks'][0]['t']), 2)

    out = d / 'lyrics.aligned.json'
    body = ',\n'.join(
        '    { ' + ', '.join([f'"end": {l["end"]}'] + ([f'"ko": {json.dumps(l["ko"], ensure_ascii=False)}'] if l.get('ko') else []))
        + ', "chunks": [\n' + ',\n'.join('      ' + json.dumps(c, ensure_ascii=False) for c in l['chunks']) + '\n    ] }'
        for l in lines
    )
    out.write_text('{\n  "lines": [\n' + body + '\n  ]\n}\n', encoding='utf-8')
    print('→', out)
    if unsure:
        print('확인 필요(정렬이 무너져 추정값):', ', '.join(f'줄{i + 1} {lines[i]["chunks"][0]["t"]:.2f}s' for i in unsure))

    if old:
        diffs = [(lines[li]['chunks'][ci]['t'] - c['t'], li, c['text'])
                 for li, l in enumerate(old) for ci, c in enumerate(l['chunks'])]
        ab = sorted(abs(x) for x, _, _ in diffs)
        pct = lambda p: ab[min(len(ab) - 1, int(p * len(ab)))]
        print(f'기존 대비 덩어리 시작 차이: 중앙값 {pct(0.5):.2f}s · 90% {pct(0.9):.2f}s · 최대 {ab[-1]:.2f}s ({len(ab)}개)')
        for x, li, text in sorted(diffs, key=lambda v: -abs(v[0]))[:12]:
            print(f'  {x:+.2f}s  줄{li + 1:>3}  {text.strip()}')


if __name__ == '__main__':
    main()
