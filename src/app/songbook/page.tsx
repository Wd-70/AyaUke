import { fetchSongsFromSheet, getErrorMessage } from '@/lib/googleSheets';
import SongbookClient from './SongbookClient';
import { Song } from '@/types';
import { unstable_cache } from 'next/cache';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "아야 AyaUke - 노래책",
  description: "아야가 부르는 노래들을 모아둔 특별한 공간입니다. J-pop부터 K-pop까지 다양한 장르의 노래를 확인해보세요.",
};

// 구글시트 데이터만 캐싱 (60초 - 정적 데이터)
const getCachedSheetSongs = unstable_cache(
  async () => {
    const { fetchRawSongsFromSheet } = await import('@/lib/googleSheets');
    return await fetchRawSongsFromSheet();
  },
  ['sheet-songs'],
  {
    revalidate: 60,
    tags: ['sheet-data']
  }
);

// MongoDB 데이터만 캐싱 (10초 - 동적 데이터)
const getCachedMongoSongs = unstable_cache(
  async () => {
    const { fetchSongDetailsFromMongo } = await import('@/lib/googleSheets');
    return await fetchSongDetailsFromMongo();
  },
  ['mongo-songs'],
  {
    revalidate: 10,
    tags: ['mongo-data']
  }
);

// 최종 머지된 데이터 캐싱 (10초 - MongoDB 업데이트 주기에 맞춤)
const getCachedMergedSongs = unstable_cache(
  async (): Promise<{ songs: Song[]; error: string | null }> => {
    try {
      const [sheetSongs, mongoDetails] = await Promise.all([
        getCachedSheetSongs(),
        getCachedMongoSongs()
      ]);
      
      const { mergeSongsData } = await import('@/lib/googleSheets');
      const mergedSongs = mergeSongsData(sheetSongs, mongoDetails);
      
      return { songs: mergedSongs, error: null };
    } catch (e) {
      const errorInfo = getErrorMessage(e as Error);
      return { songs: [], error: errorInfo.message };
    }
  },
  ['merged-songbook-data'],
  {
    revalidate: 10, // MongoDB 업데이트 주기에 맞춤
    tags: ['merged-songbook']
  }
);

export default async function SongbookPage() {
  const { songs, error } = await getCachedMergedSongs();
  return <SongbookClient songs={songs} error={error} />;
}

// 페이지 캐싱 설정: 10초마다 재검증 (MongoDB 업데이트 주기에 맞춤)
export const revalidate = 10;

