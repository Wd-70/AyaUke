import type { MvWork } from './types';
import approved from './approved-clips.json';

/**
 * 곡(SongDetail _id) → MV 작품. MV는 곡마다 손으로 연출한 코드라 레포에 커밋해 관리한다
 * (DB에 코드를 넣고 실행하지 않는다). 작품 코드는 무거우므로 동적 import.
 *
 * 적용 클립은 approved-clips.json의 허용 목록으로만 정한다.
 * `npm run mv:candidates`로 후보(같은 곡·비슷한 길이)를 뽑고, 화면·싱크 검수 후 목록에 올린다.
 * 승인 당시 범위를 함께 기록해 두어, 클립 범위가 나중에 바뀌면 재검수 전까지 MV를 끈다.
 */
const WORKS: Record<string, () => Promise<MvWork>> = {
  '68610d4b042fb27d04542791': () => import('./works/samurai-heart').then((m) => m.default),
};

interface ApprovedSong {
  duration: number;
  clips: { shareId: string; startTime: number; endTime: number }[];
}

const APPROVED = approved as Record<string, ApprovedSong>;

interface ClipRange {
  shareId: string;
  songId: string;
  startTime: number;
  endTime: number | null;
}

export function hasMv(clip: ClipRange): boolean {
  if (!WORKS[clip.songId]) return false;
  return !!APPROVED[clip.songId]?.clips.some(
    (c) => c.shareId === clip.shareId && c.startTime === clip.startTime && c.endTime === clip.endTime,
  );
}

export function loadMv(clip: ClipRange): Promise<MvWork> | null {
  return hasMv(clip) ? WORKS[clip.songId]() : null;
}
