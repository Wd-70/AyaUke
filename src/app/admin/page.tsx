import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import { isSuperAdmin, UserRole } from '@/lib/permissions'
import Navigation from '@/components/Navigation'
import AdminClient from './AdminClient'

// 서버 컴포넌트에서 초기 데이터 로드
async function getInitialStats() {
  // 실제로는 데이터베이스에서 가져오기
  return {
    totalSongs: 1250,
    totalUsers: 89,
    totalPlaylists: 156,
    recentActivity: 23
  }
}

export default async function AdminDashboard() {
  // 서버사이드에서 권한 체크
  const session = await getServerSession(authOptions)
  
  if (!session) {
    redirect('/auth/signin')
  }
  
  if (!isSuperAdmin(session.user.role as UserRole)) {
    redirect('/')
  }

  const initialStats = await getInitialStats()

  return (
    <div className="min-h-screen bg-light-background dark:bg-dark-background">
      <Navigation currentPath="/admin" />
      <AdminClient initialStats={initialStats} />
    </div>
  )
}