import SongbookClient from './SongbookClient';
import { Song } from '@/types';
import { unstable_cache } from 'next/cache';
import { Metadata } from 'next';
import { fetchRawSongsFromSheet, getErrorMessage } from '@/domains/catalog/sheets.client';
import { fetchSongDetailsFromMongo } from '@/domains/catalog/song.repository';
import { mergeSongsData } from '@/domains/catalog/merge';

export const metadata: Metadata = {
  title: "아야 AyaUke - 노래책",
  description: "아야가 부르는 노래들을 모아둔 특별한 공간입니다. J-pop부터 K-pop까지 다양한 장르의 노래를 확인해보세요.",
};

// 구글시트만 60초 캐싱
const getCachedSheetSongs = unstable_cache(
  async () => {
    const result = await fetchRawSongsFromSheet();
    console.log(`📊 구글시트 캐시 갱신: ${result.length}곡`);
    return result;
  },
  ['sheet-only-v1'],
  {
    revalidate: 60, // 구글시트는 60초 캐싱
    tags: ['sheet-data']
  }
);

// MongoDB는 실시간, 캐싱 없음
async function getSongs(): Promise<{ songs: Song[]; error: string | null }> {
  try {
    console.log('🚀 노래책 데이터 로딩 중...');
    
    // 1. 구글시트 (60초 캐시 사용)
    const sheetSongs = await getCachedSheetSongs();
    
    // 2. MongoDB (실시간 조회)
    const { songDetails: mongoDetails, deletedSongKeys } = await fetchSongDetailsFromMongo();
    console.log(`🗄️ MongoDB 조회: ${mongoDetails.length}곡`);
    
    // 3. 데이터 병합
    const mergedSongs = mergeSongsData(sheetSongs, mongoDetails, deletedSongKeys);
    console.log(`✅ 병합 완료: ${mergedSongs.length}곡`);
    
    return { songs: mergedSongs, error: null };
  } catch (e) {
    const errorInfo = getErrorMessage(e as Error);
    return { songs: [], error: errorInfo.message };
  }
}

export default async function SongbookPage() {
  const { songs, error } = await getSongs();
  return <SongbookClient songs={songs} error={error} />;
}

// 페이지 캐싱 비활성화 (MongoDB 실시간 조회)
export const revalidate = 0;

