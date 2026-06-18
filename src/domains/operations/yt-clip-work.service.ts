import fsp from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { AppError } from '@/shared/api/errors';
import { isLocalEnvironment } from './local-backup.service';
import { toKstDateString, parseTitleDate } from '@/shared/utils/stream-date';
import type {
  Workset, WorksetVideo, WorksetTimeline, WorksetYoutube, WorksetSong, WorksetComment, ProgressFile,
} from '@/app/admin/yt-clip-builder/types';

export type { Workset, WorksetVideo, WorksetTimeline, WorksetYoutube, WorksetSong, WorksetComment, ProgressFile };

/**
 * 치지직 댓글 → 유튜브 클립 생성 도구의 로컬 파일 작업 계층 (일회성).
 *
 * 배포(Vercel)는 파일시스템이 읽기전용이라 못 쓰고, 로컬 서버에서만 동작한다.
 * - workset.json: DB에서 한 번 추출한 작업 원본(영상/타임라인/유튜브후보/등록곡)
 * - progress.json: 영상별 작업 진행상태(유튜브매핑·앵커·곡매칭·제외·완료)
 * DB 쓰기는 이 서비스가 하지 않는다(최종 클립 생성은 기존 bulk 라우트가 담당).
 */

// KST 기준 작업 범위: 2025-09-27 < 방송일 < 2026-03-09 (경계 미포함)
const RANGE_AFTER = '2025-09-27';
const RANGE_BEFORE = '2026-03-09';

const WORK_ROOT = path.join(process.cwd(), 'yt-clip-work');
const WORKSET_PATH = path.join(WORK_ROOT, 'workset.json');
const PROGRESS_PATH = path.join(WORK_ROOT, 'progress.json');

function assertLocal(): void {
  if (!isLocalEnvironment()) {
    throw new AppError('NOT_LOCAL', '로컬 서버에서만 사용할 수 있는 기능입니다.', 400);
  }
}

async function ensureRoot(): Promise<void> {
  await fsp.mkdir(WORK_ROOT, { recursive: true });
}

/** DB에서 작업 원본을 추출해 workset.json으로 저장 */
export async function exportWorkset(): Promise<{ videos: number; timelines: number; youtubeCandidates: number; songs: number }> {
  assertLocal();
  await ensureRoot();
  const db = mongoose.connection.db!;

  // 1) 범위 내 치지직 영상 (publishDate 문자열 → KST 날짜로 필터)
  const allVideos = await db.collection('chzzkvideos').find({}).project({
    videoNo: 1, publishDate: 1, videoTitle: 1, thumbnailImageUrl: 1, youtubeVideoId: 1, timeOffset: 1,
  }).toArray();

  const videos: WorksetVideo[] = allVideos
    .map((v) => ({
      videoNo: v.videoNo as number,
      publishDate: v.publishDate as string,
      chzzkDate: toKstDateString(v.publishDate as string),
      videoTitle: (v.videoTitle as string) || '',
      thumbnailUrl: (v.thumbnailImageUrl as string) || '',
      youtubeVideoId: (v.youtubeVideoId as string) || undefined,
      timeOffset: (v.timeOffset as number | null | undefined) ?? undefined,
    }))
    .filter((v) => v.chzzkDate > RANGE_AFTER && v.chzzkDate < RANGE_BEFORE)
    .sort((a, b) => a.chzzkDate.localeCompare(b.chzzkDate));

  const videoNos = videos.map((v) => v.videoNo);
  const videoIdStrs = videoNos.map(String);

  // 2) 해당 영상들의 파싱된 타임라인 (isExcluded 무시)
  const ptDocs = await db.collection('parsedtimelines').find({
    platform: 'chzzk', videoId: { $in: videoIdStrs },
  }).project({
    id: 1, videoId: 1, startTimeSeconds: 1, endTimeSeconds: 1, artist: 1, songTitle: 1, isRelevant: 1, matchedSong: 1, commentAuthor: 1,
  }).toArray();

  const timelines: WorksetTimeline[] = ptDocs.map((d) => ({
    id: d.id as string,
    videoNo: parseInt(d.videoId as string, 10),
    chzzkTime: (d.startTimeSeconds as number) || 0,
    endTimeSeconds: (d.endTimeSeconds as number | null | undefined) ?? null,
    artist: (d.artist as string) || '',
    songTitle: (d.songTitle as string) || '',
    isRelevant: d.isRelevant !== false,
    matchedSongId: (d.matchedSong as { songId?: string } | undefined)?.songId || undefined,
    commentAuthor: (d.commentAuthor as string) || '',
  })).sort((a, b) => a.videoNo - b.videoNo || a.chzzkTime - b.chzzkTime);

  // 3) 유튜브 후보 (제목 날짜 파싱)
  const ytDocs = await db.collection('youtubevideos').find({}).project({
    videoId: 1, title: 1, publishedAt: 1,
  }).toArray();
  const youtubeCandidates: WorksetYoutube[] = ytDocs.map((y) => ({
    videoId: y.videoId as string,
    title: (y.title as string) || '',
    titleDate: parseTitleDate((y.title as string) || ''),
    publishedAt: (y.publishedAt as Date)?.toISOString?.() || '',
  }));

  // 4) 원본 타임라인 댓글 (영상 매핑 없이도 내용 확인용)
  const commentDocs = await db.collection('chzzkcomments').find({
    videoNo: { $in: videoNos }, isTimeline: true,
  }).project({ videoNo: 1, authorName: 1, content: 1, publishedAt: 1 }).toArray();
  const comments: WorksetComment[] = commentDocs.map((c) => ({
    videoNo: c.videoNo as number,
    author: (c.authorName as string) || '',
    content: (c.content as string) || '',
    publishedAt: (c.publishedAt as Date)?.toISOString?.() || '',
  }));

  // 5) 등록곡 (로컬 매칭용). 대부분 status 미설정(null)이라 'deleted'만 제외한다.
  const songDocs = await db.collection('songdetails').find({
    status: { $ne: 'deleted' },
  }).project({
    title: 1, artist: 1, titleAlias: 1, artistAlias: 1, searchTags: 1, clipDuration: 1,
  }).toArray();
  const songs: WorksetSong[] = songDocs.map((s) => ({
    id: String(s._id),
    title: (s.title as string) || '',
    artist: (s.artist as string) || '',
    titleAlias: (s.titleAlias as string) || undefined,
    artistAlias: (s.artistAlias as string) || undefined,
    searchTags: (s.searchTags as string[]) || [],
    clipDuration: (s.clipDuration as number | undefined) ?? undefined,
  }));

  const workset: Workset = {
    generatedAt: new Date().toISOString(),
    range: { after: RANGE_AFTER, before: RANGE_BEFORE },
    videos, timelines, youtubeCandidates, songs, comments,
  };
  await fsp.writeFile(WORKSET_PATH, JSON.stringify(workset), 'utf8');

  return { videos: videos.length, timelines: timelines.length, youtubeCandidates: youtubeCandidates.length, songs: songs.length };
}

/** 저장된 workset.json 읽기 (없으면 null) */
export async function readWorkset(): Promise<Workset | null> {
  if (!fs.existsSync(WORKSET_PATH)) return null;
  return JSON.parse(await fsp.readFile(WORKSET_PATH, 'utf8')) as Workset;
}

// ── 진행상태 ──────────────────────────────────────────────────────

/** progress.json 읽기 (없으면 빈 객체) */
export async function readProgress(): Promise<ProgressFile> {
  if (!fs.existsSync(PROGRESS_PATH)) return {};
  try {
    return JSON.parse(await fsp.readFile(PROGRESS_PATH, 'utf8')) as ProgressFile;
  } catch {
    return {};
  }
}

/** progress.json 전체 덮어쓰기 */
export async function writeProgress(progress: ProgressFile): Promise<void> {
  assertLocal();
  await ensureRoot();
  await fsp.writeFile(PROGRESS_PATH, JSON.stringify(progress, null, 2), 'utf8');
}
