import { fetchSongsFromSheet, getErrorMessage } from '@/lib/googleSheets';
import SongbookClient from './SongbookClient';
import { Song } from '@/types';
import { unstable_cache } from 'next/cache';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "아야 AyaUke - 노래책",
  description: "아야가 부르는 노래들을 모아둔 특별한 공간입니다. J-pop부터 K-pop까지 다양한 장르의 노래를 확인해보세요.",
};

// 캐시된 데이터 페칭 함수 (60초간 캐시)
const getCachedSongs = unstable_cache(
  async (): Promise<{ songs: Song[]; error: string | null }> => {
    try {
      const songs = await fetchSongsFromSheet();
      return { songs, error: null };
    } catch (e) {
      const errorInfo = getErrorMessage(e as Error);
      return { songs: [], error: errorInfo.message };
    }
  },
  ['songbook-data'],
  {
    revalidate: 60, // 60초마다 재검증
    tags: ['songbook']
  }
);

export default async function SongbookPage() {
  const { songs, error } = await getCachedSongs();
  return <SongbookClient songs={songs} error={error} />;
}

// 페이지 캐싱 설정: 60초마다 재검증
export const revalidate = 60;

