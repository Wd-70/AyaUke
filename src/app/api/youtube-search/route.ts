import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { hasPermission, Permission } from '@/lib/permissions';
import { MRSearchInput } from '@/domains/catalog/mr-search';
import { MRSearchError, searchMRCandidates } from '@/domains/catalog/mr-search.service';

export const dynamic = 'force-dynamic';
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return json({ success: false, error: '로그인이 필요합니다.' }, 401);
    if (!hasPermission(session.user, Permission.SONGS_EDIT) && !hasPermission(session.user, Permission.SONGS_CREATE)) {
      return json({ success: false, error: '노래 편집 권한이 필요합니다.' }, 403);
    }
    const input = MRSearchInput.safeParse(await request.json().catch(() => null));
    if (!input.success) return json({ success: false, error: '곡 제목·가수·언어와 검색어를 확인해주세요.' }, 400);
    return json({ success: true, ...await searchMRCandidates(input.data) });
  } catch (error) {
    return json({ success: false, error: error instanceof MRSearchError ? error.message : 'MR 검색 중 오류가 발생했습니다.' }, error instanceof MRSearchError ? error.status : 500);
  }
}
