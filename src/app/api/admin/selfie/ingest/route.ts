import { z } from 'zod'
import { NextResponse } from 'next/server'
import { withApi } from '@/shared/api/handler'
import { ingestPost, authorizeSelfieDev } from '@/domains/selfie/selfie.service'

const Body = z.object({
  source: z.enum(['x', 'cafe']),
  sourceUrl: z.string().url(),
  postedAt: z.string().optional(),
  images: z
    .array(
      z.object({
        imageUrl: z.string().url(),
        dataBase64: z.string().optional(),
        contentType: z.string().optional(),
        width: z.number().optional(),
        height: z.number().optional(),
      }),
    )
    .min(1),
})

/**
 * 방종셀카 수집 엔드포인트 — 크롬 확장이 호출. 로컬 전용 + (토큰 또는 관리자 세션).
 */
export const POST = withApi({ schema: Body }, async ({ input, session, req }) => {
  authorizeSelfieDev(req.headers.get('x-selfie-token'), session)
  const result = await ingestPost(input)
  return NextResponse.json({ success: true, ...result })
})
