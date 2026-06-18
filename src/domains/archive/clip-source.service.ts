import mongoose from 'mongoose';
import SongVideo from './schemas/song-video.schema';
import { fetchVideoStreamInfo } from './chzzk.client';
import { recalculateSongStats } from '@/domains/operations/recalc.service';
import { AppError } from '@/shared/api/errors';
import type { SourceTarget, SourceCheckRow } from '@/app/admin/tabs/live-clips/clip-types';

/** 영향받은 곡들의 sungCount/lastSungDate를 숨김 제외 기준으로 재계산 */
async function recomputeAffectedSongs(songIds: string[]) {
  await Promise.all([...new Set(songIds)].map((id) => recalculateSongStats(id).catch(() => undefined)));
}

/**
 * 클립 원본 영상 가용성 점검 (치지직 다시보기 만료/삭제, 유튜브 비공개/삭제).
 * 점검(읽기)과 적용(소프트 숨김)을 분리해, 관리 다이얼로그가 점검→현황확인→선택처리
 * 흐름을 제어할 수 있게 한다. 일시적 네트워크 오류로 멀쩡한 클립을 숨기지 않도록
 * "확정적 불가(dead)"만 처리 대상으로 본다.
 */

export type { SourceTarget, SourceCheckRow };
export type CheckPlatform = 'chzzk' | 'youtube' | 'all';

/** 점검 대상 목록 (영상 단위 + 클립 수). platform으로 한정 가능 */
export async function listCheckTargets(platform: CheckPlatform): Promise<SourceTarget[]> {
  const groups = await SongVideo.aggregate<{ _id: { platform: string | null; videoId: string }; n: number }>([
    // 이미 숨김(재생불가) 처리된 클립은 재점검 대상에서 제외 — 다시 걸리지 않도록
    { $match: { sourceUnavailable: { $ne: true } } },
    { $group: { _id: { platform: { $ifNull: ['$platform', 'youtube'] }, videoId: '$videoId' }, n: { $sum: 1 } } },
  ]);
  return groups
    .map((g) => ({ platform: (g._id.platform || 'youtube') as 'youtube' | 'chzzk', videoId: g._id.videoId, clips: g.n }))
    .filter((t) => platform === 'all' || t.platform === platform)
    .sort((a, b) => b.clips - a.clips);
}

/** 치지직 다시보기 가용성: NotFoundError(만료/삭제)면 dead, 네트워크 오류면 unknown */
async function checkChzzk(videoId: string): Promise<{ status: SourceCheckRow['status']; reason: string; title?: string }> {
  try {
    const info = await fetchVideoStreamInfo(Number(videoId));
    return { status: 'available', reason: '', title: info.videoTitle };
  } catch (e) {
    if (e instanceof AppError && e.code === 'NOT_FOUND') return { status: 'dead', reason: e.message };
    return { status: 'unknown', reason: e instanceof Error ? e.message : '확인 실패' };
  }
}

/** 유튜브 영상 가용성: oEmbed 404/401(삭제/비공개)이면 dead */
async function checkYouTube(videoId: string): Promise<{ status: SourceCheckRow['status']; reason: string; title?: string }> {
  try {
    const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (res.ok) {
      const data = await res.json().catch(() => null);
      return { status: 'available', reason: '', title: data?.title };
    }
    if (res.status === 404) return { status: 'dead', reason: '유튜브에서 삭제된 영상' };
    if (res.status === 401) return { status: 'dead', reason: '비공개 영상' };
    return { status: 'unknown', reason: `HTTP ${res.status}` };
  } catch (e) {
    return { status: 'unknown', reason: e instanceof Error ? e.message : '확인 실패' };
  }
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/** 대상 한 배치(클라이언트 청크)를 점검. DB는 건드리지 않음 */
export async function checkSourceBatch(targets: SourceTarget[]): Promise<SourceCheckRow[]> {
  return mapLimit(targets, 6, async (t) => {
    const r = t.platform === 'chzzk' ? await checkChzzk(t.videoId) : await checkYouTube(t.videoId);
    return { ...t, ...r };
  });
}

/** 선택한 영상들의 클립을 숨김(또는 복구) 처리 */
export async function applySourceStatus(
  videos: Array<{ platform: 'youtube' | 'chzzk'; videoId: string }>,
  unavailable: boolean,
): Promise<number> {
  if (videos.length === 0) return 0;
  const now = new Date();
  const ops = videos.map((v) => ({
    updateMany: {
      filter: { videoId: v.videoId, platform: v.platform === 'youtube' ? { $in: ['youtube', null] } : 'chzzk' },
      update: { $set: { sourceUnavailable: unavailable, sourceCheckedAt: now } },
    },
  }));
  // 영향 곡(통계 재계산 대상)의 songId 수집
  const affected = await SongVideo.distinct('songId', {
    $or: videos.map((v) => ({ videoId: v.videoId, platform: v.platform === 'youtube' ? { $in: ['youtube', null] } : 'chzzk' })),
  });

  // 네이티브 컬렉션 쓰기로 mongoose strict 스트립 우회 (스키마 핫리로드 캐시 이슈 회피)
  let modified = 0;
  for (let k = 0; k < ops.length; k += 500) {
    const r = await SongVideo.collection.bulkWrite(ops.slice(k, k + 500), { ordered: false });
    modified += r.modifiedCount || 0;
  }
  // 숨김/복구로 sungCount·lastSungDate가 달라지므로 영향 곡 재계산
  await recomputeAffectedSongs(affected.map(String));
  return modified;
}

/** 특정 클립의 숨김 해제 (목록 배지에서 개별 복구) */
export async function restoreClipSource(clipId: string): Promise<void> {
  const clip = await SongVideo.findById(clipId).select('songId').lean() as { songId?: string } | null;
  await SongVideo.collection.updateOne(
    { _id: new mongoose.Types.ObjectId(clipId) },
    { $set: { sourceUnavailable: false, sourceCheckedAt: new Date() } },
  );
  if (clip?.songId) await recomputeAffectedSongs([String(clip.songId)]);
}
