import { z } from 'zod'
import { NextResponse } from 'next/server'
import { withApi } from '@/shared/api/handler'
import { AppError } from '@/shared/api/errors'
import { authorizeSelfieDev } from '@/domains/selfie/selfie.service'
import { putResult, getResult } from '@/domains/selfie/agent-queue'

const Body = z.object({
  id: z.string().min(1),
  ok: z.boolean(),
  data: z.any().optional(),
})

/** 확장이 명령 실행 결과를 보고한다. 로컬 전용 + 토큰. */
export const POST = withApi({ schema: Body }, async ({ input, session, req }) => {
  authorizeSelfieDev(req.headers.get('x-selfie-token'), session)
  putResult(input.id, input.ok, input.data)
  return NextResponse.json({ success: true })
})

/** Claude가 명령 결과를 읽는다(?id=). 로컬 전용 + 토큰. */
export const GET = withApi({}, async ({ session, req }) => {
  authorizeSelfieDev(req.headers.get('x-selfie-token'), session)
  const id = new URL(req.url).searchParams.get('id')
  if (!id) throw new AppError('BAD_QUERY', 'id 쿼리가 필요합니다.', 400)
  return NextResponse.json({ success: true, result: getResult(id) })
})
