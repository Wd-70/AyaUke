import { describe, expect, it } from 'vitest';
import { BAR, CUES, CUE_LIST, DURATION, LYRICS, SCENES, barAt, barTime, scenesOf } from './timeline';

describe('cues', () => {
  it('cues.json 항목과 편집기 목록이 일치', () => {
    expect(CUE_LIST.map((c) => c.id).sort()).toEqual(Object.keys(CUES).sort());
  });
});

describe('scenesOf', () => {
  it('PLAN.md 표와 같은 57장면, 빈틈없이 이어진다', () => {
    const s = scenesOf(LYRICS, CUES);
    expect(s).toHaveLength(57);
    expect(new Set(SCENES.map((d) => d.id)).size).toBe(57);
    s.slice(1).forEach((x, i) => {
      expect(x.start).toBe(s[i].end);
      expect(x.start).toBeGreaterThan(s[i].start);
    });
    expect(s[s.length - 1].end).toBeGreaterThan(DURATION);
  });

  it('가사에 붙은 장면은 그 말이 시작하는 시각에, 마디에 붙은 장면은 마디 경계에서 시작한다', () => {
    const s = scenesOf(LYRICS, CUES);
    expect(s.find((x) => x.id === 'halfKO')!.start).toBe(LYRICS[0].t);
    expect(s.find((x) => x.id === 'ringAll')!.start).toBe(LYRICS[42].ja[2].t); // yeah
    expect(s.find((x) => x.id === 'blackoutSign')!.start).toBeCloseTo(barTime(37, CUES));
    // 드롭 1은 마디 48에서
    expect(barAt(s.find((x) => x.id === 'eqCity')!.start, CUES)).toBeCloseTo(48);
    expect(s.find((x) => x.id === 'mosaic')!.start - s.find((x) => x.id === 'eqCity')!.start).toBeCloseTo(2 * BAR);
  });

  it('가사 타이밍을 고치면 그 줄에 붙은 장면이 따라 움직이고, 박 보정은 마디에 붙은 장면만 민다', () => {
    const moved = LYRICS.map((l, i) => (i === 30 ? { ...l, t: l.t + 0.2, ja: l.ja.map((c) => ({ ...c, t: c.t + 0.2 })) } : l));
    expect(scenesOf(moved, CUES).find((x) => x.id === 'strobeDancer')!.start).toBeCloseTo(LYRICS[30].t + 0.2);
    const s = scenesOf(LYRICS, { ...CUES, beatOffset: CUES.beatOffset + 0.08 });
    expect(s.find((x) => x.id === 'eqCity')!.start).toBeCloseTo(barTime(48, CUES) + 0.08);
    expect(s.find((x) => x.id === 'woofer')!.start).toBe(LYRICS[5].t);
    expect(s.find((x) => x.id === 'exitSign')!.start).toBe(CUES.coda);
  });

  it('큰 박: 「K.O.」·「Say NO」가 마디 첫 박 근처에 떨어진다', () => {
    const off = (t: number) => Math.abs(barAt(t, CUES) - Math.round(barAt(t, CUES)));
    expect(off(LYRICS[0].ja[1].t)).toBeLessThan(0.15); // K.O.
    expect(off(LYRICS[4].ja[1].t)).toBeLessThan(0.15); // Say NO
    expect(off(LYRICS[23].ja[1].t)).toBeLessThan(0.15); // 훅 2의 K.O.
  });

  it('시각이 뒤집혀도 장면이 사라지지 않는다', () => {
    const s = scenesOf(LYRICS, { ...CUES, coda: 100 });
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
