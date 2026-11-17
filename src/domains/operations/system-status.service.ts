import mongoose from 'mongoose';
import { config } from '@/shared/config';
import { fetchWithTimeout } from '@/lib/fetchWithTimeout';
import { CHZZK_HEADERS } from '@/domains/archive/chzzk.client';
import SongVideo from '@/domains/archive/schemas/song-video.schema';
import ChzzkVideo from '@/domains/archive/schemas/chzzk-video.schema';
import { YouTubeVideo } from '@/domains/archive/schemas/youtube-video.schema';

/**
 * 시스템 설정 → 연동 상태판. 외부 서비스마다 실제로 한 번 호출해 응답 여부·시간을 잰다(읽기 전용).
 * 키 값 자체는 절대 돌려주지 않는다(설정 여부만).
 */

export type CheckState = 'ok' | 'warn' | 'error';
export interface ServiceCheck {
  id: 'mongodb' | 'sheets' | 'youtube' | 'chzzk';
  label: string;
  state: CheckState;
  /** 응답 시간(ms) — 호출하지 못했으면 null */
  ms: number | null;
  detail: string;
  /** 무엇에 쓰이는지 — 문제가 생기면 어디가 영향받는지 알려 준다 */
  usedFor: string;
}
export interface Freshness {
  label: string;
  /** 가장 최근에 추가된 항목 시각 */
  at: string | null;
}
export interface SystemStatus {
  checkedAt: string;
  services: ServiceCheck[];
  deployment: {
    environment: string;
    region: string | null;
    commit: string | null;
    commitMessage: string | null;
    node: string;
  };
  freshness: Freshness[];
  channels: { label: string; value: string; href: string | null; env: string }[];
}

const TIMEOUT = 8000;

async function timed<T>(fn: () => Promise<T>): Promise<{ ms: number; value?: T; error?: unknown }> {
  const start = Date.now();
  try {
    const value = await fn();
    return { ms: Date.now() - start, value };
  } catch (error) {
    return { ms: Date.now() - start, error };
  }
}

const reason = (e: unknown) =>
  e instanceof Error ? (e.name === 'AbortError' ? `${TIMEOUT / 1000}초 안에 응답 없음` : e.message) : String(e);

async function checkMongo(): Promise<ServiceCheck> {
  const base = { id: 'mongodb' as const, label: 'MongoDB', usedFor: '곡 상세·클립·사용자·좋아요 등 모든 저장 데이터' };
  const r = await timed(async () => {
    const db = mongoose.connection.db;
    if (!db) throw new Error('연결되지 않음');
    await db.admin().ping();
    return mongoose.connection.name;
  });
  if (r.error) return { ...base, state: 'error', ms: null, detail: reason(r.error) };
  const slow = r.ms > 1500;
  return { ...base, state: slow ? 'warn' : 'ok', ms: r.ms, detail: `데이터베이스 ${r.value}${slow ? ' · 응답이 느림' : ''}` };
}

async function checkSheets(): Promise<ServiceCheck> {
  const base = { id: 'sheets' as const, label: 'Google Sheets', usedFor: '노래책 곡 목록(원본 시트)' };
  const key = process.env.NEXT_PUBLIC_GOOGLE_SHEETS_API_KEY;
  if (!key) return { ...base, state: 'error', ms: null, detail: 'API 키(NEXT_PUBLIC_GOOGLE_SHEETS_API_KEY)가 설정되지 않음' };
  const r = await timed(async () => {
    const res = await fetchWithTimeout(
      `https://sheets.googleapis.com/v4/spreadsheets/${config.googleSheetId}?fields=properties.title&key=${key}`,
      { cache: 'no-store' },
      TIMEOUT,
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as { properties?: { title?: string } };
    return json.properties?.title ?? '';
  });
  if (r.error) return { ...base, state: 'error', ms: null, detail: reason(r.error) };
  return { ...base, state: 'ok', ms: r.ms, detail: r.value ? `시트 「${r.value}」` : '시트 응답 정상' };
}

async function checkYouTube(): Promise<ServiceCheck> {
  const base = { id: 'youtube' as const, label: 'YouTube Data API', usedFor: '다시보기 댓글 타임라인 수집·영상 정보·MR 검색' };
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return { ...base, state: 'warn', ms: null, detail: 'API 키(YOUTUBE_API_KEY)가 설정되지 않음 — 유튜브 기능이 꺼짐' };
  // channels.list는 할당량 1단위
  const r = await timed(async () => {
    const res = await fetchWithTimeout(
      `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${config.youtubeArchiveChannelId}&key=${key}`,
      { cache: 'no-store' },
      TIMEOUT,
    );
    type YtResponse = {
      items?: { snippet?: { title?: string } }[];
      error?: { message?: string; errors?: { reason?: string }[] };
    };
    const json = (await res.json().catch(() => ({}))) as YtResponse;
    if (!res.ok) {
      const quota = json.error?.errors?.[0]?.reason === 'quotaExceeded';
      throw new Error(quota ? '오늘 할당량 소진' : json.error?.message || `HTTP ${res.status}`);
    }
    return json.items?.[0]?.snippet?.title ?? '';
  });
  if (r.error) return { ...base, state: 'error', ms: null, detail: reason(r.error) };
  return { ...base, state: 'ok', ms: r.ms, detail: r.value ? `아카이브 채널 「${r.value}」` : '응답 정상(채널을 찾지 못함)' };
}

async function checkChzzk(): Promise<ServiceCheck> {
  const base = { id: 'chzzk' as const, label: '치지직', usedFor: '방송 상태·최신 다시보기·팔로워 수·썸네일' };
  const id = config.chzzkChannelId;
  const r = await timed(async () => {
    const res = await fetchWithTimeout(
      `https://api.chzzk.naver.com/service/v2/channels/${id}/live-detail`,
      { headers: { ...CHZZK_HEADERS, referer: `https://chzzk.naver.com/${id}` }, cache: 'no-store' },
      TIMEOUT,
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as { content?: { status?: string; channel?: { channelName?: string } } | null };
    if (!json.content) throw new Error('채널 정보가 비어 있음 — 서버 지역(리전) 차단일 수 있음');
    return json.content;
  });
  if (r.error) return { ...base, state: 'error', ms: null, detail: reason(r.error) };
  const live = r.value?.status === 'OPEN';
  return { ...base, state: 'ok', ms: r.ms, detail: `${r.value?.channel?.channelName ?? '채널'} · ${live ? '방송 중' : '오프라인'}` };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function latest(model: mongoose.Model<any>, label: string): Promise<Freshness> {
  try {
    const doc = await model.findOne({}, { _id: 1 }).sort({ _id: -1 }).lean<{ _id: mongoose.Types.ObjectId }>();
    return { label, at: doc ? doc._id.getTimestamp().toISOString() : null };
  } catch {
    return { label, at: null };
  }
}

export async function getSystemStatus(): Promise<SystemStatus> {
  const [services, freshness] = await Promise.all([
    Promise.all([checkMongo(), checkSheets(), checkYouTube(), checkChzzk()]),
    Promise.all([
      latest(SongVideo, '라이브 클립 추가'),
      latest(ChzzkVideo, '치지직 다시보기 수집'),
      latest(YouTubeVideo, '유튜브 다시보기 수집'),
    ]),
  ]);
  const local = process.env.NODE_ENV === 'production' ? 'production (로컬 실행)' : 'development (로컬)';
  return {
    checkedAt: new Date().toISOString(),
    services,
    deployment: {
      environment: process.env.VERCEL_ENV ?? local,
      region: process.env.VERCEL_REGION ?? null,
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
      commitMessage: process.env.VERCEL_GIT_COMMIT_MESSAGE?.split('\n')[0] ?? null,
      node: process.version,
    },
    freshness,
    channels: [
      {
        label: '치지직 채널',
        value: config.chzzkChannelId,
        href: `https://chzzk.naver.com/${config.chzzkChannelId}`,
        env: 'AYAUKE_CHZZK_CHANNEL_ID',
      },
      {
        label: '유튜브 다시보기 채널',
        value: config.youtubeArchiveChannelId,
        href: `https://www.youtube.com/channel/${config.youtubeArchiveChannelId}`,
        env: 'AYAUKE_YOUTUBE_ARCHIVE_ID',
      },
      {
        label: '노래책 원본 시트',
        value: config.googleSheetId,
        href: `https://docs.google.com/spreadsheets/d/${config.googleSheetId}`,
        env: 'GOOGLE_SHEET_ID',
      },
    ],
  };
}
