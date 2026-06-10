import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import { canAccessAdminPanel, UserRole } from '@/lib/permissions'
import Navigation from '@/components/Navigation'
import AdminClient from './AdminClient'

export default async function AdminDashboard() {
  // 서버사이드에서 권한 체크: 관리자 역할이면 진입 가능, 탭은 권한별로 노출
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/auth/signin')
  }

  if (!canAccessAdminPanel(session.user.role as UserRole)) {
    redirect('/')
  }

  return (
    <div className="min-h-screen bg-light-background dark:bg-dark-background">
      <Navigation currentPath="/admin" />
      <AdminClient />
    </div>
  )
}