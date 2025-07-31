import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import { isSuperAdmin, UserRole } from '@/lib/permissions'
import Navigation from '@/components/Navigation'
import AdminClient from './AdminClient'

export default async function AdminDashboard() {
  // 서버사이드에서 권한 체크
  const session = await getServerSession(authOptions)
  
  if (!session) {
    redirect('/auth/signin')
  }
  
  if (!isSuperAdmin(session.user.role as UserRole)) {
    redirect('/')
  }

  return (
    <div className="min-h-screen bg-light-background dark:bg-dark-background">
      <Navigation currentPath="/admin" />
      <AdminClient />
    </div>
  )
}