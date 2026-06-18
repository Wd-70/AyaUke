import { describe, it, expect } from 'vitest';
import {
  parseYouTubeTimelineComment,
  extractDateFromTitle,
  parseSongInfo,
  decodeHtmlEntities,
} from '../youtube-timeline.parse';

describe('youtube-timeline.parse', () => {
  it('decodeHtmlEntities: 숫자/16진수/이름 엔티티', () => {
    expect(decodeHtmlEntities('A&#39;s &amp; B&#x27;s')).toBe("A's & B's");
  });

  it('parseSongInfo: 구분자로 가수/곡 분리, 없으면 미상', () => {
    expect(parseSongInfo('아이유 - 밤편지')).toEqual({ artist: '아이유', songTitle: '밤편지' });
    expect(parseSongInfo('그냥 곡명')).toEqual({ artist: '알 수 없음', songTitle: '그냥 곡명' });
  });

  it('extractDateFromTitle: [YY.MM.DD] 및 YYYY년 M월 D일', () => {
    expect(extractDateFromTitle('[25.12.09] 노래방송').originalString).toBe('25.12.09');
    expect(extractDateFromTitle('2024년 3월 15일 방송').originalString).toBe('2024년 3월 15일');
    expect(extractDateFromTitle('날짜 없음').date).toBeNull();
  });

  it('parseYouTubeTimelineComment: <a> 타임스탬프 링크 → 곡 항목, 종료=다음 시작', () => {
    const html =
      '<a href="https://youtube.com/watch?v=abc&t=10">0:10</a> 아이유 - 밤편지 ' +
      '<a href="https://youtube.com/watch?v=abc&t=200">3:20</a> 뉴진스 - Ditto';
    const entries = parseYouTubeTimelineComment(html, '[25.01.02] 노래');
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ artist: '아이유', songTitle: '밤편지', startTimeSeconds: 10, endTimeSeconds: 200, isRelevant: true });
    expect(entries[1]).toMatchObject({ artist: '뉴진스', songTitle: 'Ditto', startTimeSeconds: 200, endTimeSeconds: null });
    expect(entries[0].originalDateString).toBe('25.01.02');
  });

  it('타임스탬프 <a> 링크 없으면 빈 배열', () => {
    expect(parseYouTubeTimelineComment('그냥 텍스트 댓글', '제목')).toEqual([]);
  });
});
