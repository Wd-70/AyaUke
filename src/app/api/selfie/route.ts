import { NextResponse } from 'next/server'
import { withApi } from '@/shared/api/handler'
import { listSelfiesByDate, getSelfieStats } from '@/domains/selfie/selfie.service'

/** 공개: 방종셀카 갤러리(날짜별) + 누적 통계. */
export const GET = withApi({}, async () => {
  const [days, stats] = await Promise.all([listSelfiesByDate(), getSelfieStats()])
  return NextResponse.json({ days, stats })
})
