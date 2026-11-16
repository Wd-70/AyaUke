import { describe, expect, it } from 'vitest';
import { SongFields, SongCreate, SongChange, SongBulk, emptySongFields, removeMR, mrPlaybackUrl, durationLabel, searchLibrary, type SongLibraryItem } from '../song-workspace';
const item = (overrides: Partial<SongLibraryItem> = {}): SongLibraryItem => ({
  id: 'a', title: '残酷な天使のテーゼ', artist: '高橋洋子', titleAlias: '잔혹한 천사의 테제', artistAlias: '타카하시 요코',
  language: 'Japanese', searchTags: ['에반게리온'], mrCount: 1, selectedMR: { url: 'https://youtu.be/abcdefghijk', skipSeconds: 0, label: '', duration: '' },
  imageUrl: '', hasLyrics: false, clipDuration: null, keyAdjustment: null, status: 'active', sourceType: 'sheet', clips: 3, verifiedClips: 2, likeCount: 0, lastSungDate: null, updatedAt: null, createdAt: null, ...overrides,
});
describe('song workspace contract', () => {
  it('accepts clearable optional metadata and preserves a valid zero skip', () => {
    expect(SongFields.safeParse(emptySongFields()).success).toBe(true);
    expect(SongCreate.safeParse({ title: '곡', artist: '가수', values: emptySongFields() }).success).toBe(true);
  });
  it.each([
    { mrLinks: [{ url: 'javascript:alert(1)', skipSeconds: 0, label: '', duration: '' }] },
    { mrLinks: [{ url: 'https://youtu.be/example', skipSeconds: -1, label: '', duration: '' }] },
    { selectedMRIndex: 1 }, { keyAdjustment: 13 }, { keyAdjustment: .5 }, { clipDuration: 0 },
    { status: 'deleted' }, { likeCount: 300 }, { imageUrl: 'file:///private' },
  ])('rejects invalid or privileged fields %o', patch => {
    expect(SongFields.safeParse({ ...emptySongFields(), ...patch }).success).toBe(false);
  });
  it('requires a revision and prevents identity overwrites', () => {
    expect(SongChange.safeParse({ action: 'edit', values: emptySongFields() }).success).toBe(false);
    expect(SongChange.safeParse({ action: 'edit', expectedUpdatedAt: null, values: { ...emptySongFields(), title: 'overwritten' } }).success).toBe(false);
  });
  it('keeps representative MR identity when removing another row', () => {
    const values = { ...emptySongFields(), mrLinks: ['a', 'b', 'c'].map(url => ({ url, skipSeconds: 0, label: '', duration: '' })), selectedMRIndex: 2 };
    const changed = removeMR(values, 0);
    expect(changed.mrLinks[changed.selectedMRIndex].url).toBe('c');
    expect(removeMR(values, 2).selectedMRIndex).toBe(0);
    expect(removeMR({ ...values, mrLinks: [values.mrLinks[0]], selectedMRIndex: 0 }, 0).selectedMRIndex).toBe(0);
  });
  it('searches originals, display names and tags while respecting archives', () => {
    const songs = [item(), item({ id: 'b', status: 'deleted' })];
    for (const q of ['잔혹한천사', '残酷', '타카하시 에반게리온']) expect(searchLibrary(songs, q, 'all', 'all', 'all')).toHaveLength(1);
    expect(searchLibrary(songs, '', 'deleted', 'all', 'all')[0].id).toBe('b');
    expect(searchLibrary(songs, '', 'zero-skip', 'all', 'all')).toHaveLength(1);
    expect(searchLibrary(songs, '', 'missing-mr', 'all', 'all')).toHaveLength(0);
  });
  it('formats fractional durations and replaces existing YouTube skip parameters', () => {
    expect(durationLabel(189.5)).toBe('3:09.5');
    expect(durationLabel(239.999)).toBe('4:00');
    expect(mrPlaybackUrl('https://youtu.be/abcdefghijk?t=30', 2)).toBe('https://youtu.be/abcdefghijk?t=2');
    expect(mrPlaybackUrl('javascript:alert(1)', 2)).toBe('');
  });
  it('validates bulk scope, duplicates and a maximum of 100 targets', () => {
    const target = { id: '507f1f77bcf86cd799439011', updatedAt: null };
    expect(SongBulk.safeParse({ targets: [target], change: { field: 'keyAdjustment', value: null } }).success).toBe(true);
    expect(SongBulk.safeParse({ targets: [target, target], change: { field: 'language', value: 'Korean' } }).success).toBe(false);
    expect(SongBulk.safeParse({ targets: [target], change: { field: 'mrLinks', value: [] } }).success).toBe(false);
  });
});
