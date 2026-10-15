import { describe, expect, it } from 'vitest';
import { boundaryPreview, describeRangeChanges, durationWords, parseRangeTime, rangePosition, timelineSelection } from './editor-experience';

describe('실제 재생 위치의 포함 여부', () => {
  const range = { startTime: 28800, endTime: 29000 };
  it.each([[28799.999, 'before'], [28800, 'inside'], [28800.001, 'inside'], [28999.999, 'inside'], [29000, 'after'], [29000.001, 'after']] as const)
   ('%s초는 %s — 반올림 없이 경계를 판정한다', (current, expected) => {
      expect(rangePosition(current, range)).toBe(expected);
    });
  it('미설정·역전 구간과 알 수 없는 재생 위치는 판정하지 않는다', () => {
    expect(rangePosition(28800, { ...range, endTime: null })).toBe('unknown');
    expect(rangePosition(28800, { startTime: 29000, endTime: 28800 })).toBe('unknown');
    expect(rangePosition(NaN, range)).toBe('unknown');
  });
});

describe('시간 직접 입력', () => {
  it.each([['205', 205], ['3:25', 205], ['-0:02.5', -2.5], [' .5 ', 0.5], ['1:02:03.4', 3723.4], ['120:00', 7200], ['', null], ['  ', null], ['-2.5', -2.5]])('%s → %s', (input, expected) => {
    expect(parseRangeTime(input as string)).toBe(expected);
  });
  it.each(['-', 'abc', '3:75', '1:60:00', '3:', '1:2:3:4', 'Infinity', '1e5', '--2', '1.2.3'])('잘못된 입력 %s은 0으로 처리하지 않는다', input => {
    expect(parseRangeTime(input)).toBeUndefined();
  });
});

describe('경계 미리듣기', () => {
  const range = { startTime: 28_800, endTime: 29_000 };
  it('시작 앞 2초·뒤 5초를 원본 좌표로 계산한다', () => {
    expect(boundaryPreview(range, 'start', true)).toMatchObject({ from: 28_798, to: 28_805, boundary: 28_800, edge: 'start' });
  });
  it('종료 앞 5초·뒤 2초를 원본 좌표로 계산한다', () => {
    expect(boundaryPreview(range, 'end', true)).toMatchObject({ from: 28_995, to: 29_002, boundary: 29_000, edge: 'end' });
    expect(range).toEqual({ startTime: 28_800, endTime: 29_000 });
  });
  it('영상 처음과 끝을 넘지 않는다', () => {
    expect(boundaryPreview({ startTime: 1, endTime: 9 }, 'start', true, 10)).toMatchObject({ from: 0, to: 6 });
    expect(boundaryPreview({ startTime: 1, endTime: 9 }, 'end', true, 10)).toMatchObject({ from: 4, to: 10 });
  });
  it('기존 10초 확인은 저장 구간 안에서만 재생한다', () => {
    expect(boundaryPreview(range, 'start', false)).toMatchObject({ from: 28_800, to: 28_810 });
    expect(boundaryPreview(range, 'end', false)).toMatchObject({ from: 28_990, to: 29_000 });
    expect(boundaryPreview({ startTime: 1, endTime: 3 }, 'end', false)).toMatchObject({ from: 1, to: 3 });
  });
  it('미설정 종료·역전 구간·영상 범위 밖은 재생하지 않는다', () => {
    expect(boundaryPreview({ startTime: 1, endTime: null }, 'end', true)).toBeNull();
    expect(boundaryPreview({ startTime: 9, endTime: 1 }, 'start', true)).toBeNull();
    expect(boundaryPreview(range, 'end', true, 100)).toBeNull();
  });
});

describe('편집 전 대비 요약과 재생바', () => {
  it('공식 구간이 아닌 전달된 편집 전 구간과 비교한다', () => {
    expect(describeRangeChanges({ startTime: 99.5, endTime: 215 }, { startTime: 100, endTime: 300 }))
      .toBe('앞부분 0.5초 추가 · 끝부분 1분 25초 줄임 · 최종 길이 1분 55.5초');
    expect(durationWords(59.99)).toBe('1분');
  });
  it('시작과 종료 변화의 방향을 별도로 표시한다', () => {
    expect(describeRangeChanges({ startTime: 105, endTime: 310 }, { startTime: 100, endTime: 300 }))
      .toBe('앞부분 5초 줄임 · 끝부분 10초 추가 · 최종 길이 3분 25초');
  });
  it('유효하지 않은 길이는 정상 길이처럼 표시하지 않는다', () => {
    expect(describeRangeChanges({ startTime: 20, endTime: 10 }, { startTime: 1, endTime: 10 })).toContain('종료를 시작 뒤로');
  });
  it('남길 구간 비율은 탐색 창 안에서 계산하고 경계를 보정한다', () => {
    const selection = timelineSelection(90, 210, { startTime: 100, endTime: 190 });
    expect(selection?.start).toBeCloseTo(100 / 12);
    expect(selection?.end).toBeCloseTo(1000 / 12);
    expect(timelineSelection(90, 210, { startTime: 0, endTime: 300 })).toEqual({ start: 0, end: 100 });
    expect(timelineSelection(90, 90, { startTime: 100, endTime: 190 })).toBeNull();
    expect(timelineSelection(90, 210, { startTime: 190, endTime: 100 })).toBeNull();
  });
});
