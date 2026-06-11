/** 라이브 클립 관리 탭 공용 타입/유틸 */

export interface ClipData {
  _id: string;
  songId: string;
  title: string;
  artist: string;
  platform?: 'youtube' | 'chzzk';
  videoUrl: string;
  videoId: string;
  sungDate: string;
  description?: string;
  startTime?: number;
  endTime?: number;
  addedBy: string;
  addedByName: string;
  isVerified: boolean;
  verifiedAt?: string;
  thumbnailUrl?: string;
  createdAt: string;
  updatedAt: string;
  songDetail?: {
    _id: string;
    title: string;
    artist: string;
    titleAlias?: string;
    artistAlias?: string;
    clipDuration?: number;
  } | null;
}

export interface SongWithClips {
  songId: string;
  title: string;
  artist: string;
  titleAlias?: string;
  artistAlias?: string;
  clipCount: number;
  verifiedCount: number;
  platforms: ('youtube' | 'chzzk')[];
  latestSungDate?: string;
  thumbnailUrl?: string;
  clipDuration?: number;
}

export interface ClipStats {
  total: number;
  verified: number;
  unverified: number;
  platforms: { youtube: number; chzzk: number };
  topContributors: { name: string; count: number }[];
  topSongs: { songId: string; title: string; artist: string; count: number }[];
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** 클립 편집용 플레이어 추상화 (유튜브 YT.Player / ChzzkPlayerHandle 공용) */
export interface EditPlayerAdapter {
  getCurrentTime: () => number;
  seekTo: (seconds: number) => void;
  play: () => void;
  pause: () => void;
}

// ── 시간 포맷/파싱 ────────────────────────────────────────────────

/** 초 → "H:MM:SS" | "M:SS" (소수가 있으면 .d 한 자리 표시) */
export function formatTime(seconds: number | null | undefined): string {
  if (seconds == null || isNaN(seconds)) return '-';
  const total = Math.floor(seconds);
  const frac = Math.round((seconds - total) * 10);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const base =
    h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${m}:${String(s).padStart(2, '0')}`;
  return frac > 0 ? `${base}.${frac}` : base;
}

/**
 * 유연한 시간 입력 파싱: "225" | "225.5" | "3:45" | "3:45.5" | "1:02:03" → 초.
 * 잘못된 형식은 null.
 */
export function parseTimeInput(text: string): number | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(':');
  if (parts.some((p) => p === '' || isNaN(Number(p)))) return null;

  let seconds = 0;
  for (const part of parts) {
    seconds = seconds * 60 + Number(part);
  }
  return seconds >= 0 ? Math.round(seconds * 10) / 10 : null;
}

/** 플레이어 현재 시간 캡처 (소수 1자리) */
export const captureTime = (t: number) => Math.round(t * 10) / 10;

/** 두 클립의 시간 구간 겹침 여부 (같은 플랫폼·같은 영상·같은 곡 내에서만 호출) */
export function clipsOverlap(a: ClipData, b: ClipData): boolean {
  if ((a.platform || 'youtube') !== (b.platform || 'youtube')) return false;
  if (a.videoId !== b.videoId) return false;
  if (a._id === b._id) return false;

  const s1 = a.startTime || 0;
  const e1 = a.endTime ?? Number.MAX_SAFE_INTEGER;
  const s2 = b.startTime || 0;
  const e2 = b.endTime ?? Number.MAX_SAFE_INTEGER;

  if (e1 === s2 || e2 === s1) return false; // 정확히 이어지는 경우는 정상
  return Math.max(s1, s2) < Math.min(e1, e2);
}

export const platformBadgeClass = (platform?: string) =>
  platform === 'chzzk'
    ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
    : 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300';

export const platformLabel = (platform?: string) => (platform === 'chzzk' ? '치지직' : '유튜브');

export const thumbnailSrc = (clip: { thumbnailUrl?: string; platform?: string; videoId: string }) =>
  clip.thumbnailUrl ||
  ((clip.platform || 'youtube') === 'youtube'
    ? `https://img.youtube.com/vi/${clip.videoId}/mqdefault.jpg`
    : '/honeyz_pink.png');
