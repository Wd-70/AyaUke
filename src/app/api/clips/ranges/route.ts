import { z } from 'zod';
import { withApi, ok } from '@/shared/api/handler';
import { getRanges } from '@/domains/archive/clip-range.service';

export const dynamic = 'force-dynamic';
const Query = z.object({ ids: z.string().max(300).transform(s => s.split(','))
  .pipe(z.array(z.string().regex(/^[a-f\d]{24}$/i)).min(1).max(10)) });
export const GET = withApi({ schema: Query }, async ({ input, session }) => {
  const response = ok(await getRanges(input.ids, session?.user.userId));
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
});
