import { describe, it, expect } from 'vitest';
import { checkTimeOverlap, getOverlapInfo } from '../clip-overlap';

describe('checkTimeOverlap', () => {
  it('다른 영상이면 겹치지 않음', () => {
    expect(checkTimeOverlap({ videoId: 'a', startTime: 0, endTime: 100 }, { videoId: 'b', startTime: 0, endTime: 100 })).toBe(false);
  });

  it('같은 클립(_id 동일)이면 겹치지 않음', () => {
    expect(checkTimeOverlap({ _id: 'x', videoId: 'a', startTime: 0, endTime: 100 }, { _id: 'x', videoId: 'a', startTime: 0, endTime: 100 })).toBe(false);
  });

  it('구간이 겹치면 true', () => {
    expect(checkTimeOverlap({ _id: '1', videoId: 'a', startTime: 0, endTime: 60 }, { _id: '2', videoId: 'a', startTime: 30, endTime: 90 })).toBe(true);
  });

  it('정확히 맞닿는 경계는 정상(겹침 아님)', () => {
    expect(checkTimeOverlap({ _id: '1', videoId: 'a', startTime: 0, endTime: 60 }, { _id: '2', videoId: 'a', startTime: 60, endTime: 120 })).toBe(false);
  });

  it('떨어져 있으면 겹치지 않음', () => {
    expect(checkTimeOverlap({ _id: '1', videoId: 'a', startTime: 0, endTime: 50 }, { _id: '2', videoId: 'a', startTime: 60, endTime: 120 })).toBe(false);
  });

  it('종료시간이 없으면 무한대로 취급 → 이후 클립과 겹침', () => {
    expect(checkTimeOverlap({ _id: '1', videoId: 'a', startTime: 0 }, { _id: '2', videoId: 'a', startTime: 100, endTime: 120 })).toBe(true);
  });
});

describe('getOverlapInfo', () => {
  const clips = [
    { _id: '1', videoId: 'a', startTime: 0, endTime: 60 },
    { _id: '2', videoId: 'a', startTime: 30, endTime: 90 }, // 1과 겹침
    { _id: '3', videoId: 'a', startTime: 200, endTime: 260 }, // 독립
    { _id: '4', videoId: 'b', startTime: 0, endTime: 60 }, // 다른 영상
  ];

  it('겹치는 클립을 모두 찾는다', () => {
    const info = getOverlapInfo(clips[0], clips);
    expect(info.hasOverlap).toBe(true);
    expect(info.overlappingCount).toBe(1);
    expect(info.overlappingVideos[0]._id).toBe('2');
  });

  it('독립 클립은 겹침 없음', () => {
    const info = getOverlapInfo(clips[2], clips);
    expect(info.hasOverlap).toBe(false);
    expect(info.overlappingCount).toBe(0);
  });
});
