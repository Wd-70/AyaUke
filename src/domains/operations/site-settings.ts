import { z } from 'zod';

/**
 * 사이트 설정 (관리자 → 시스템 설정). 순수 정의·검증만 — 저장은 site-settings.service.
 *
 * 기본값은 설정을 저장한 적이 없을 때의 동작 = 기존 동작과 같다(모든 기능 공개, 허용 오차 5초).
 */

export const FEATURE_KEYS = ['game', 'mv', 'selfie'] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];

export const FEATURE_INFO: Record<FeatureKey, { label: string; path: string; description: string }> = {
  game: {
    label: '게임',
    path: '/game',
    description: '팬 게임 페이지. 메뉴에는 없고 주소로만 들어갑니다.',
  },
  mv: {
    label: '클립 MV',
    path: '/mv/…',
    description: '코드로 만든 뮤직비디오 시범 페이지.',
  },
  selfie: {
    label: '방종셀카 아카이브',
    path: '/selfie',
    description: '자료 수집·검수 중인 임시 페이지(검색 비노출).',
  },
};

export type SiteSettings = {
  /** 기능별 공개 여부 — 끄면 관리자가 아닌 방문자에게는 404 */
  features: Record<FeatureKey, boolean>;
  clipDefaults: {
    /** 곡 기본 길이 일괄 적용 때, 이 값(초) 이내로 차이나는 클립은 손으로 맞춘 것으로 보고 보존 */
    durationTolerance: number;
  };
  updatedAt?: string | null;
  updatedBy?: string | null;
};

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  features: { game: true, mv: true, selfie: true },
  clipDefaults: { durationTolerance: 5 },
};

/** 저장된 값(일부만 있거나 옛 형식)을 기본값과 합쳐 완전한 설정으로 */
export function normalizeSiteSettings(raw: unknown): SiteSettings {
  const r = (raw ?? {}) as Partial<SiteSettings> & { features?: Partial<Record<FeatureKey, unknown>> };
  const features = { ...DEFAULT_SITE_SETTINGS.features };
  for (const key of FEATURE_KEYS) {
    if (typeof r.features?.[key] === 'boolean') features[key] = r.features[key] as boolean;
  }
  const tol = Number(r.clipDefaults?.durationTolerance);
  return {
    features,
    clipDefaults: {
      durationTolerance: Number.isFinite(tol) && tol >= 0 && tol <= 120 ? tol : DEFAULT_SITE_SETTINGS.clipDefaults.durationTolerance,
    },
    updatedAt: r.updatedAt ? new Date(r.updatedAt as unknown as string).toISOString() : null,
    updatedBy: r.updatedBy ? String(r.updatedBy) : null,
  };
}

/** PATCH 본문 — 보낸 항목만 바꾼다 */
export const SiteSettingsPatchSchema = z
  .object({
    features: z.object(Object.fromEntries(FEATURE_KEYS.map((k) => [k, z.boolean().optional()])) as Record<FeatureKey, z.ZodOptional<z.ZodBoolean>>).partial().strict().optional(),
    clipDefaults: z.object({ durationTolerance: z.number().min(0).max(120).optional() }).strict().optional(),
  })
  .strict();
export type SiteSettingsPatch = z.infer<typeof SiteSettingsPatchSchema>;

export function applySiteSettingsPatch(current: SiteSettings, patch: SiteSettingsPatch): SiteSettings {
  const features = { ...current.features };
  for (const key of FEATURE_KEYS) {
    const v = patch.features?.[key];
    if (typeof v === 'boolean') features[key] = v;
  }
  return {
    ...current,
    features,
    clipDefaults: {
      durationTolerance: patch.clipDefaults?.durationTolerance ?? current.clipDefaults.durationTolerance,
    },
  };
}
