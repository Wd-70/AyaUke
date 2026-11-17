import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { canAccessAdminPanel } from '@/lib/permissions';
import { isFeatureOpen } from './site-settings.service';
import type { FeatureKey } from './site-settings';

/**
 * 기능 공개 스위치(관리자 → 시스템 설정) 검사. 레이아웃에서 부른다.
 * 꺼져 있으면 관리자가 아닌 방문자에게는 404 — 관리자는 미리 볼 수 있다.
 */
export async function requireFeature(key: FeatureKey): Promise<void> {
  if (await isFeatureOpen(key)) return;
  const session = await getServerSession(authOptions);
  if (!canAccessAdminPanel(session?.user)) notFound();
}
