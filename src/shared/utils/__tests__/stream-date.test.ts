import { describe, it, expect } from 'vitest';
import { toKstDateString, addDays, parseTitleDate } from '../stream-date';

describe('stream-date', () => {
  it('toKstDateString: UTC 자정 직후도 KST 같은 날로', () => {
    // 2025-12-09T15:30:00Z = 2025-12-10 00:30 KST
    expect(toKstDateString('2025-12-09T15:30:00.000Z')).toBe('2025-12-10');
    // 2025-12-09T01:00Z = 2025-12-09 10:00 KST
    expect(toKstDateString('2025-12-09T01:00:00.000Z')).toBe('2025-12-09');
  });

  it('addDays', () => {
    expect(addDays('2025-12-10', -1)).toBe('2025-12-09');
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01');
  });

  it('parseTitleDate: [YY.MM.DD] / [YYYY.MM.DD]', () => {
    expect(parseTitleDate('[25.12.09] 빙하기 전 저챗')).toBe('2025-12-09');
    expect(parseTitleDate('[2025.1.5] 새해')).toBe('2025-01-05');
    expect(parseTitleDate('날짜 없는 제목')).toBeNull();
  });
});
