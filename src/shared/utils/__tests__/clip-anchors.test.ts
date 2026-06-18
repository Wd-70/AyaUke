import { describe, it, expect } from 'vitest';
import { toYtTime, upsertAnchor, removeAnchor, isAnchored, anchorFor } from '../clip-anchors';

describe('clip-anchors (구간별 앵커)', () => {
  it('앵커가 없으면 ytTime은 null', () => {
    expect(toYtTime(100, [])).toBeNull();
  });

  it('단일 앵커: 전 구간에 동일 오프셋 적용', () => {
    // chzzk 60s ↔ yt 50s → offset -10
    const anchors = upsertAnchor([], 60, 50);
    expect(toYtTime(60, anchors)).toBe(50);
    expect(toYtTime(120, anchors)).toBe(110);
    // 첫 앵커보다 앞선 시각도 첫 앵커 오프셋을 따른다
    expect(toYtTime(30, anchors)).toBe(20);
  });

  it('두 번째 앵커는 그 지점 이후만 갱신, 이전은 유지', () => {
    let anchors = upsertAnchor([], 60, 60); // offset 0
    anchors = upsertAnchor(anchors, 600, 700); // 600 이후 offset +100 (편집 컷으로 100초 밀림)
    // 600 이전: offset 0
    expect(toYtTime(300, anchors)).toBe(300);
    expect(toYtTime(599, anchors)).toBe(599);
    // 600 이상: offset +100
    expect(toYtTime(600, anchors)).toBe(700);
    expect(toYtTime(900, anchors)).toBe(1000);
  });

  it('같은 chzzkTime upsert는 ytTime을 덮어쓴다', () => {
    let anchors = upsertAnchor([], 60, 50);
    anchors = upsertAnchor(anchors, 60, 55);
    expect(anchors.filter((a) => a.chzzkTime === 60)).toHaveLength(1);
    expect(toYtTime(60, anchors)).toBe(55);
  });

  it('앵커 제거 시 이전 구간 오프셋을 다시 따른다', () => {
    let anchors = upsertAnchor([], 0, 0);
    anchors = upsertAnchor(anchors, 600, 700);
    expect(toYtTime(900, anchors)).toBe(1000);
    anchors = removeAnchor(anchors, 600);
    expect(toYtTime(900, anchors)).toBe(900); // 첫 앵커(offset 0)로 복귀
  });

  it('isAnchored / anchorFor', () => {
    const anchors = upsertAnchor(upsertAnchor([], 60, 60), 600, 700);
    expect(isAnchored(60, anchors)).toBe(true);
    expect(isAnchored(300, anchors)).toBe(false);
    expect(anchorFor(900, anchors)?.chzzkTime).toBe(600);
    expect(anchorFor(300, anchors)?.chzzkTime).toBe(60);
  });
});
