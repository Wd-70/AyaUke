import type { Metadata } from 'next'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import { connectDB } from '@/shared/db/mongodb'
import { listSelfiesByDate, getSelfieStats } from '@/domains/selfie/selfie.service'
import SelfieClient, { type SelfieDayView, type SelfieStatsView } from './SelfieClient'

// 자료 수집·검수 완료 전까지 임시 라우트(직접 주소). 검색 비노출.
export const metadata: Metadata = {
  title: '방종셀카 아카이브 - 아야 AyaUke',
  robots: { index: false, follow: false },
}

// 데이터는 자주 안 바뀜 — ISR
export const revalidate = 120

export default async function SelfiePage() {
  await connectDB()
  const [rawDays, stats] = await Promise.all([listSelfiesByDate(), getSelfieStats()])

  // RSC 직렬화를 위해 평문 DTO로 매핑 (ObjectId/Date 제거)
  const days: SelfieDayView[] = rawDays.map((d) => ({
    date: d.date,
    attendeeCount: d.attendeeCount,
    posts: d.posts.map((p) => ({
      source: p.source,
      sourceUrl: p.sourceUrl,
      postedAt: p.postedAt ? new Date(p.postedAt).toISOString() : null,
      images: (p.images || []).map((im) => ({ imageUrl: im.imageUrl })),
    })),
  }))

  const statsView: SelfieStatsView = {
    totalDays: stats.totalDays,
    analyzedDays: stats.analyzedDays,
    uniqueAttendees: stats.uniqueAttendees,
    leaderboard: stats.leaderboard,
    dateCounts: stats.dateCounts,
  }

  return (
    <div className="min-h-screen bg-light-background text-light-text dark:bg-dark-background dark:text-dark-text">
      <Navigation />
      <SelfieClient days={days} stats={statsView} />
      <Footer />
    </div>
  )
}
