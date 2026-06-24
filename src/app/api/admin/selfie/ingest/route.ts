import { z } from 'zod'
import { NextResponse } from 'next/server'
import { withApi } from '@/shared/api/handler'
import { ForbiddenError, AppError } from '@/shared/api/errors'
import { canAccessAdminPanel, UserRole } from '@/lib/permissions'
import { ingestPost } from '@/domains/selfie/selfie.service'
import { isLocalEnvironment } from '@/domains/operations/local-backup.service'

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
 * 방종셀카 수집 엔드포인트 — 크롬 확장이 호출.
 * 로컬 환경(파일 아카이빙) 전용 + 관리자 한정.
 */
export const POST = withApi({ schema: Body, auth: 'user' }, async ({ input, session }) => {
  const role = (session!.user as { role?: string }).role as UserRole
  if (!canAccessAdminPanel(role)) throw new ForbiddenError('관리자만 수집할 수 있습니다.')
  if (!isLocalEnvironment()) throw new AppError('LOCAL_ONLY', '수집은 로컬 서버에서만 가능합니다.', 400)

  const result = await ingestPost(input)
  return NextResponse.json({ success: true, ...result })
})
