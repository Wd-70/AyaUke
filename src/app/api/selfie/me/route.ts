import { NextResponse } from 'next/server'
import { withApi } from '@/shared/api/handler'
import { getMyRecords } from '@/domains/selfie/selfie.service'

/** 로그인 사용자: 내 방종셀카 참석 기록(닉네임 매칭 + 별칭). */
export const GET = withApi({ auth: 'user' }, async ({ session }) => {
  const user = session!.user as { channelId: string; channelName?: string }
  const data = await getMyRecords(user.channelId, user.channelName)
  return NextResponse.json(data)
})
