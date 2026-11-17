import { Dela_Gothic_One, Zen_Kaku_Gothic_New } from 'next/font/google';
import type { MvWork } from '../../types';
import { SIGN_TEXT } from './kit';
import { createOdoRenderer } from './scene';
import { BEAT_PERIOD, BEAT_PHASE, CUE_LIST, DURATION, LYRICS } from './timeline';

// 캔버스 전용 폰트 — CSS에 노출되지 않으므로 preload 없이 렌더 전에 document.fonts.load로 받는다.
// 자막은 굵은 고딕(900), 큰 글자·제목은 Dela Gothic One(굵기 하나뿐).
const gothic = Zen_Kaku_Gothic_New({ weight: '900', subsets: ['latin'], preload: false });
const display = Dela_Gothic_One({ weight: '400', subsets: ['latin'], preload: false });

const lyricText = LYRICS.flatMap((l) => l.ja.map((c) => c.text)).join('');
/** 장면 안 간판·전광판·도장에 쓰는 글자 */
const signText = SIGN_TEXT;

const work: MvWork = {
  duration: DURATION,
  lyrics: LYRICS,
  title: '踊',
  subtitle: 'Ado · AyaUke cover',
  cues: CUE_LIST,
  beat: { period: BEAT_PERIOD, phase: BEAT_PHASE },
  fonts: [
    { family: gothic.style.fontFamily, text: `${lyricText}${signText}` },
    { family: display.style.fontFamily, text: `${lyricText}${signText}` },
  ],
  createRenderer: (clip) =>
    createOdoRenderer(clip, {
      ja: gothic.style.fontFamily,
      display: display.style.fontFamily,
      ko: "'Pretendard Variable', Pretendard, sans-serif",
    }),
};

export default work;
