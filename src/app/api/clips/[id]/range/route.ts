import { z } from 'zod';
import { withApi, ok } from '@/shared/api/handler';
import { AppError, ForbiddenError, NotFoundError } from '@/shared/api/errors';
import { canManageSongs, type UserRole } from '@/lib/permissions';
import * as ranges from '@/domains/archive/clip-range.service';

export const dynamic = 'force-dynamic';
const Time = z.number().finite().min(0).max(Number.MAX_SAFE_INTEGER / 1000);
const Version = z.number().int().nonnegative();
const Range = { startTime: Time, endTime: Time.nullable() };
const Id = z.string().regex(/^[a-f\d]{24}$/i);
const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('personal'), sourceVersion: Version, range: z.object(Range).nullable(), pin: z.boolean().default(false) }),
  z.object({ action: z.literal('propose'), sourceVersion: Version, baseVersion: Version, range: z.object(Range) }),
  z.object({ action: z.literal('vote'), proposalId: Id, start: z.union([z.literal(-1), z.literal(0), z.literal(1)]), end: z.union([z.literal(-1), z.literal(0), z.literal(1)]) }),
  z.object({ action: z.literal('withdraw'), proposalId: Id }),
  z.object({ action: z.literal('publish'), sourceVersion: Version, baseVersion: Version, range: z.object(Range), proposalId: Id.optional() }),
]);

// Best-effort burst protection; durable unique indexes and proposal quotas also apply.
const bursts = new Map<string, { count: number; until: number }>();
function throttle(user: string) {
  const now = Date.now();
  for (const [key, value] of bursts) if (value.until < now) bursts.delete(key);
  const entry = bursts.get(user) ?? { count: 0, until: now + 60_000 };
  if (entry.count >= 30) throw new AppError('RATE_LIMIT', '잠시 후 다시 시도해주세요.', 429);
  if (bursts.size >= 10_000 && !bursts.has(user)) throw new AppError('RATE_LIMIT', '잠시 후 다시 시도해주세요.', 429);
  entry.count++; bursts.set(user, entry);
}

export const GET = withApi({}, async ({ params, session }) => {
  const [data] = await ranges.getRanges([params.id], session?.user.userId, true);
  if (!data) throw new NotFoundError();
  const response = ok(data);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
});

export const POST = withApi({ schema: Body, auth: 'user' }, async ({ input, params, session }) => {
  const userId = session!.user.userId;
  if (!userId) throw new ForbiddenError('다시 로그인해주세요.');
  throttle(userId);
  const id = params.id;
  let result: unknown;
  switch (input.action) {
    case 'personal': await ranges.savePersonal(id, userId, input.sourceVersion, input.range, input.pin); break;
    case 'propose': result = { proposalId: await ranges.propose(id, userId, input.sourceVersion, input.baseVersion, input.range) }; break;
    case 'vote': await ranges.evaluate(id, userId, input.proposalId, input.start, input.end); break;
    case 'withdraw': await ranges.withdraw(id, userId, input.proposalId); break;
    case 'publish':
      if (!canManageSongs(session!.user.role as UserRole)) throw new ForbiddenError();
      result = { clip: await ranges.publishOfficial(id, userId, input.sourceVersion, input.baseVersion, input.range, input.proposalId) };
      break;
  }
  const [data] = await ranges.getRanges([id], userId, true);
  const response = ok({ range: data, ...(result as object ?? {}) });
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
});
