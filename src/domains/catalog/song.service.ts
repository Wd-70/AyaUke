import { Song } from '@/types';
import { assertSheetsApiKey, fetchRawSongsFromSheet } from './sheets.client';
import { fetchSongDetailsFromMongo } from './song.repository';
import { mergeSongsData } from './merge';

/** 전체 노래 카탈로그: 구글시트 + MongoDB 병합 결과 */
export async function getAllSongs(): Promise<Song[]> {
  assertSheetsApiKey();

  const sheetSongs = await fetchRawSongsFromSheet();
  const { songDetails, deletedSongKeys } = await fetchSongDetailsFromMongo();
  const mergedSongs = mergeSongsData(sheetSongs, songDetails, deletedSongKeys);

  console.log(`✅ 노래 데이터 병합: ${mergedSongs.length}곡`);
  return mergedSongs;
}
