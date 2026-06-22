import { withApi, ok } from '@/shared/api/handler';
import { connectDB } from '@/shared/db/mongodb';
import { fetchRawSongsFromSheet } from '@/domains/catalog/sheets.client';
import { fetchChzzkChannelHistory, fetchChzzkChannelInfo } from '@/domains/archive/chzzk.client';
import SongVideo from '@/domains/archive/schemas/song-video.schema';
import ChzzkVideo from '@/domains/archive/schemas/chzzk-video.schema';
import YouTubeVideo from '@/domains/archive/schemas/youtube-video.schema';

const AYAUKE_CHANNEL_ID = 'abe8aa82baf3d3ef54ad8468ee73e7fc';
// 다시보기(VOD) 영구 미러 유튜브 채널
const ARCHIVE_YT_CHANNEL_ID = 'UCsFclToX4FEApNjAsodeGpg';

// 자주 안 바뀌므로 5분 캐시 — 랜딩 "아야의 발자취" 섹션용 (공개).
export const revalidate = 300;

/**
 * 다시보기 합계: 보유한 치지직 VOD 수 + (그보다 이전에 올라온 유튜브 아카이브 수).
 * 치지직은 오래된 다시보기를 만료시켜 DB엔 최근분만 남으므로, 유튜브가 그 이전 구간을
 * 메운다. 컷오프를 "보유한 가장 오래된 치지직 VOD"로 잡아 양쪽 중복을 제거한다.
 */
async function countReplays(): Promise<number> {
  const chzzkCount = await ChzzkVideo.countDocuments({ isDeleted: { $ne: true } }).catch(() => 0);

  const oldest = await ChzzkVideo.find({ isDeleted: { $ne: true } })
    .sort({ publishDate: 1 })
    .limit(1)
    .select('publishDate')
    .lean<{ publishDate: string }[]>()
    .catch(() => [] as { publishDate: string }[]);

  // 치지직 VOD가 없으면 컷오프가 없으니 유튜브 아카이브 전체를 다시보기로 본다.
  const cutoff = oldest[0]?.publishDate ? new Date(oldest[0].publishDate) : null;
  const ytFilter = cutoff
    ? { channelId: ARCHIVE_YT_CHANNEL_ID, publishedAt: { $lt: cutoff } }
    : { channelId: ARCHIVE_YT_CHANNEL_ID };
  const ytCount = await YouTubeVideo.countDocuments(ytFilter).catch(() => 0);

  return chzzkCount + ytCount;
}

/** 노래책 곡 수 · 라이브 클립 수 · 다시보기 수 · 누적 방송시간 (공개). 실패해도 0으로 폴백. */
export const GET = withApi({}, async () => {
  await connectDB();
  const [sheetSongs, clipCount, vodCount, history, info] = await Promise.all([
    fetchRawSongsFromSheet().catch(() => [] as unknown[]),
    SongVideo.countDocuments({ sourceUnavailable: { $ne: true } }).catch(() => 0),
    countReplays(),
    fetchChzzkChannelHistory(AYAUKE_CHANNEL_ID),
    fetchChzzkChannelInfo(AYAUKE_CHANNEL_ID),
  ]);
  return ok({
    songCount: Array.isArray(sheetSongs) ? sheetSongs.length : 0,
    clipCount,
    vodCount,
    totalLiveHours: history.totalLiveHours ?? 0,
    followerCount: info.followerCount ?? 0,
  });
});
