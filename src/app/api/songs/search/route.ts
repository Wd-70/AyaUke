import { z } from 'zod';
import { NextResponse } from 'next/server';
import { withApi } from '@/shared/api/handler';
import { getAllSongs } from '@/domains/catalog/song.service';

const Query = z.object({
  q: z.string().min(1, '검색어가 필요합니다.'),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

const normalizeText = (text: string) => text.toLowerCase().replace(/\s+/g, '');

// NOTE: 성공 응답은 기존 소비자 호환을 위해 레거시 형태 유지
export const GET = withApi({ schema: Query }, async ({ input }) => {
  const songs = await getAllSongs();
  const queryNormalized = normalizeText(input.q);

  const filteredSongs = songs.filter((song) => {
    const fields = [
      song.title,
      song.artist,
      song.titleAlias,
      song.artistAlias,
      `${song.artist} ${song.title}`,
    ];
    return fields.some((f) => f && normalizeText(f).includes(queryNormalized));
  });

  // 관련도 정렬: 정확한 제목 > 제목 시작 > 아티스트 시작
  const sortedSongs = filteredSongs.sort((a, b) => {
    const aTitle = normalizeText(a.title);
    const bTitle = normalizeText(b.title);
    const aArtist = normalizeText(a.artist);
    const bArtist = normalizeText(b.artist);

    if (aTitle === queryNormalized) return -1;
    if (bTitle === queryNormalized) return 1;
    if (aTitle.startsWith(queryNormalized) && !bTitle.startsWith(queryNormalized)) return -1;
    if (bTitle.startsWith(queryNormalized) && !aTitle.startsWith(queryNormalized)) return 1;
    if (aArtist.startsWith(queryNormalized) && !bArtist.startsWith(queryNormalized)) return -1;
    if (bArtist.startsWith(queryNormalized) && !aArtist.startsWith(queryNormalized)) return 1;
    return 0;
  });

  return NextResponse.json({
    success: true,
    songs: sortedSongs.slice(0, input.limit).map((song) => ({
      id: song.id,
      title: song.title,
      artist: song.artist,
      titleAlias: song.titleAlias,
      artistAlias: song.artistAlias,
    })),
  });
});
