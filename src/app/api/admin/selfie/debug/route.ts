import { NextResponse } from 'next/server'
import { withApi } from '@/shared/api/handler'
import { AppError } from '@/shared/api/errors'
import { saveDebugDump, authorizeSelfieDev } from '@/domains/selfie/selfie.service'

/**
 * 개발용 덤프 수신 — 확장이 페이지 DOM/이미지 인벤토리를 보내면 로컬에 저장.
 * 로컬 전용 + (토큰 또는 관리자 세션). Claude가 저장 파일을 읽어 셀렉터/날짜를 확정한다.
 */
export const POST = withApi({}, async ({ req, session }) => {
  authorizeSelfieDev(req.headers.get('x-selfie-token'), session)

  const payload = await req.json().catch(() => null)
  if (!payload) throw new AppError('BAD_BODY', '본문이 비어 있습니다.', 400)

  const result = await saveDebugDump(payload)
  return NextResponse.json({ success: true, ...result })
})
