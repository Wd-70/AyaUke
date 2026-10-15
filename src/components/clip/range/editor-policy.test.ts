import { describe, expect, it } from 'vitest';
import { editRangeBoundary, planRangeSave } from './editor-policy';
import { RANGE_STEPS, validRange, type ClipRangeDTO } from '@/domains/archive/clip-range.policy';
import { toClipRelativeTime, toClipSourceTime } from '@/shared/utils/clip-time';

const initial = { startTime: 28_800.5, endTime: 28_980.5 };
const data: ClipRangeDTO = {
  clipId: 'clip', platform: 'youtube', videoId: 'video', sourceVersion: 0, rangeVersion: 0,
  isVerified: false, official: initial, personal: null,
  effective: { ...initial, origin: 'original' }, recommendationId: null, proposals: [],
};

describe('구간 저장 선택', () => {
  const adjusted = { ...initial, startTime: initial.startTime - 0.5 };
  it('변경된 미검증 구간은 기본적으로 개인 저장과 공유를 함께 한다', () => {
    expect(planRangeSave(data, initial, adjusted, true, true)).toEqual({ share: true, savePersonal: true, confirmPin: false });
  });
  it('별도 개인 저장 선택은 제안 없이 저장한다', () => {
    expect(planRangeSave(data, initial, adjusted, true, false)).toEqual({ share: false, savePersonal: true, confirmPin: false });
  });
  it('개인 설정이 없고 그대로 저장하면 고정 확인이 필요하며 공식 동일 제안은 생략한다', () => {
    expect(planRangeSave(data, initial, initial, true, true)).toEqual({ share: false, savePersonal: true, confirmPin: true });
  });
  it('추천 구간을 그대로 저장할 때도 고정을 확인하고 기본 공유 선택을 유지한다', () => {
    const recommended = { ...data, effective: { ...adjusted, origin: 'community' as const } };
    expect(planRangeSave(recommended, adjusted, adjusted, true, true)).toEqual({ share: true, savePersonal: true, confirmPin: true });
  });
  it('이미 저장된 개인 구간은 고정 확인이나 같은 행 쓰기를 반복하지 않는다', () => {
    const saved = { ...data, personal: adjusted, effective: { ...adjusted, origin: 'personal' as const } };
    expect(planRangeSave(saved, adjusted, adjusted, true, true)).toEqual({ share: true, savePersonal: false, confirmPin: false });
    expect(planRangeSave(saved, adjusted, adjusted, true, false)).toEqual({ share: false, savePersonal: false, confirmPin: false });
  });
  it('검증 클립은 공유하지 않고 익명은 저장/공유/고정 확인이 없다', () => {
    expect(planRangeSave({ ...data, isVerified: true }, initial, adjusted, true, true)).toEqual({ share: false, savePersonal: true, confirmPin: false });
    expect(planRangeSave(data, initial, initial, false, true)).toEqual({ share: false, savePersonal: false, confirmPin: false });
  });
  it('편집 중 기본 구간이 갱신되어도 변경 없이 옛 구간을 고정하면 확인한다', () => {
    const refreshed = { ...data, effective: { ...adjusted, origin: 'community' as const } };
    expect(planRangeSave(refreshed, initial, initial, true, true).confirmPin).toBe(true);
  });
});

describe('시작·종료 독립 편집', () => {
  it('모든 조정 단위에서 시작 변경은 종료와 원본 객체를 건드리지 않는다', () => {
    for (const step of RANGE_STEPS) for (const direction of [-1, 1]) {
      const next = editRangeBoundary(initial, 'start', initial.startTime + step * direction);
      expect(next.endTime).toBe(initial.endTime);
      expect(toClipRelativeTime(next.endTime!, initial.startTime)).toBe(180);
    }
    expect(initial).toEqual({ startTime: 28_800.5, endTime: 28_980.5 });
  });
  it('음수 직접 입력과 현재 위치 캡처도 반대 경계를 보존한다', () => {
    const next = editRangeBoundary(initial, 'start', toClipSourceTime(-2.5, initial.startTime));
    expect(next).toEqual({ startTime: 28_798, endTime: 28_980.5 });
    expect(next.endTime! - next.startTime).toBe(182.5);
    expect(editRangeBoundary(next, 'end', 28_970.2)).toEqual({ startTime: 28_798, endTime: 28_970.2 });
  });
  it('종료를 넘긴 시작은 종료를 밀지 않고 유효성 검사에서 거부된다', () => {
    const next = editRangeBoundary(initial, 'start', initial.endTime + 1);
    expect(next.endTime).toBe(initial.endTime);
    expect(validRange(next)).toBe(false);
  });
  it('원본 경계 보정과 잘못된 값도 반대 경계를 변경하지 않는다', () => {
    expect(editRangeBoundary(initial, 'start', -1)).toEqual({ ...initial, startTime: 0 });
    expect(editRangeBoundary(initial, 'end', 100_000, 30_000)).toEqual({ ...initial, endTime: 30_000 });
    expect(editRangeBoundary(initial, 'start', NaN)).toBe(initial);
  });
});
