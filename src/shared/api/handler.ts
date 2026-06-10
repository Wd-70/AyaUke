import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import type { Session } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/authOptions';
import { hasPermission, Permission, UserRole } from '@/lib/permissions';
import { connectDB } from '@/shared/db/mongodb';
import { ok, fail } from './envelope';
import { mapError } from './errors';

export { ok, fail };

type AuthRequirement = 'none' | 'user' | Permission;

interface WithApiOptions<S extends z.ZodType | undefined> {
  /** body(POST/PUT/PATCH) 또는 searchParams(GET/DELETE) 검증 스키마 */
  schema?: S;
  /** 'none'(기본) | 'user'(로그인 필수) | Permission(해당 권한 필수) */
  auth?: AuthRequirement;
}

interface ApiContext<S extends z.ZodType | undefined> {
  input: S extends z.ZodType ? z.infer<S> : undefined;
  session: Session | null;
  req: NextRequest;
  params: Record<string, string>;
}

/**
 * 모든 API 라우트의 표준 래퍼.
 * 인증 → 권한 → 입력 검증 → DB 연결 → 핸들러 → 에러 매핑을 한 곳에서 처리한다.
 *
 * 사용 예:
 *   const Body = z.object({ songId: z.string().min(1) });
 *   export const POST = withApi({ schema: Body, auth: 'user' }, async ({ input, session }) => {
 *     return ok(await likeService.toggle(session!.user.userId, input.songId));
 *   });
 */
export function withApi<S extends z.ZodType | undefined = undefined>(
  options: WithApiOptions<S>,
  handler: (ctx: ApiContext<S>) => Promise<NextResponse>,
) {
  return async (
    req: NextRequest,
    route: { params: Promise<Record<string, string>> },
  ): Promise<NextResponse> => {
    try {
      const session = await getServerSession(authOptions);

      const auth = options.auth ?? 'none';
      if (auth !== 'none' && !session?.user) {
        return fail('UNAUTHORIZED', '로그인이 필요합니다.', 401);
      }
      if (auth !== 'none' && auth !== 'user') {
        const role = (session!.user as { role?: string }).role as UserRole | undefined;
        if (!role || !hasPermission(role, auth)) {
          return fail('FORBIDDEN', '권한이 없습니다.', 403);
        }
      }

      let input: unknown;
      if (options.schema) {
        const raw =
          req.method === 'GET' || req.method === 'DELETE'
            ? Object.fromEntries(req.nextUrl.searchParams)
            : await req.json().catch(() => undefined);
        const parsed = options.schema.safeParse(raw);
        if (!parsed.success) {
          const issue = parsed.error.issues[0];
          const where = issue.path.length ? `${issue.path.join('.')}: ` : '';
          return fail('VALIDATION', `${where}${issue.message}`, 400);
        }
        input = parsed.data;
      }

      await connectDB();

      const params = route?.params ? await route.params : {};
      return await handler({ input, session, req, params } as ApiContext<S>);
    } catch (error) {
      const { code, message, status } = mapError(error);
      return fail(code, message, status);
    }
  };
}
