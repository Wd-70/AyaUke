'use client';

import { useQuery } from '@tanstack/react-query';
import type { SiteSettings } from '@/domains/operations/site-settings';

/** 관리자 화면에서 사이트 설정(관리자 → 시스템 설정)을 읽는다. 여러 탭이 같은 캐시를 쓴다. */
export const SITE_SETTINGS_KEY = ['admin-site-settings'] as const;

export async function fetchAdminSiteSettings(): Promise<SiteSettings> {
  const res = await fetch('/api/admin/system/settings', { cache: 'no-store' });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) throw new Error(json?.error?.message || '설정을 불러오지 못했습니다.');
  return json.data as SiteSettings;
}

export function useSiteSettings() {
  return useQuery({ queryKey: SITE_SETTINGS_KEY, queryFn: fetchAdminSiteSettings, staleTime: 60_000 });
}
