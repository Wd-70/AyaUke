import { describe, test, expect } from 'vitest';
import { normalizeTitle, createSongKey, mergeSongsData } from '../merge';
import type { Song, SongDetail } from '@/types';

const sheetSong = (id: string, title: string, artist: string): Song => ({
  id,
  title,
  artist,
  language: 'Korean',
  dateAdded: '2025-01-01',
  source: 'sheet',
});

const detail = (over: Partial<SongDetail> & Pick<SongDetail, 'title' | 'artist'>): SongDetail =>
  ({
    _id: over._id ?? 'mongo-id-1',
    language: 'Korean',
    lyrics: '',
    searchTags: [],
    sungCount: 0,
    likeCount: 0,
    mrLinks: [],
    status: 'active',
    sourceType: 'sheet',
    ...over,
  }) as SongDetail;

describe('normalizeTitle / createSongKey', () => {
  test('대소문자와 공백을 무시한다', () => {
    expect(normalizeTitle('Love Dive')).toBe('lovedive');
    expect(normalizeTitle('  사건의   지평선 ')).toBe('사건의지평선');
  });

  test('제목+아티스트 복합키를 만든다', () => {
    expect(createSongKey('Love Dive', 'IVE')).toBe('lovedive|||ive');
  });
});

describe('mergeSongsData', () => {
  test('시트 전용 곡은 source=sheet로 유지된다', () => {
    const result = mergeSongsData([sheetSong('s1', '하입보이', '뉴진스')], [], new Set());

    expect(result).toHaveLength(1);
    expect(result[0].source).toBe('sheet');
    expect(result[0].id).toBe('s1');
  });

  test('양쪽에 있으면 병합되고 MongoDB _id가 메인 ID가 된다', () => {
    const result = mergeSongsData(
      [sheetSong('s1', 'Love Dive', 'IVE')],
      [detail({ _id: 'm1', title: 'love dive', artist: 'ive', lyrics: '가사', sungCount: 3 })],
      new Set(),
    );

    expect(result).toHaveLength(1);
    expect(result[0].source).toBe('merged');
    expect(result[0].id).toBe('m1');
    expect(result[0].sheetId).toBe('s1');
    // title/artist는 시트 우선
    expect(result[0].title).toBe('Love Dive');
    // 상세 정보는 MongoDB 우선
    expect(result[0].lyrics).toBe('가사');
    expect(result[0].sungCount).toBe(3);
  });

  test('삭제된 곡 키에 해당하는 시트 곡은 제외된다', () => {
    const result = mergeSongsData(
      [sheetSong('s1', '삭제곡', '가수')],
      [],
      new Set([createSongKey('삭제곡', '가수')]),
    );

    expect(result).toHaveLength(0);
  });

  test('MongoDB 전용 곡은 source=mongodb로 추가된다', () => {
    const result = mergeSongsData(
      [sheetSong('s1', '시트곡', '가수A')],
      [detail({ _id: 'm1', title: '몽고곡', artist: '가수B' })],
      new Set(),
    );

    expect(result).toHaveLength(2);
    const mongoOnly = result.find((s) => s.id === 'm1');
    expect(mongoOnly?.source).toBe('mongodb');
  });

  test('alias 기준으로 중복이 제거된다', () => {
    const result = mergeSongsData(
      [sheetSong('s1', 'Song A', 'Artist'), sheetSong('s2', 'song  a', 'artist')],
      [],
      new Set(),
    );

    expect(result).toHaveLength(1);
  });

  test('titleAlias가 있으면 alias로 중복 판정한다', () => {
    const result = mergeSongsData(
      [sheetSong('s1', '원제목', '가수'), sheetSong('s2', '별칭제목', '가수')],
      [detail({ _id: 'm1', title: '원제목', artist: '가수', titleAlias: '별칭제목' })],
      new Set(),
    );

    // 병합곡(alias=별칭제목)과 시트곡 '별칭제목'이 같은 키 → 하나만 남는다
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('m1');
  });
});
