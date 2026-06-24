import { NextResponse } from 'next/server'
import { withApi } from '@/shared/api/handler'
import { authorizeSelfieDev } from '@/domains/selfie/selfie.service'
import { waitForCommand } from '@/domains/selfie/agent-queue'

/**
 * 확장이 long-poll로 다음 명령을 가져간다. 최대 20초 대기 후 명령 없으면 command:null.
 * 로컬 전용 + 토큰.
 */
export const GET = withApi({}, async ({ session, req }) => {
  authorizeSelfieDev(req.headers.get('x-selfie-token'), session)
  const command = await waitForCommand(20000)
  return NextResponse.json({ success: true, command })
})
