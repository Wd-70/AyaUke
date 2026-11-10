import { Dela_Gothic_One, Yuji_Syuku } from 'next/font/google';
import type { MvWork } from '../../types';
import { createSamuraiHeartRenderer } from './scene';
import { LYRICS, SECTIONS } from './timeline';

// 캔버스 전용 폰트 — CSS에 노출되지 않으므로 preload 없이 렌더 전에 document.fonts.load로 받는다
const display = Dela_Gothic_One({ weight: '400', subsets: ['latin'], preload: false });
const brush = Yuji_Syuku({ weight: '400', subsets: ['latin'], preload: false });

const lyricText = LYRICS.flatMap((l) => l.ja.map((c) => c.text)).join('');

const work: MvWork = {
  duration: 192,
  title: 'サムライハート (Some Like It Hot!!)',
  subtitle: 'SPYAIR · AyaUke cover',
  sections: SECTIONS,
  fonts: [
    { family: display.style.fontFamily, text: `${lyricText}Some Like It Hot!!AyaUkeDAY BY DAY0123456789` },
    { family: brush.style.fontFamily, text: 'サムライハート孤独' },
  ],
  createRenderer: () =>
    createSamuraiHeartRenderer({
      display: display.style.fontFamily,
      brush: brush.style.fontFamily,
      ko: "'Pretendard Variable', Pretendard, sans-serif",
    }),
};

export default work;
