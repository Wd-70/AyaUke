import { NextRequest, NextResponse } from 'next/server';
import { fetchRawSongsFromSheet, fetchSongDetailsFromMongo, mergeSongsData } from '@/lib/googleSheets';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Songs search API called with:', request.url);
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || '10');
    
    if (!query) {
      return NextResponse.json({ error: 'Query parameter required' }, { status: 400 });
    }

    // 기존 songbook 페이지와 동일한 방식으로 데이터 가져오기
    const rawSongs = await fetchRawSongsFromSheet();
    const songDetails = await fetchSongDetailsFromMongo();
    const songs = mergeSongsData(rawSongs, songDetails);
    
    // 검색 로직 (대소문자 무시, 공백 제거 후 매칭)
    const normalizeText = (text: string) => 
      text.toLowerCase().replace(/\s+/g, '');
    
    const queryNormalized = normalizeText(query);
    
    const filteredSongs = songs.filter(song => {
      const titleMatch = normalizeText(song.title).includes(queryNormalized);
      const artistMatch = normalizeText(song.artist).includes(queryNormalized);
      const titleAliasMatch = song.titleAlias && normalizeText(song.titleAlias).includes(queryNormalized);
      const artistAliasMatch = song.artistAlias && normalizeText(song.artistAlias).includes(queryNormalized);
      
      // 전체 검색어로도 매칭 시도
      const fullText = normalizeText(`${song.artist} ${song.title}`);
      const fullTextMatch = fullText.includes(queryNormalized);
      
      return titleMatch || artistMatch || titleAliasMatch || artistAliasMatch || fullTextMatch;
    });
    
    // 관련도에 따른 정렬
    const sortedSongs = filteredSongs.sort((a, b) => {
      const aTitle = normalizeText(a.title);
      const bTitle = normalizeText(b.title);
      const aArtist = normalizeText(a.artist);
      const bArtist = normalizeText(b.artist);
      
      // 정확한 제목 매칭이 우선
      if (aTitle === queryNormalized) return -1;
      if (bTitle === queryNormalized) return 1;
      
      // 제목이 검색어로 시작하는 경우가 우선
      if (aTitle.startsWith(queryNormalized) && !bTitle.startsWith(queryNormalized)) return -1;
      if (bTitle.startsWith(queryNormalized) && !aTitle.startsWith(queryNormalized)) return 1;
      
      // 아티스트가 검색어로 시작하는 경우
      if (aArtist.startsWith(queryNormalized) && !bArtist.startsWith(queryNormalized)) return -1;
      if (bArtist.startsWith(queryNormalized) && !aArtist.startsWith(queryNormalized)) return 1;
      
      return 0;
    });
    
    return NextResponse.json({ 
      success: true, 
      songs: sortedSongs.slice(0, limit).map(song => ({
        id: song.id,
        title: song.title,
        artist: song.artist,
        titleAlias: song.titleAlias,
        artistAlias: song.artistAlias
      }))
    });
    
  } catch (error) {
    console.error('Songs search error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}