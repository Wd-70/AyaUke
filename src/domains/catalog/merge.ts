import { Song, SongDetail } from '@/types';

/**
 * 구글시트 + MongoDB 곡 데이터 병합 (순수 함수 — DB/네트워크 없음).
 *
 * 병합 규칙:
 *  - 키: 제목+아티스트 (소문자화, 공백 제거)
 *  - 시트 곡 중 MongoDB에서 삭제 처리된 곡은 제외
 *  - 시트와 MongoDB 양쪽에 있으면 병합(title/artist는 시트 우선, 나머지는 MongoDB 우선)
 *  - MongoDB 전용 곡(관리자 추가)은 그대로 추가
 *  - 최종적으로 alias 기준 중복 제거
 */

/** 제목 정규화 (대소문자, 띄어쓰기 무시) */
export function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/\s+/g, '').trim();
}

/** 제목+아티스트 복합키 */
export function createSongKey(title: string, artist: string): string {
  return `${normalizeTitle(title)}|||${normalizeTitle(artist)}`;
}

export function mergeSongsData(
  sheetSongs: Song[],
  songDetails: SongDetail[],
  deletedSongKeys: Set<string>,
): Song[] {
  const detailsMap = new Map<string, SongDetail>();
  const usedMongoSongs = new Set<string>();

  songDetails.forEach((detail) => {
    detailsMap.set(createSongKey(detail.title, detail.artist), detail);
  });

  // 1. 구글시트 데이터에 MongoDB 데이터 병합 (삭제된 곡 제외)
  const mergedSheetSongs = sheetSongs
    .filter((song) => !deletedSongKeys.has(createSongKey(song.title, song.artist)))
    .map((song) => {
      const songKey = createSongKey(song.title, song.artist);
      const detail = detailsMap.get(songKey);

      if (!detail) {
        return { ...song, source: 'sheet' as const };
      }

      usedMongoSongs.add(songKey);

      return {
        id: detail._id, // MongoDB ObjectId를 메인 ID로 사용
        sheetId: song.id, // 구글시트 원본 ID는 별도 보관
        title: song.title, // 구글시트 우선
        artist: song.artist, // 구글시트 우선
        source: 'merged' as const,

        // MongoDB 데이터 우선 사용
        language: detail.language || song.language,
        lyrics: detail.lyrics || '',
        titleAlias: detail.titleAlias,
        artistAlias: detail.artistAlias,
        searchTags: detail.searchTags,
        sungCount: detail.sungCount,
        likeCount: detail.likeCount,
        lastSungDate: detail.lastSungDate,
        keyAdjustment: detail.keyAdjustment,
        mrLinks: detail.mrLinks,
        selectedMRIndex: detail.selectedMRIndex,
        personalNotes: detail.personalNotes,
        imageUrl: detail.imageUrl,
        dateAdded: detail.createdAt ? detail.createdAt.toISOString().split('T')[0] : song.dateAdded,
      };
    });

  // 2. MongoDB 전용 곡들 추가 (구글시트에 없는 곡들)
  const mongoOnlySongs: Song[] = [];
  songDetails.forEach((detail) => {
    const mongoSongKey = createSongKey(detail.title, detail.artist);
    if (usedMongoSongs.has(mongoSongKey)) return;

    mongoOnlySongs.push({
      id: detail._id,
      title: detail.title,
      artist: detail.artist,
      language: detail.language || '미설정',
      source: 'mongodb' as const,
      lyrics: detail.lyrics || '',
      titleAlias: detail.titleAlias,
      artistAlias: detail.artistAlias,
      searchTags: detail.searchTags,
      sungCount: detail.sungCount,
      likeCount: detail.likeCount,
      lastSungDate: detail.lastSungDate,
      keyAdjustment: detail.keyAdjustment,
      mrLinks: detail.mrLinks,
      selectedMRIndex: detail.selectedMRIndex,
      personalNotes: detail.personalNotes,
      imageUrl: detail.imageUrl,
      dateAdded: detail.createdAt
        ? detail.createdAt.toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
    });
  });

  // 3. alias 기준 중복 제거
  const seenSongKeys = new Set<string>();
  return [...mergedSheetSongs, ...mongoOnlySongs].filter((song) => {
    const songKey = createSongKey(song.titleAlias || song.title, song.artistAlias || song.artist);
    if (seenSongKeys.has(songKey)) return false;
    seenSongKeys.add(songKey);
    return true;
  });
}
