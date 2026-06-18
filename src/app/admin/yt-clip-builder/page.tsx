import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { canAccessAdminPanel, UserRole } from '@/lib/permissions';
import Navigation from '@/components/Navigation';
import YtClipBuilderClient from './YtClipBuilderClient';

/**
 * 치지직 댓글 → 유튜브 클립 생성 도구 (일회성, 관리자 전용, 직접 주소 접근).
 * 서버사이드에서 관리자 권한을 확인하고, 실제 작업 UI는 클라이언트가 담당한다.
 */
export default async function YtClipBuilderPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/auth/signin');
  if (!canAccessAdminPanel(session.user.role as UserRole)) redirect('/');

  return (
    <div className="min-h-screen bg-light-background dark:bg-dark-background">
      <Navigation currentPath="/admin/yt-clip-builder" />
      <YtClipBuilderClient />
    </div>
  );
}
