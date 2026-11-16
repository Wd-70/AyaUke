import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { z } from 'zod';
import { authOptions } from '@/lib/authOptions';
import { hasPermission, Permission } from '@/lib/permissions';
import { batchMRMetadata } from '@/domains/catalog/mr-metadata.service';
const Input = z.object({ ids: z.array(z.string().regex(/^[\w-]{11}$/)).min(1).max(30) }).strict();
const json = (value: unknown, status = 200) => NextResponse.json(value, { status, headers: { 'Cache-Control': 'private, no-store' } });
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return json({ success: false }, 401);
    if (![Permission.SONGS_VIEW, Permission.SONGS_EDIT, Permission.SONGS_CREATE].some(permission => hasPermission(session.user, permission))) return json({ success: false }, 403);
    const input = Input.safeParse(await req.json().catch(() => null));
    if (!input.success) return json({ success: false }, 400);
    return json({ success: true, metadata: await batchMRMetadata(input.data.ids) });
  } catch { return json({ success: false, error: '영상 정보를 조회할 수 없습니다. 링크 편집은 계속할 수 있습니다.' }, 502); }
}
