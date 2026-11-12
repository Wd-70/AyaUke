import { describe, expect, it } from 'vitest';
import { CUES, CUE_LIST, LYRICS, SCENES, cutWithin, scenesOf } from './timeline';

describe('cues', () => {
  it('cues.json 항목과 편집기 목록이 일치', () => {
    expect(CUE_LIST.map((c) => c.id).sort()).toEqual(Object.keys(CUES).sort());
  });
});

describe('scenesOf', () => {
  it('PLAN.md 표와 같은 37장면, 빈틈없이 이어진다', () => {
    const s = scenesOf(LYRICS, CUES);
    expect(s).toHaveLength(37);
    expect(new Set(SCENES.map((d) => d.id)).size).toBe(37);
    s.slice(1).forEach((x, i) => {
      expect(x.start).toBe(s[i].end);
      expect(x.start).toBeGreaterThan(s[i].start);
    });
  });

  it('가사 줄에 붙은 장면은 줄 시각을 따라 움직인다', () => {
    const moved = LYRICS.map((l, i) => (i === 16 ? { ...l, t: l.t + 0.7 } : l));
    const winter = scenesOf(moved, CUES).find((x) => x.id === 'winterCore')!;
    expect(winter.start).toBeCloseTo(LYRICS[16].t + 0.7 + CUES.cutOffset);
  });

  it('줄 순서가 뒤집혀도 장면이 사라지지 않는다', () => {
    const broken = LYRICS.map((l, i) => (i === 17 ? { ...l, t: LYRICS[16].t - 1 } : l));
    const s = scenesOf(broken, CUES);
    s.forEach((x) => expect(x.end - x.start).toBeGreaterThan(0));
  });

  it('효과 시각에 붙은 장면(무음·폭발·아웃트로)', () => {
    const s = scenesOf(LYRICS, { ...CUES, climax: 167.1 });
    expect(s.find((x) => x.id === 'bloom')!.start).toBe(167.1);
    expect(s.find((x) => x.id === 'hush')!.start).toBe(CUES.hush);
  });
});

describe('cutWithin', () => {
  it('「落ちて」 덩어리마다 컷이 바뀐다', () => {
    const line = LYRICS[37];
    expect(line.ja).toHaveLength(4);
    expect(cutWithin(line, line.ja[0].t).n).toBe(0);
    expect(cutWithin(line, line.ja[2].t + 0.01).n).toBe(2);
  });
});
