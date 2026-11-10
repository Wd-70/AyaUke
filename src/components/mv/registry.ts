import type { MvWork } from './types';

/**
 * 곡(SongDetail _id) → MV 작품. MV는 곡마다 손으로 연출한 코드라 레포에 커밋해 관리한다
 * (DB에 코드를 넣고 실행하지 않는다). 작품 코드는 무거우므로 동적 import.
 *
 * 같은 곡의 다른 클립에도 적용하되, 클립 범위가 곡에 정확히 맞춰져 있어야 가사·연출이 맞으므로
 * 기준 길이와 DURATION_TOLERANCE초 이내인 클립만 대상으로 한다.
 */
interface MvEntry {
  songId: string;
  /** 기준 클립 길이(초) — 작품의 duration과 같아야 한다 */
  duration: number;
  load: () => Promise<MvWork>;
}

const ENTRIES: MvEntry[] = [
  {
    // 사무라이 하트 — 기준 클립 z1baTcmHs8WJ (2026.08.26)
    songId: '68610d4b042fb27d04542791',
    duration: 192,
    load: () => import('./works/samurai-heart').then((m) => m.default),
  },
];

export const DURATION_TOLERANCE = 5;

interface ClipRange {
  songId: string;
  startTime: number;
  endTime: number | null;
}

function findEntry(clip: ClipRange): MvEntry | null {
  if (clip.endTime == null) return null;
  const length = clip.endTime - clip.startTime;
  return ENTRIES.find((e) => e.songId === clip.songId && Math.abs(length - e.duration) <= DURATION_TOLERANCE) ?? null;
}

export function hasMv(clip: ClipRange): boolean {
  return findEntry(clip) !== null;
}

export function loadMv(clip: ClipRange): Promise<MvWork> | null {
  return findEntry(clip)?.load() ?? null;
}
