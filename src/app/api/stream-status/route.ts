import { withApi, ok } from '@/shared/api/handler';
import { fetchChzzkLiveStatus } from '@/domains/archive/chzzk.client';

/** 아야우케 치지직 채널 ID */
const AYAUKE_CHANNEL_ID = 'abe8aa82baf3d3ef54ad8468ee73e7fc';

// 치지직 상태는 자주 바뀌므로 짧게 캐시(과도한 외부 호출 방지). 30초.
export const revalidate = 30;

/**
 * 아야우케 실시간 라이브 상태 (공개). 랜딩 히어로의 LIVE 배지·시청자수·CTA용.
 * chzzk 호출 실패 시 오프라인으로 폴백한다(throw 안 함).
 */
export const GET = withApi({}, async () => {
  const status = await fetchChzzkLiveStatus(AYAUKE_CHANNEL_ID);
  return ok(status);
});
