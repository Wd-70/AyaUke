import { describe, expect, it } from 'vitest';
import {
  applySiteSettingsPatch,
  DEFAULT_SITE_SETTINGS,
  normalizeSiteSettings,
  SiteSettingsPatchSchema,
} from './site-settings';

describe('site settings', () => {
  it('저장된 적이 없으면 기존 동작(모두 공개, 허용 오차 5초)', () => {
    expect(normalizeSiteSettings(undefined)).toMatchObject(DEFAULT_SITE_SETTINGS);
  });

  it('일부만 저장돼 있어도 나머지는 기본값으로 채운다', () => {
    const s = normalizeSiteSettings({ features: { selfie: false }, clipDefaults: {} });
    expect(s.features).toEqual({ game: true, mv: true, selfie: false });
    expect(s.clipDefaults.durationTolerance).toBe(5);
  });

  it('잘못된 값은 버린다', () => {
    const s = normalizeSiteSettings({ features: { game: 'no' }, clipDefaults: { durationTolerance: -3 } });
    expect(s.features.game).toBe(true);
    expect(s.clipDefaults.durationTolerance).toBe(5);
  });

  it('패치는 보낸 항목만 바꾼다', () => {
    const next = applySiteSettingsPatch(DEFAULT_SITE_SETTINGS, { features: { mv: false } });
    expect(next.features).toEqual({ game: true, mv: false, selfie: true });
    expect(next.clipDefaults.durationTolerance).toBe(5);
    expect(applySiteSettingsPatch(next, { clipDefaults: { durationTolerance: 2.5 } }).clipDefaults.durationTolerance).toBe(2.5);
  });

  it('알 수 없는 기능·범위 밖 값은 거부', () => {
    expect(SiteSettingsPatchSchema.safeParse({ features: { chat: true } }).success).toBe(false);
    expect(SiteSettingsPatchSchema.safeParse({ clipDefaults: { durationTolerance: 999 } }).success).toBe(false);
    expect(SiteSettingsPatchSchema.safeParse({ features: { game: false } }).success).toBe(true);
  });
});
