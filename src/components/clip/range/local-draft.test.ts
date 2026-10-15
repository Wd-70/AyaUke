import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearLocalDraft, readLocalDraft, writeLocalDraft } from './local-draft';

const source = { clipId: 'clip-1', platform: 'youtube' as const, videoId: 'video-1', sourceVersion: 2 };
const range = { startTime: 28_798, endTime: 28_980.5 };
const origin = 28_800.5;
let entries: Map<string, string>;

beforeEach(() => {
  entries = new Map();
  vi.stubGlobal('window', { localStorage: {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => { entries.set(key, value); },
    removeItem: (key: string) => { entries.delete(key); },
  } });
});
afterEach(() => vi.unstubAllGlobals());

describe('브라우저 구간 임시 저장', () => {
  it('편집값과 음수 표시의 기준점을 복원한다', () => {
    expect(writeLocalDraft('user-1', source, range, origin)).toBe(true);
    expect(readLocalDraft('user-1', source)).toEqual({ draft: { ...range, timeOrigin: origin }, available: true });
  });
  it('다시 열어도 편집 전 대비 요약의 기준은 바뀌지 않는다', () => {
    const baseline = { startTime: origin, endTime: 29_000 };
    writeLocalDraft('user-1', source, range, origin, baseline);
    expect(readLocalDraft('user-1', source).draft).toEqual({ ...range, timeOrigin: origin, baseline });
  });

  it('계정, 비로그인 사용자, 클립마다 독립적으로 보관한다', () => {
    writeLocalDraft('user-1', source, range, origin);
    expect(readLocalDraft('user-2', source).draft).toBeNull();
    expect(readLocalDraft('guest', source).draft).toBeNull();
    expect(readLocalDraft('user-1', { ...source, clipId: 'clip-2' }).draft).toBeNull();
    writeLocalDraft('guest', source, { ...range, startTime: 10 }, 0);
    expect(readLocalDraft('user-1', source).draft?.startTime).toBe(range.startTime);
    expect(readLocalDraft('guest', source).draft?.startTime).toBe(10);
  });

  it.each([
    { ...source, sourceVersion: 3 },
    { ...source, videoId: 'replacement' },
    { ...source, platform: 'chzzk' as const },
  ])('원본 교체 시 이전 임시값을 제거한다: %j', changed => {
    writeLocalDraft('user-1', source, range, origin);
    expect(readLocalDraft('user-1', changed)).toEqual({ draft: null, available: true });
    expect(entries.size).toBe(0);
  });

  it('초기화·저장 완료 시 해당 임시값만 제거하고 다시 열어도 복원하지 않는다', () => {
    writeLocalDraft('user-1', source, range, origin);
    writeLocalDraft('user-2', source, range, origin);
    expect(clearLocalDraft('user-1', source)).toBe(true);
    expect(readLocalDraft('user-1', source).draft).toBeNull();
    expect(readLocalDraft('user-2', source).draft).not.toBeNull();
  });

  it('조정할 때마다 이전 값을 덮어쓰고 불필요한 DTO 정보는 저장하지 않는다', () => {
    writeLocalDraft('user-1', source, { ...range, extra: 'not persisted' } as typeof range, origin);
    writeLocalDraft('user-1', source, { ...range, endTime: 28_900 }, origin);
    expect(entries.size).toBe(1);
    expect(JSON.parse([...entries.values()][0])).toEqual({
      sourceVersion: 2, platform: 'youtube', videoId: 'video-1', startTime: range.startTime, endTime: 28_900, timeOrigin: origin,
    });
  });

  it.each([null, 1])('서버 저장 불가능한 편집 중 값도 잃지 않는다: 종료 %s', endTime => {
    writeLocalDraft('user-1', source, { ...range, endTime }, origin);
    expect(readLocalDraft('user-1', source).draft).toEqual({ ...range, endTime, timeOrigin: origin });
  });

  it.each(['broken json', 'null', '{"startTime":"1"}'])('손상된 임시값은 안전하게 제거한다: %s', value => {
    writeLocalDraft('user-1', source, range, origin);
    entries.set([...entries.keys()][0], value);
    expect(readLocalDraft('user-1', source)).toEqual({ draft: null, available: true });
    expect(entries.size).toBe(0);
  });

  it('저장소 접근이 차단되면 편집을 중단하지 않고 실패 상태를 반환한다', () => {
    vi.stubGlobal('window', { get localStorage() { throw new Error('SecurityError'); } });
    expect(readLocalDraft('user-1', source)).toEqual({ draft: null, available: false });
    expect(writeLocalDraft('user-1', source, range, origin)).toBe(false);
    expect(clearLocalDraft('user-1', source)).toBe(false);
  });

  it('용량 부족으로 쓰기에 실패해도 이전 임시값은 유지한다', () => {
    writeLocalDraft('user-1', source, range, origin);
    window.localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
    expect(writeLocalDraft('user-1', source, { ...range, endTime: 99 }, origin)).toBe(false);
    expect(readLocalDraft('user-1', source).draft).toEqual({ ...range, timeOrigin: origin });
  });
});
