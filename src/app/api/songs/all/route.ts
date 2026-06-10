import { NextResponse } from 'next/server';
import { withApi } from '@/shared/api/handler';
import { getAllSongs } from '@/domains/catalog/song.service';

// NOTE: 성공 응답은 기존 소비자 호환을 위해 레거시 형태 유지
export const GET = withApi({}, async () => {
  const songs = await getAllSongs();

  return NextResponse.json({
    success: true,
    songs: songs.map((song) => ({
      id: song.id,
      title: song.title,
      artist: song.artist,
      titleAlias: song.titleAlias,
      artistAlias: song.artistAlias,
      tags: song.searchTags || [],
    })),
    count: songs.length,
  });
});
