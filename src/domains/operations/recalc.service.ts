import Like from '@/domains/engagement/like.schema';
import SongDetail from '@/domains/catalog/song.schema';
import SongVideo from '@/domains/archive/schemas/song-video.schema';

/**
 * 비정규화 카운트 재계산 잡.
 * likeCount/sungCount는 성능을 위해 비정규화되어 있고, 이 잡이 정합성 수단이다.
 */

export interface RecalcResult {
  processedCount: number;
  updatedCount: number;
  errorCount: number;
  message: string;
}

/** 모든 곡의 likeCount를 Like 컬렉션 실측치로 맞춘다. */
export async function recalculateLikeCounts(): Promise<RecalcResult> {
  const likeCounts = await Like.aggregate([{ $group: { _id: '$songId', count: { $sum: 1 } } }]);
  const likeCountsMap = new Map<string, number>(
    likeCounts.map((item) => [item._id.toString(), item.count]),
  );

  const allSongs = await SongDetail.find({}, { _id: 1, likeCount: 1 }).lean();

  let updatedCount = 0;
  let errorCount = 0;

  const batchSize = 100;
  for (let i = 0; i < allSongs.length; i += batchSize) {
    const updates = allSongs
      .slice(i, i + batchSize)
      .map((song) => {
        const actual = likeCountsMap.get(song._id.toString()) || 0;
        if (actual === (song.likeCount || 0)) return null;
        updatedCount++;
        return {
          updateOne: {
            filter: { _id: song._id },
            update: { $set: { likeCount: actual } },
          },
        };
      })
      .filter((u): u is NonNullable<typeof u> => u !== null);

    if (updates.length > 0) {
      try {
        await SongDetail.bulkWrite(updates);
      } catch (error) {
        console.error('likeCount 배치 업데이트 오류:', error);
        errorCount += updates.length;
        updatedCount -= updates.length;
      }
    }
  }

  return {
    processedCount: allSongs.length,
    updatedCount,
    errorCount,
    message: `좋아요 카운트 재계산 완료: ${allSongs.length}곡 처리, ${updatedCount}곡 업데이트`,
  };
}

/** 곡별 sungCount/lastSungDate를 라이브 클립(SongVideo) 실측치로 맞춘다. */
export async function recalculateSongStats(songId?: string): Promise<RecalcResult> {
  const songs = songId
    ? await SongDetail.find({ _id: songId, status: { $ne: 'deleted' } })
    : await SongDetail.find({ status: { $ne: 'deleted' } });

  let processedCount = 0;
  let errorCount = 0;

  for (const song of songs) {
    try {
      const videos = await SongVideo.find({ songId: song._id.toString() }).sort({ sungDate: -1 });

      await SongDetail.findByIdAndUpdate(song._id, {
        $set:
          videos.length > 0
            ? {
                sungCount: videos.length,
                lastSungDate: videos[0].sungDate.toISOString().split('T')[0],
              }
            : { sungCount: 0, lastSungDate: null },
      });

      processedCount++;
    } catch (error) {
      console.error(`곡 ${song.title} 통계 업데이트 오류:`, error);
      errorCount++;
    }
  }

  return {
    processedCount,
    updatedCount: processedCount - errorCount,
    errorCount,
    message: `곡 통계 재계산 완료: ${processedCount}곡 처리`,
  };
}
