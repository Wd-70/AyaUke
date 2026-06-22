import { withApi, ok } from '@/shared/api/handler';
import { fetchRawSongsFromSheet } from '@/domains/catalog/sheets.client';
import { fetchSongDetailsFromMongo } from '@/domains/catalog/song.repository';
import { mergeSongsData } from '@/domains/catalog/merge';

// 5분 캐시 — 랜딩 "노래책 미리보기"용 추천 곡 (공개).
export const revalidate = 300;

/** 많이 부른 순으로 추천 곡 일부만 가볍게 내려준다(랜딩 미리보기 카드용). */
export const GET = withApi({}, async () => {
  try {
    const [sheetSongs, mongo] = await Promise.all([
      fetchRawSongsFromSheet(),
      fetchSongDetailsFromMongo(),
    ]);
    const merged = mergeSongsData(sheetSongs, mongo.songDetails, mongo.deletedSongKeys);

    const featured = [...merged]
      .sort((a, b) => (b.sungCount ?? 0) - (a.sungCount ?? 0))
      .slice(0, 12)
      .map((s) => ({
        id: s.id,
        title: s.titleAlias || s.title,
        artist: s.artistAlias || s.artist,
        imageUrl: s.imageUrl ?? null,
        sungCount: s.sungCount ?? 0,
        language: s.language ?? null,
      }));

    return ok({ songs: featured });
  } catch {
    return ok({ songs: [] });
  }
});
