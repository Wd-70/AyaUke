import { Shippori_Mincho } from 'next/font/google';
import type { MvWork } from '../../types';
import { createKatappoRenderer } from './scene';
import { BEAT_PERIOD, BEAT_PHASE, CUE_LIST, DURATION, LYRICS } from './timeline';

// 캔버스 전용 폰트 — CSS에 노출되지 않으므로 preload 없이 렌더 전에 document.fonts.load로 받는다.
// 굵기는 하나만(600) — 편집기/무대가 기본 굵기로 load해도 같은 글꼴 파일이 잡히게.
const mincho = Shippori_Mincho({ weight: '600', subsets: ['latin'], preload: false });

const lyricText = LYRICS.flatMap((l) => l.ja.map((c) => c.text)).join('');

const work: MvWork = {
  duration: DURATION,
  lyrics: LYRICS,
  title: '片っぽ',
  subtitle: 'eill · AyaUke cover',
  cues: CUE_LIST,
  beat: { period: BEAT_PERIOD, phase: BEAT_PHASE },
  fonts: [{ family: mincho.style.fontFamily, text: `${lyricText}片っぽ` }],
  createRenderer: (clip) =>
    createKatappoRenderer(clip, {
      ja: mincho.style.fontFamily,
      ko: "'Pretendard Variable', Pretendard, sans-serif",
    }),
};

export default work;
