import { describe, expect, it } from 'vitest';
import { RANGE_STEPS, RANGE_DEFAULT_STEPS, resolveRange, validRange, roundTime, chooseRecommendation } from './clip-range.policy';
import { formatPreciseTime } from '@/shared/utils/clip-time';

describe('클립 구간 정책', () => {
  const official = { startTime: 100, endTime: 400, sourceVersion: 1, rangeVersion: 2, isVerified: false };
  const personal = { startTime: 99.5, endTime: 370, sourceVersion: 1 };
  const community = { startTime: 100.5, endTime: 380, sourceVersion: 1, baseVersion: 2 };
  it('개인 > 검증 공식 > 추천 > 기존 구간 순서로 적용한다', () => {
    expect(resolveRange(official, personal, community).origin).toBe('personal');
    expect(resolveRange({ ...official, isVerified: true }, personal, community).origin).toBe('personal');
    expect(resolveRange({ ...official, isVerified: true }, null, community).origin).toBe('official');
    expect(resolveRange(official, null, community).origin).toBe('community');
    expect(resolveRange(official).origin).toBe('original');
  });
  it('원본 교체와 공식 리비전 변경 시 잘못된 구간을 적용하지 않는다', () => {
    expect(resolveRange({ ...official, sourceVersion: 2 }, personal, community).origin).toBe('original');
    expect(resolveRange({ ...official, rangeVersion: 3 }, null, community).origin).toBe('original');
    expect(resolveRange({ ...official, rangeVersion: 3 }, personal, community).origin).toBe('personal');
  });
  it('동일한 단위 목록에서 시작과 끝의 초기 선택만 다르다', () => {
    expect(RANGE_STEPS).toEqual([0.1, 0.5, 1, 5, 10, 30]);
    expect(RANGE_DEFAULT_STEPS).toEqual({ start: 0.5, end: 5 });
    expect(roundTime(100.1 + 0.1)).toBe(100.2);
    expect(formatPreciseTime(100.1)).toBe('1:40.1');
    expect(formatPreciseTime(3599.99)).toBe('1:00:00.0');
  });
  it('역전·음수·NaN·원본 밖 범위를 거부한다', () => {
    for (const value of [
      { startTime: -1, endTime: 10 }, { startTime: 10, endTime: 10 },
      { startTime: NaN, endTime: 11 }, { startTime: 10, endTime: Infinity },
      { startTime: 10, endTime: 101 }, { startTime: 100, endTime: null },
    ]) expect(validRange(value, 100)).toBe(false);
    expect(validRange({ startTime: 10.1, endTime: 100 }, 100)).toBe(true);
  });
  it('완전 확인 3명, 신규 이의 0명; 기존 추천은 이의 2명부터 해제한다', () => {
    const candidate = { id: 'a', support: 3, objections: 0, createdAt: new Date(0) };
    expect(chooseRecommendation([{ ...candidate, support: 2 }])).toBeNull();
    expect(chooseRecommendation([candidate])).toBe('a');
    expect(chooseRecommendation([{ ...candidate, objections: 1 }])).toBeNull();
    expect(chooseRecommendation([{ ...candidate, objections: 1 }], 'a')).toBe('a');
    expect(chooseRecommendation([{ ...candidate, objections: 2 }], 'a')).toBeNull();
    expect(chooseRecommendation([candidate, { ...candidate, id: 'b' }], 'b')).toBe('b');
  });
});
