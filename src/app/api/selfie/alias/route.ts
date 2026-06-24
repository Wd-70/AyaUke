import { z } from 'zod'
import { NextResponse } from 'next/server'
import { withApi } from '@/shared/api/handler'
import { addAlias, removeAlias } from '@/domains/selfie/selfie.service'

const AddBody = z.object({ nickname: z.string().min(1).max(50) })
const RemoveQuery = z.object({ id: z.string().min(1) })

/** 내 별칭(과거/추가 닉네임) 등록 — 개인 기록 매칭용. */
export const POST = withApi({ schema: AddBody, auth: 'user' }, async ({ input, session }) => {
  await addAlias(session!.user.channelId, input.nickname)
  return NextResponse.json({ success: true })
})

export const DELETE = withApi({ schema: RemoveQuery, auth: 'user' }, async ({ input, session }) => {
  await removeAlias(session!.user.channelId, input.id)
  return NextResponse.json({ success: true })
})
