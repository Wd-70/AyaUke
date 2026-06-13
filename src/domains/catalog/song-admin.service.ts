import SongDetail from './song.schema';
import { fetchSongDetailsFromMongo } from './song.repository';
import { ValidationError, NotFoundError, ConflictError } from '@/shared/api/errors';

/** 관리자 노래 관리 유스케이스 모음. HTTP를 모르는 순수 서비스 계층. */

export type AdminSongStatus = 'complete' | 'missing-mr' | 'missing-lyrics' | 'incomplete';

function deriveStatus(hasMR: boolean, hasLyrics: boolean): AdminSongStatus {
  if (!hasMR && !hasLyrics) return 'incomplete';
  if (!hasMR) return 'missing-mr';
  if (!hasLyrics) return 'missing-lyrics';
  return 'complete';
}

/** 관리 화면용 곡 목록 + 완성도/언어 통계 */
export async function listSongsForAdmin() {
  const { songDetails } = await fetchSongDetailsFromMongo();

  const songs = songDetails.map((detail) => {
    const mrLinks = detail.mrLinks || [];
    const lyrics = detail.lyrics || '';
    const hasMR = mrLinks.length > 0;
    const hasLyrics = lyrics.trim().length > 0;

    return {
      id: String(detail._id),
      title: detail.titleAlias || detail.title,
      artist: detail.artistAlias || detail.artist,
      originalTitle: detail.title,
      originalArtist: detail.artist,
      language: detail.language || 'Unknown',
      tags: detail.searchTags || [],
      mrLinks,
      hasLyrics,
      lyrics,
      sungCount: detail.sungCount || 0,
      likedCount: detail.likeCount || 0,
      addedDate: detail.createdAt || new Date(),
      status: deriveStatus(hasMR, hasLyrics),
      keyAdjustment: detail.keyAdjustment,
      selectedMRIndex: detail.selectedMRIndex || 0,
      personalNotes: detail.personalNotes || '',
      imageUrl: detail.imageUrl || '',
      source: 'mongodb' as const,
    };
  });

  const countByStatus = (s: AdminSongStatus) => songs.filter((song) => song.status === s).length;
  const countByLanguage = (lang: string) => songs.filter((song) => song.language === lang).length;

  const stats = {
    total: songs.length,
    complete: countByStatus('complete'),
    missingMR: countByStatus('missing-mr') + countByStatus('incomplete'),
    missingLyrics: countByStatus('missing-lyrics') + countByStatus('incomplete'),
    incomplete: countByStatus('incomplete'),
    languages: {
      Korean: countByLanguage('Korean'),
      English: countByLanguage('English'),
      Japanese: countByLanguage('Japanese'),
      Chinese: countByLanguage('Chinese'),
      Other: songs.filter((s) => !['Korean', 'English', 'Japanese', 'Chinese'].includes(s.language)).length,
    },
  };

  return { songs, stats };
}

export interface NewSongInput {
  title: string;
  artist: string;
  language: string;
  lyrics?: string;
  mrLinks?: string[];
  tags?: string[];
}

export async function addSong(songData: NewSongInput) {
  const existing = await SongDetail.findOne({ title: songData.title, artist: songData.artist });
  if (existing) throw new ConflictError('같은 제목과 아티스트의 곡이 이미 존재합니다.');

  const song = await new SongDetail({
    title: songData.title,
    artist: songData.artist,
    language: songData.language,
    lyrics: songData.lyrics || '',
    mrLinks: songData.mrLinks?.map((url) => ({ url })) || [],
    searchTags: songData.tags || [],
    personalNotes: '',
    sungCount: 0,
    status: 'active',
    sourceType: 'admin',
  }).save();

  return song;
}

export interface BulkEditInput {
  artist?: string;
  keyAdjustment?: number;
  language?: string;
}

/** 키 조절 특수값: 999는 "키 조절 해제"를 의미한다 (UI 약속) */
const KEY_ADJUSTMENT_CLEAR = 999;

const resolveKeyAdjustment = (value: number) =>
  value === KEY_ADJUSTMENT_CLEAR ? null : value;

export async function bulkEdit(songIds: string[], editData: BulkEditInput): Promise<number> {
  if (!songIds?.length) throw new ValidationError('편집할 곡을 선택해주세요.');
  if (!editData || Object.keys(editData).length === 0) {
    throw new ValidationError('변경할 정보를 입력해주세요.');
  }

  // 아티스트 변경은 곡별 alias 판정이 필요해 개별 처리
  if (editData.artist) {
    const songs = await SongDetail.find({ _id: { $in: songIds }, status: { $ne: 'deleted' } });

    let modifiedCount = 0;
    for (const song of songs) {
      const updateFields: Record<string, unknown> = {
        updatedAt: new Date(),
        // 원본과 같으면 alias 제거, 다르면 alias로 설정
        artistAlias: editData.artist === song.artist ? null : editData.artist,
      };
      if (editData.keyAdjustment !== undefined) {
        updateFields.keyAdjustment = resolveKeyAdjustment(editData.keyAdjustment);
      }
      if (editData.language) updateFields.language = editData.language;

      const result = await SongDetail.updateOne({ _id: song._id }, { $set: updateFields });
      if (result.modifiedCount > 0) modifiedCount++;
    }
    return modifiedCount;
  }

  const updateFields: Record<string, unknown> = { updatedAt: new Date() };
  if (editData.keyAdjustment !== undefined) {
    updateFields.keyAdjustment = resolveKeyAdjustment(editData.keyAdjustment);
  }
  if (editData.language) updateFields.language = editData.language;

  const result = await SongDetail.updateMany(
    { _id: { $in: songIds }, status: { $ne: 'deleted' } },
    { $set: updateFields },
  );
  return result.modifiedCount;
}

export interface EditSongInput {
  title?: string;
  artist?: string;
  language?: string;
  keyAdjustment?: number | null;
  lyrics?: string;
  mrLinks?: unknown[];
  tags?: string[];
  selectedMRIndex?: number;
  imageUrl?: string;
}

export async function editSong(songId: string, editData: EditSongInput): Promise<number> {
  if (!songId) throw new ValidationError('편집할 곡을 선택해주세요.');
  if (!editData || Object.keys(editData).length === 0) {
    throw new ValidationError('변경할 정보를 입력해주세요.');
  }

  const song = await SongDetail.findOne({ _id: songId, status: { $ne: 'deleted' } });
  if (!song) throw new NotFoundError('곡을 찾을 수 없습니다.');

  const updateFields: Record<string, unknown> = { updatedAt: new Date() };

  if (editData.title) updateFields.title = editData.title;
  if (editData.artist !== undefined) {
    updateFields.artistAlias = editData.artist === song.artist ? null : editData.artist;
  }
  if (editData.language) updateFields.language = editData.language;
  if (editData.keyAdjustment !== undefined) updateFields.keyAdjustment = editData.keyAdjustment;
  if (editData.lyrics !== undefined) updateFields.lyrics = editData.lyrics;
  if (editData.mrLinks !== undefined) updateFields.mrLinks = editData.mrLinks;
  if (editData.selectedMRIndex !== undefined) updateFields.selectedMRIndex = editData.selectedMRIndex;
  if (editData.tags !== undefined) updateFields.searchTags = editData.tags;
  if (editData.imageUrl !== undefined) updateFields.imageUrl = editData.imageUrl.trim();

  const result = await SongDetail.updateOne({ _id: songId }, { $set: updateFields });
  return result.modifiedCount;
}

export async function addTags(songIds: string[], tags: string[]): Promise<number> {
  if (!songIds?.length) throw new ValidationError('태그를 추가할 곡을 선택해주세요.');
  if (!tags?.length) throw new ValidationError('추가할 태그를 입력해주세요.');

  const result = await SongDetail.updateMany(
    { _id: { $in: songIds }, status: { $ne: 'deleted' } },
    {
      $addToSet: { searchTags: { $each: tags } },
      $set: { updatedAt: new Date() },
    },
  );
  return result.modifiedCount;
}

/** 소프트 삭제: status='deleted' + 감사 필드 기록 */
export async function softDeleteSongs(
  songIds: string[],
  deletedBy: string,
  reason?: string,
): Promise<number> {
  if (!songIds?.length) throw new ValidationError('삭제할 곡을 선택해주세요.');

  const existing = await SongDetail.find({ _id: { $in: songIds }, status: { $ne: 'deleted' } });
  if (existing.length === 0) throw new ValidationError('삭제할 수 있는 곡이 없습니다.');

  const result = await SongDetail.updateMany(
    { _id: { $in: songIds }, status: { $ne: 'deleted' } },
    {
      $set: {
        status: 'deleted',
        deletedAt: new Date(),
        deletedBy,
        deleteReason: reason || '관리자에 의한 삭제',
      },
    },
  );
  return result.modifiedCount;
}
