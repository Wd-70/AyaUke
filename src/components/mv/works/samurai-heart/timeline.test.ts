import { describe, expect, it } from 'vitest';
import type { MvLyricLine } from '../../types';
import { CUES, CUE_LIST, LYRICS, rapidPassages, sectionsOf } from './timeline';

const line = (t: number, end: number, rapid: boolean): MvLyricLine => ({
  t,
  end,
  ja: [{ t, text: 'a', ...(rapid ? { x: 1, y: 2 } : {}) }, { t: t + 0.5, text: 'b', ...(rapid ? { x: 3, y: 4 } : {}) }],
});

describe('rapidPassages', () => {
  it('배치 힌트가 있는 줄이 연달아 있으면 한 구간 — 시각을 앞당겨도 빠지지 않는다', () => {
    const lines = [line(19, 22.8, false), line(22.5, 27.7, true), line(27.9, 31.6, true), line(31.8, 34, false)];
    const [p, ...rest] = rapidPassages(lines);
    expect(rest).toHaveLength(0);
    expect(p.range[0]).toBe(22.5);
    expect(p.range[1]).toBeCloseTo(31.95);
    expect(p.words.map((w) => w.t)).toEqual([22.5, 23, 27.9, 28.4]);
  });

  it('실제 가사에서 1·2절 두 구간', () => {
    const ps = rapidPassages(LYRICS);
    expect(ps).toHaveLength(2);
    expect(ps.every((p) => p.words.some((w) => w.punch))).toBe(true);
  });
});

describe('cues', () => {
  it('cues.json 항목과 편집기 목록이 일치', () => {
    expect(CUE_LIST.map((c) => c.id).sort()).toEqual(Object.keys(CUES).sort());
  });

  it('장면 구간은 효과 시각에서 이어 붙는다', () => {
    const s = sectionsOf({ ...CUES, verse1: 14.2 });
    expect(s[0]).toMatchObject({ id: 'intro', end: 14.2 });
    expect(s[1]).toMatchObject({ id: 'verse1', start: 14.2, end: CUES.pre1 });
    s.slice(1).forEach((x, i) => expect(x.start).toBe(s[i].end));
  });
});
