import { NextRequest, NextResponse } from 'next/server';
import { fetchRawSongsFromSheet, fetchSongDetailsFromMongo, mergeSongsData } from '@/lib/googleSheets';

export async function GET(request: NextRequest) {
  try {
    console.log('🎵 전체 곡 목록 조회 중...');
    
    // 기존 songbook 페이지와 동일한 방식으로 데이터 가져오기
    const rawSongs = await fetchRawSongsFromSheet();
    const songDetails = await fetchSongDetailsFromMongo();
    const songs = mergeSongsData(rawSongs, songDetails);
    
    console.log(`📊 전체 곡 수: ${songs.length}곡`);
    
    return NextResponse.json({ 
      success: true, 
      songs: songs.map(song => ({
        id: song.id,
        title: song.title,
        artist: song.artist,
        titleAlias: song.titleAlias,
        artistAlias: song.artistAlias,
        titleAliasKor: song.titleAliasKor,
        artistAliasKor: song.artistAliasKor,
        titleAliasEng: song.titleAliasEng,
        artistAliasEng: song.artistAliasEng,
        tags: song.tags || []
      })),
      count: songs.length
    });
    
  } catch (error) {
    console.error('전체 곡 목록 조회 오류:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}