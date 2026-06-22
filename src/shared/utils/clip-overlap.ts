/**
 * 클립 시간 중복 검사 (순수 로직) — 같은 영상 안에서 두 클립의 구간이 겹치는지.
 * 관리자/소유자에게 데이터 품질 경고를 띄우는 용도. (이전엔 LiveClipManager 내부에
 * 박혀 있어 테스트가 어려웠다 → 순수 함수로 추출)
 */

export interface OverlapClip {
  _id?: string;
  videoId: string;
  startTime?: number;
  endTime?: number;
}

/** 두 클립이 같은 영상에서 시간 구간이 겹치는가 (정확히 맞닿는 경계는 정상으로 제외) */
export function checkTimeOverlap(a: OverlapClip, b: OverlapClip): boolean {
  if (a.videoId !== b.videoId) return false; // 다른 영상
  if (a._id && b._id && a._id === b._id) return false; // 같은 클립

  const start1 = a.startTime || 0;
  const end1 = a.endTime || Number.MAX_SAFE_INTEGER; // 종료 없으면 무한대
  const start2 = b.startTime || 0;
  const end2 = b.endTime || Number.MAX_SAFE_INTEGER;

  // 시작/종료가 정확히 이어지는 경우는 정상
  if (end1 === start2 || end2 === start1) return false;

  return Math.max(start1, start2) < Math.min(end1, end2);
}

export interface OverlapInfo<T> {
  hasOverlap: boolean;
  overlappingVideos: T[];
  overlappingCount: number;
}

/** target 클립이 목록 내 다른 클립들과 겹치는지 계산 */
export function getOverlapInfo<T extends OverlapClip>(
  target: OverlapClip,
  all: T[],
): OverlapInfo<T> {
  const overlappingVideos = all.filter((other) => checkTimeOverlap(target, other));
  return {
    hasOverlap: overlappingVideos.length > 0,
    overlappingVideos,
    overlappingCount: overlappingVideos.length,
  };
}
