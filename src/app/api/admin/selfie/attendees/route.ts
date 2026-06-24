import { z } from 'zod'
import { NextResponse } from 'next/server'
import { withApi } from '@/shared/api/handler'
import { ForbiddenError } from '@/shared/api/errors'
import { canAccessAdminPanel, UserRole } from '@/lib/permissions'
import { setAttendees } from '@/domains/selfie/selfie.service'

const Body = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식이 필요합니다.'),
  names: z.array(z.string()),
  note: z.string().optional(),
})

/** 날짜별 참석자 명단 저장(분석 결과 반영) — 관리자 한정. */
export const PUT = withApi({ schema: Body, auth: 'user' }, async ({ input, session }) => {
  const role = (session!.user as { role?: string }).role as UserRole
  if (!canAccessAdminPanel(role)) throw new ForbiddenError('관리자만 기록할 수 있습니다.')
  const result = await setAttendees(input.date, input.names, input.note)
  return NextResponse.json({ success: true, ...result })
})
