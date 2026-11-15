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
    // 드롭은 8마디 — 마지막 마디(브레이크)의 셋째 박에서 다음 가사가 먼저 들어온다
    const drop = s.find((x) => x.id === 'eqCity')!.start;
    expect(s.find((x) => x.id === 'crack')!.start - drop).toBeCloseTo(7.5 * BAR);
  });

  it('박 보정을 바꾸면 마디에 붙은 장면이 함께 움직이고, 효과 시각에 붙은 장면은 그대로', () => {
    const s = scenesOf({ ...CUES, beatOffset: 0.08 });
    expect(s.find((x) => x.id === 'woofer')!.start).toBeCloseTo(barTime(8, { ...CUES, beatOffset: 0 }) + 0.08);
    expect(s.find((x) => x.id === 'exitSign')!.start).toBe(CUES.coda);
  });

  it('큰 박: 「K.O.」·「Say NO」가 마디 첫 박 근처에 떨어진다', () => {
    const off = (t: number) => Math.abs(barAt(t, CUES) - Math.round(barAt(t, CUES)));
    expect(off(LYRICS[0].ja[1].t)).toBeLessThan(0.15); // K.O.
    expect(off(LYRICS[4].ja[1].t)).toBeLessThan(0.15); // Say NO
    expect(off(LYRICS[23].ja[1].t)).toBeLessThan(0.15); // 훅 2의 K.O.
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
      // 줄 끝이 다음 줄 시작과 조금 겹치는 것은 허용(손으로 맞춘 값) — 시작 순서만 본다
      if (i) expect(l.t).toBeGreaterThan(LYRICS[i - 1].t);
    });
  });
});
