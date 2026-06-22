import { withApi, ok, fail } from '@/shared/api/handler';
import { getPublicClip } from '@/domains/archive/clip.service';

// 공개 클립 단건 (안전 투영 DTO). 공유 페이지/임베드/oEmbed에서 사용.
export const revalidate = 60;

export const GET = withApi({}, async ({ params }) => {
  const clip = await getPublicClip(params.id);
  if (!clip) return fail('NOT_FOUND', '클립을 찾을 수 없습니다.', 404);
  return ok({ clip });
});
