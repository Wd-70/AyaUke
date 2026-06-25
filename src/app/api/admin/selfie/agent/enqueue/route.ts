import { z } from 'zod'
import { NextResponse } from 'next/server'
import { withApi } from '@/shared/api/handler'
import { authorizeSelfieDev } from '@/domains/selfie/selfie.service'
import { enqueueCommand } from '@/domains/selfie/agent-queue'

const Body = z.object({
  type: z.enum(['ping', 'scan', 'ingest', 'dump', 'openCollect', 'scanList', 'peek', 'scanXMedia']),
  payload: z.any().optional(),
})

/** Claude(또는 도구)가 확장에게 보낼 명령을 큐에 넣는다. 로컬 전용 + 토큰. */
export const POST = withApi({ schema: Body }, async ({ input, session, req }) => {
  authorizeSelfieDev(req.headers.get('x-selfie-token'), session)
  const command = enqueueCommand(input.type, input.payload)
  return NextResponse.json({ success: true, command })
})
