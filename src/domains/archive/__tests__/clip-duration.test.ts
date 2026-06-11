import { describe, test, expect } from 'vitest';
import { shouldApplyDefaultDuration } from '../clip.service';

describe('shouldApplyDefaultDuration', () => {
  const DEFAULT = 225; // 3:45
  const THRESHOLD = 5;

  test('종료시간이 없으면 적용한다', () => {
    expect(shouldApplyDefaultDuration(100, null, DEFAULT, THRESHOLD)).toBe(true);
    expect(shouldApplyDefaultDuration(100, undefined, DEFAULT, THRESHOLD)).toBe(true);
  });

  test('종료시간이 시작시간 이하(비정상)면 적용한다', () => {
    expect(shouldApplyDefaultDuration(100, 100, DEFAULT, THRESHOLD)).toBe(true);
    expect(shouldApplyDefaultDuration(100, 50, DEFAULT, THRESHOLD)).toBe(true);
  });

  test('현재 길이가 기본 길이와 임계값 이내면 보존한다 (수동 조정 보호)', () => {
    expect(shouldApplyDefaultDuration(100, 100 + DEFAULT, DEFAULT, THRESHOLD)).toBe(false); // 정확히 일치
    expect(shouldApplyDefaultDuration(100, 100 + DEFAULT + 5, DEFAULT, THRESHOLD)).toBe(false); // +5초 (경계)
    expect(shouldApplyDefaultDuration(100, 100 + DEFAULT - 5, DEFAULT, THRESHOLD)).toBe(false); // -5초 (경계)
  });

  test('현재 길이가 임계값보다 크게 차이나면 적용한다', () => {
    expect(shouldApplyDefaultDuration(100, 100 + DEFAULT + 6, DEFAULT, THRESHOLD)).toBe(true);
    expect(shouldApplyDefaultDuration(100, 100 + DEFAULT - 6, DEFAULT, THRESHOLD)).toBe(true);
    expect(shouldApplyDefaultDuration(100, 100 + 600, DEFAULT, THRESHOLD)).toBe(true); // 비정상적으로 긴 클립
  });

  test('소수점 시간도 정확히 판정한다', () => {
    expect(shouldApplyDefaultDuration(10.5, 10.5 + 225.3, 225.3, 0.5)).toBe(false);
    expect(shouldApplyDefaultDuration(10.5, 10.5 + 226, 225.3, 0.5)).toBe(true);
  });

  test('임계값 0이면 정확히 일치하는 클립만 보존한다', () => {
    expect(shouldApplyDefaultDuration(0, DEFAULT, DEFAULT, 0)).toBe(false);
    expect(shouldApplyDefaultDuration(0, DEFAULT + 1, DEFAULT, 0)).toBe(true);
  });
});
