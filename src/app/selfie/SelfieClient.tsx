'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import {
  CalendarDaysIcon,
  UserGroupIcon,
  TrophyIcon,
  ArrowTopRightOnSquareIcon,
  PlusIcon,
  XMarkIcon,
  CameraIcon,
} from '@heroicons/react/24/outline'

export interface SelfieImageView {
  imageUrl: string
}
export interface SelfiePostView {
  source: 'x' | 'cafe'
  sourceUrl: string
  postedAt: string | null
  images: SelfieImageView[]
}
export interface SelfieDayView {
  date: string
  attendeeCount: number
  posts: SelfiePostView[]
}
export interface SelfieStatsView {
  totalDays: number
  analyzedDays: number
  uniqueAttendees: number
  leaderboard: Array<{ nickname: string; days: number }>
  dateCounts: Array<{ date: string; count: number }>
}

interface MyRecords {
  count: number
  rank: number | null
  dates: Array<{ date: string; matchedNickname: string }>
  aliases: Array<{ id: string; nickname: string }>
}

const fmtDate = (s: string) => s.replace(/-/g, '.')

export default function SelfieClient({ days, stats }: { days: SelfieDayView[]; stats: SelfieStatsView }) {
  const { data: session } = useSession()
  const loggedIn = !!session?.user?.channelId

  const [me, setMe] = useState<MyRecords | null>(null)
  const [aliasInput, setAliasInput] = useState('')
  const [busy, setBusy] = useState(false)

  const loadMe = useCallback(async () => {
    if (!loggedIn) return
    const res = await fetch('/api/selfie/me')
    if (res.ok) setMe(await res.json())
  }, [loggedIn])

  useEffect(() => { loadMe() }, [loadMe])

  const addAlias = async () => {
    const nickname = aliasInput.trim()
    if (!nickname) return
    setBusy(true)
    await fetch('/api/selfie/alias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname }),
    })
    setAliasInput('')
    await loadMe()
    setBusy(false)
  }

  const removeAlias = async (id: string) => {
    setBusy(true)
    await fetch(`/api/selfie/alias?id=${id}`, { method: 'DELETE' })
    await loadMe()
    setBusy(false)
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <CameraIcon className="h-7 w-7 text-light-accent dark:text-dark-accent" />
          방종셀카 아카이브
        </h1>
        <p className="mt-1 text-sm text-light-text/60 dark:text-dark-text/60">
          방송 종료 전 셀카에 담긴 채팅 닉네임을 날짜별로 모아 기록합니다.
        </p>
      </header>

      {/* 통계 */}
      <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard icon={<CalendarDaysIcon className="h-5 w-5" />} label="기록된 회차" value={stats.totalDays} />
        <StatCard icon={<UserGroupIcon className="h-5 w-5" />} label="고유 참석자" value={stats.uniqueAttendees} />
        <StatCard icon={<TrophyIcon className="h-5 w-5" />} label="분석 완료 회차" value={stats.analyzedDays} />
      </section>

      {/* 내 기록 */}
      <section className="mb-8 rounded-xl border border-light-primary/20 dark:border-dark-primary/20 bg-white/40 dark:bg-gray-900/30 p-4">
        <h2 className="mb-3 text-lg font-bold">내 기록</h2>
        {!loggedIn ? (
          <p className="text-sm text-light-text/60 dark:text-dark-text/60">로그인하면 내 닉네임이 담긴 방종셀카 기록을 볼 수 있어요.</p>
        ) : !me ? (
          <p className="text-sm text-light-text/60 dark:text-dark-text/60">불러오는 중...</p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span>출현 <b className="text-light-accent dark:text-dark-accent">{me.count}</b>회</span>
              {me.rank && <span>랭크 <b>#{me.rank}</b></span>}
            </div>
            {me.dates.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {me.dates.map((d) => (
                  <span key={d.date} className="rounded-full bg-light-accent/15 dark:bg-dark-accent/15 px-2.5 py-1 text-xs" title={`매칭: ${d.matchedNickname}`}>
                    {fmtDate(d.date)}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-light-text/60 dark:text-dark-text/60">
                아직 매칭된 기록이 없어요. 채팅에서 쓰던 닉네임이 로그인 닉네임과 다르면 아래에 등록해보세요.
              </p>
            )}

            {/* 별칭 등록 */}
            <div className="pt-1">
              <div className="mb-1 text-xs font-medium text-light-text/60 dark:text-dark-text/60">내 닉네임/별칭 (과거 닉 포함)</div>
              <div className="flex flex-wrap items-center gap-1.5">
                {me.aliases.map((a) => (
                  <span key={a.id} className="inline-flex items-center gap-1 rounded-full border border-light-primary/30 dark:border-dark-primary/30 px-2 py-0.5 text-xs">
                    {a.nickname}
                    <button onClick={() => removeAlias(a.id)} disabled={busy} className="text-light-text/40 hover:text-red-500">
                      <XMarkIcon className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <span className="inline-flex items-center gap-1">
                  <input
                    value={aliasInput}
                    onChange={(e) => setAliasInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addAlias() } }}
                    placeholder="이 닉네임도 나야"
                    maxLength={50}
                    className="w-32 rounded-lg border border-light-primary/20 dark:border-dark-primary/20 bg-white/60 dark:bg-gray-800/50 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent"
                  />
                  <button onClick={addAlias} disabled={busy || !aliasInput.trim()} className="inline-flex items-center rounded-lg bg-light-accent dark:bg-dark-accent px-2 py-1 text-xs text-white disabled:opacity-50">
                    <PlusIcon className="h-3.5 w-3.5" />
                  </button>
                </span>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 리더보드 */}
      {stats.leaderboard.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-bold">최다 출현</h2>
          <div className="flex flex-wrap gap-1.5">
            {stats.leaderboard.slice(0, 30).map((l, i) => (
              <span key={l.nickname + i} className="inline-flex items-center gap-1.5 rounded-full border border-light-primary/20 dark:border-dark-primary/20 bg-white/40 dark:bg-gray-900/30 px-2.5 py-1 text-xs">
                <span className="text-light-text/40 dark:text-dark-text/40">{i + 1}</span>
                <span className="font-medium">{l.nickname}</span>
                <span className="text-light-accent dark:text-dark-accent">{l.days}</span>
              </span>
            ))}
          </div>
        </section>
      )}

      {/* 갤러리 */}
      <section>
        <h2 className="mb-3 text-lg font-bold">날짜별 셀카</h2>
        {days.length === 0 ? (
          <p className="rounded-xl border border-light-primary/15 dark:border-dark-primary/15 p-10 text-center text-sm text-light-text/55 dark:text-dark-text/55">
            아직 수집된 방종셀카가 없습니다.
          </p>
        ) : (
          <div className="space-y-6">
            {days.map((d) => (
              <div key={d.date}>
                <div className="mb-2 flex items-center gap-2">
                  <h3 className="text-base font-bold">{fmtDate(d.date)}</h3>
                  <span className="rounded-full bg-light-primary/10 dark:bg-dark-primary/20 px-2 py-0.5 text-xs text-light-text/60 dark:text-dark-text/60">
                    참석 {d.attendeeCount}명
                  </span>
                  {d.posts.map((p, pi) => (
                    <a key={pi} href={p.sourceUrl} target="_blank" rel="noopener noreferrer"
                       className="inline-flex items-center gap-0.5 text-xs text-light-text/45 hover:text-light-accent dark:text-dark-text/45 dark:hover:text-dark-accent">
                      {p.source.toUpperCase()}
                      <ArrowTopRightOnSquareIcon className="h-3 w-3" />
                    </a>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                  {d.posts.flatMap((p) => p.images).map((im, ii) => (
                    <a key={ii} href={im.imageUrl} target="_blank" rel="noopener noreferrer"
                       className="block overflow-hidden rounded-lg border border-light-primary/15 dark:border-dark-primary/15 bg-light-primary/5 dark:bg-dark-primary/10">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={im.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer"
                           className="aspect-[3/4] w-full object-cover transition-transform duration-300 hover:scale-105" />
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-light-primary/20 dark:border-dark-primary/20 bg-white/40 dark:bg-gray-900/30 p-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-light-accent/15 dark:bg-dark-accent/15 text-light-accent dark:text-dark-accent">
        {icon}
      </div>
      <div>
        <div className="text-xl font-bold tabular-nums">{value.toLocaleString()}</div>
        <div className="text-xs text-light-text/55 dark:text-dark-text/55">{label}</div>
      </div>
    </div>
  )
}
