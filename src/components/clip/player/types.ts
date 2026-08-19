/** 플레이어 큐에서 다루는 재생 단위 (SongVideo 클립에서 파생된 표시/재생 DTO). */
export interface PlayerClip {
  clipId: string;
  title: string;
  artist: string;
  platform: 'youtube' | 'chzzk';
  videoId: string;
  startTime: number;
  endTime?: number | null;
  thumbnailUrl?: string;
  sungDate?: string;
  description?: string;
  /** 원본 영상이 사라진 경우 — 큐에서 제외 */
  sourceUnavailable?: boolean;
}

/** populate된 클립(SongVideo) 원자료 → PlayerClip. 재생 불가/필수필드 누락이면 null. */
export function toPlayerClip(raw: unknown): PlayerClip | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Record<string, unknown>;
  const id = (c._id ?? c.id) as string | { toString(): string } | undefined;
  const videoId = c.videoId as string | undefined;
  const platform = c.platform as 'youtube' | 'chzzk' | undefined;
  if (!id || !videoId || (platform !== 'youtube' && platform !== 'chzzk')) return null;
  if (c.sourceUnavailable) return null;
  return {
    clipId: String(id),
    // 표시용: 별칭(titleAlias/artistAlias) 우선 — 노래책과 일관
    title: (c.titleAlias as string) || (c.title as string) || '제목 없음',
    artist: (c.artistAlias as string) || (c.artist as string) || '',
    platform,
    videoId,
    startTime: typeof c.startTime === 'number' ? c.startTime : 0,
    endTime: (c.endTime as number | null | undefined) ?? null,
    thumbnailUrl: (c.thumbnailUrl as string) || undefined,
    sungDate: (c.sungDate as string) || undefined,
    description: (c.description as string) || undefined,
  };
}

/** 클립 구간 길이(초). endTime이 없거나 startTime 이하이면 null(길이 미상). */
export function clipDurationSec(clip: PlayerClip): number | null {
  if (typeof clip.endTime !== 'number') return null;
  const d = clip.endTime - clip.startTime;
  return d > 0 ? d : null;
}

/** 유튜브/치지직 클립의 대표 썸네일 URL (MediaSession artwork 등). */
export function clipArtwork(clip: PlayerClip): string | undefined {
  if (clip.thumbnailUrl) return clip.thumbnailUrl;
  if (clip.platform === 'youtube') return `https://i.ytimg.com/vi/${clip.videoId}/hqdefault.jpg`;
  return undefined;
}
