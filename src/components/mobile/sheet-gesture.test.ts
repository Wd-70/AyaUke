import { describe, expect, it } from 'vitest';
import { shouldDismissSheet } from './sheet-gesture';

describe('sheet dismissal', () => {
  it('ignores taps, short pulls, and upward movement', () => {
    for (const distance of [-200, 0, 6, 40, 99]) expect(shouldDismissSheet(distance, 500)).toBe(false);
  });
  it('closes at one fifth of sheet height', () => {
    expect(shouldDismissSheet(100, 500)).toBe(true);
  });
  it('requires at least 64 pixels on short sheets', () => {
    expect(shouldDismissSheet(63, 200)).toBe(false);
    expect(shouldDismissSheet(64, 200)).toBe(true);
  });
  it('caps the required pull on tall sheets', () => {
    expect(shouldDismissSheet(111, 1000)).toBe(false);
    expect(shouldDismissSheet(112, 1000)).toBe(true);
  });
});
