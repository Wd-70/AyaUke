import { NextResponse } from 'next/server'
import { withApi } from '@/shared/api/handler'
import { ForbiddenError, AppError } from '@/shared/api/errors'
import { canAccessAdminPanel, UserRole } from '@/lib/permissions'
import { saveDebugDump } from '@/domains/selfie/selfie.service'
import { isLocalEnvironment } from '@/domains/operations/local-backup.service'

/**
 * 개발용 덤프 수신 — 확장이 페이지 DOM/이미지 인벤토리를 보내면 로컬에 저장.
 * (관리자 + 로컬 전용) Claude가 저장 파일을 읽어 카페 셀렉터/날짜를 확정한다.
 */
export const POST = withApi({ auth: 'user' }, async ({ req, session }) => {
  const role = (session!.user as { role?: string }).role as UserRole
  if (!canAccessAdminPanel(role)) throw new ForbiddenError('관리자만 사용할 수 있습니다.')
  if (!isLocalEnvironment()) throw new AppError('LOCAL_ONLY', '덤프 저장은 로컬 서버에서만 가능합니다.', 400)

  const payload = await req.json().catch(() => null)
  if (!payload) throw new AppError('BAD_BODY', '본문이 비어 있습니다.', 400)

  const result = await saveDebugDump(payload)
  return NextResponse.json({ success: true, ...result })
})
