import { config } from '@/shared/config';
import { withApi, ok } from '@/shared/api/handler';
import { fetchChzzkChannelInfo } from '@/domains/archive/chzzk.client';

const AYAUKE_CHANNEL_ID = config.chzzkChannelId;

// 팔로워 수만 가볍게 — 거의 실시간으로 보여주기 위해 짧은 캐시 (공개).
export const revalidate = 30;

/** 치지직 팔로워 수 (가벼운 단건 조회). 실패해도 0으로 폴백. */
export const GET = withApi({}, async () => {
  const info = await fetchChzzkChannelInfo(AYAUKE_CHANNEL_ID);
  return ok({ followerCount: info.followerCount ?? 0 });
});
