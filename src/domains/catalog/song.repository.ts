import { SongDetail } from '@/types';
import { connectDB } from '@/shared/db/mongodb';
import SongDetailModel from '@/domains/catalog/song.schema';
import { createSongKey } from './merge';

/** 카탈로그용 MongoDB 조회. 활성 곡 목록과 삭제된 곡 키 집합을 가져온다. */
export async function fetchSongDetailsFromMongo(): Promise<{
  songDetails: SongDetail[];
  deletedSongKeys: Set<string>;
}> {
  try {
    await connectDB();

    // 활성화된 곡들 조회 (기존 데이터는 status/sourceType 필드가 없을 수 있어 null 허용)
    const songDetails = await SongDetailModel.find({
      $and: [
        { $or: [{ status: { $ne: 'deleted' } }, { status: { $exists: false } }] },
        { $or: [{ sourceType: { $in: ['sheet', 'admin'] } }, { sourceType: { $exists: false } }] },
      ],
    })
      .sort({ updatedAt: -1 })
      .lean();

    const deletedSongs = await SongDetailModel.find(
      { status: 'deleted' },
      { title: 1, artist: 1, titleAlias: 1, artistAlias: 1 },
    ).lean();

    const deletedSongKeys = new Set<string>(
      deletedSongs.map((song) => createSongKey(song.title, song.artist)),
    );

    const processedSongDetails = songDetails.map((doc) => ({
      _id: doc._id.toString(),
      title: doc.title,
      artist: doc.artist,
      titleAlias: doc.titleAlias,
      artistAlias: doc.artistAlias,
      language: doc.language,
      lyrics: doc.lyrics,
      searchTags: doc.searchTags,
      sungCount: doc.sungCount,
      likeCount: doc.likeCount,
      lastSungDate: doc.lastSungDate,
      keyAdjustment: doc.keyAdjustment,
      mrLinks: doc.mrLinks,
      selectedMRIndex: doc.selectedMRIndex,
      personalNotes: doc.personalNotes,
      imageUrl: doc.imageUrl,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      // 새 필드들 (기존 데이터 호환 기본값)
      status: doc.status || 'active',
      sourceType: doc.sourceType || 'sheet',
      suggestedBy: doc.suggestedBy,
      deletedAt: doc.deletedAt,
      deletedBy: doc.deletedBy,
      deleteReason: doc.deleteReason,
      approvedAt: doc.approvedAt,
      approvedBy: doc.approvedBy,
    }));

    return { songDetails: processedSongDetails, deletedSongKeys };
  } catch (error) {
    console.error('❌ MongoDB 곡 조회 오류:', error);
    // MongoDB 장애 시에도 시트 데이터만으로 동작하도록 빈 결과 반환
    return { songDetails: [], deletedSongKeys: new Set() };
  }
}
