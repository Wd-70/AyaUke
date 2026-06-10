import { describe, test, expect } from 'vitest';
import {
  parseVideoUrl,
  validateVideoUrl,
  extractChzzkVideoNo,
  buildChzzkVideoUrl,
} from '../video-url';

describe('parseVideoUrl', () => {
  test('유튜브 watch URL을 파싱한다', () => {
    const result = parseVideoUrl('https://www.youtube.com/watch?v=DbMJrwTVf0Q');
    expect(result).toEqual({
      platform: 'youtube',
      videoId: 'DbMJrwTVf0Q',
      thumbnailUrl: 'https://img.youtube.com/vi/DbMJrwTVf0Q/mqdefault.jpg',
    });
  });

  test('youtu.be 단축 URL을 파싱한다 (쿼리 파라미터 포함)', () => {
    const result = parseVideoUrl('https://youtu.be/DbMJrwTVf0Q?si=BxACD88jvbAnUDhH');
    expect(result?.platform).toBe('youtube');
    expect(result?.videoId).toBe('DbMJrwTVf0Q');
  });

  test('치지직 다시보기 URL을 파싱한다', () => {
    const result = parseVideoUrl('https://chzzk.naver.com/video/12345678');
    expect(result).toEqual({
      platform: 'chzzk',
      videoId: '12345678',
      videoNo: 12345678,
    });
  });

  test('www 붙은 치지직 URL도 파싱한다', () => {
    const result = parseVideoUrl('https://www.chzzk.naver.com/video/999');
    expect(result?.videoNo).toBe(999);
  });

  test('지원하지 않는 URL은 null', () => {
    expect(parseVideoUrl('https://twitch.tv/video/123')).toBeNull();
    expect(parseVideoUrl('https://chzzk.naver.com/live/abc')).toBeNull();
    expect(parseVideoUrl('')).toBeNull();
    expect(parseVideoUrl('not-a-url')).toBeNull();
  });
});

describe('validateVideoUrl', () => {
  test.each([
    ['https://www.youtube.com/watch?v=abc123', true],
    ['https://youtu.be/abc123', true],
    ['https://chzzk.naver.com/video/42', true],
    ['https://example.com/video/42', false],
  ])('%s → %s', (url, expected) => {
    expect(validateVideoUrl(url)).toBe(expected);
  });
});

describe('extractChzzkVideoNo / buildChzzkVideoUrl', () => {
  test('왕복 변환이 일치한다', () => {
    const url = buildChzzkVideoUrl(123456);
    expect(url).toBe('https://chzzk.naver.com/video/123456');
    expect(extractChzzkVideoNo(url)).toBe(123456);
  });
});
