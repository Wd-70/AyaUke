import { describe, expect, it } from 'vitest';
import { formatRelativeClipTime, toClipRelativeTime, toClipSourceTime } from './clip-time';

describe('클립 기준 편집 시간', () => {
  const origin = 28_800.5; // Eight hours into the source must still display as zero.
  it('원본의 시각 대신 0부터 시작하며 이전 구간은 음수다', () => {
    expect(formatRelativeClipTime(origin, origin)).toBe('0:00.0');
    expect(formatRelativeClipTime(origin - 2.5, origin)).toBe('-0:02.5');
    expect(formatRelativeClipTime(origin + 185.1, origin)).toBe('3:05.1');
    expect(formatRelativeClipTime(origin - 65.1, origin)).toBe('-1:05.1');
  });
  it('양수·음수 입력을 원본 절대 시각으로 되돌려 저장할 수 있다', () => {
    for (const relative of [-30, -0.5, -0.1, 0, 0.1, 180.5]) {
      const source = toClipSourceTime(relative, origin);
      expect(toClipRelativeTime(source, origin)).toBe(relative);
    }
    expect(toClipSourceTime(-2.5, origin)).toBe(28_798);
  });
  it('탐색 범위나 편집 시작점이 변해도 같은 원점을 쓰면 표기가 변하지 않는다', () => {
    const position = origin + 10;
    const windows = [origin - 15, origin - 45, origin - 75];
    for (const windowStart of windows) {
      const sliderPosition = position - windowStart;
      expect(formatRelativeClipTime(windowStart + sliderPosition, origin)).toBe('0:10.0');
    }
    expect(toClipRelativeTime(origin - 5, origin)).toBe(-5);
    expect(toClipRelativeTime(origin + 180, origin)).toBe(180);
  });
  it('소수점 오차와 마이너스 0을 표시하지 않는다', () => {
    expect(formatRelativeClipTime(origin - 0.01, origin)).toBe('0:00.0');
    expect(toClipRelativeTime(28_800.6, origin)).toBe(0.1);
    expect(toClipSourceTime(0.1, origin)).toBe(28_800.6);
  });
});
