import { describe, expect, it } from 'vitest';
import { BAR, CUES, CUE_LIST, DURATION, LYRICS, SCENES, barAt, barTime, scenesOf } from './timeline';

describe('cues', () => {
  it('cues.json 항목과 편집기 목록이 일치', () => {
    expect(CUE_LIST.map((c) => c.id).sort()).toEqual(Object.keys(CUES).sort());
  });
});

describe('scenesOf', () => {
  it('PLAN.md 표와 같은 57장면, 빈틈없이 이어진다', () => {
    const s = scenesOf(CUES);
    expect(s).toHaveLength(57);
    expect(new Set(SCENES.map((d) => d.id)).size).toBe(57);
    s.slice(1).forEach((x, i) => {
      expect(x.start).toBe(s[i].end);
      expect(x.start).toBeGreaterThan(s[i].start);
    });
    expect(s[s.length - 1].end).toBeGreaterThan(DURATION);
  });

  it('마디에 붙은 장면은 마디 경계에서 시작한다', () => {
    const s = scenesOf(CUES);
    expect(s.find((x) => x.id === 'blackoutSign')!.start).toBeCloseTo(barTime(37, CUES));
    expect(barAt(s.find((x) => x.id === 'everyone')!.start, CUES)).toBeCloseTo(92);
    // 드롭은 8마디
    const drop = s.find((x) => x.id === 'eqCity')!.start;
    expect(s.find((x) => x.id === 'crack')!.start - drop).toBeCloseTo(8 * BAR);
  });

  it('박 보정을 바꾸면 마디에 붙은 장면이 함께 움직이고, 효과 시각에 붙은 장면은 그대로', () => {
    const s = scenesOf({ ...CUES, beatOffset: 0.08 });
    expect(s.find((x) => x.id === 'woofer')!.start).toBeCloseTo(barTime(9, CUES) + 0.08);
    expect(s.find((x) => x.id === 'exitSign')!.start).toBe(CUES.coda);
  });

  it('효과 시각이 앞 장면보다 일러도 장면이 사라지지 않는다', () => {
    const s = scenesOf({ ...CUES, coda: 100 });
    s.forEach((x) => expect(x.end - x.start).toBeGreaterThan(0));
  });
});

describe('lyrics', () => {
  it('54줄, 줄 안 덩어리와 줄 순서가 시간순', () => {
    expect(LYRICS).toHaveLength(54);
    LYRICS.forEach((l, i) => {
      l.ja.slice(1).forEach((c, k) => expect(c.t).toBeGreaterThanOrEqual(l.ja[k].t));
      expect(l.end).toBeGreaterThan(l.ja[l.ja.length - 1].t);
      if (i) expect(l.t).toBeGreaterThanOrEqual(LYRICS[i - 1].end - 0.011);
    });
  });
});
