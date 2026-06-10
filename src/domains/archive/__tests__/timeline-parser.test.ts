import { describe, test, expect } from 'vitest';
import {
  isTimelineComment,
  extractTimestamps,
  parseTimeToSeconds,
  formatSeconds,
  convertCommentTimestamps,
} from '../timeline-parser';

describe('isTimelineComment', () => {
  test('타임스탬프가 있는 댓글을 감지한다', () => {
    expect(isTimelineComment('1:23:45 사건의 지평선')).toBe(true);
    expect(isTimelineComment('3:45 노래 시작')).toBe(true);
    expect(isTimelineComment('@1:02:03 여기부터')).toBe(true);
    expect(isTimelineComment('3분45초에 부릅니다')).toBe(true);
  });

  // 알려진 한계: JS \b는 한글 경계에서 동작하지 않아 "5분"+공백 형식은 감지 못함 (원본 동작 보존)
  test('한글 경계의 "N분" 단독 형식은 감지하지 못한다 (기존 동작)', () => {
    expect(isTimelineComment('5분 즈음')).toBe(false);
  });

  test('타임스탬프가 없는 댓글은 거부한다', () => {
    expect(isTimelineComment('오늘 방송 너무 재밌었어요')).toBe(false);
    expect(isTimelineComment('')).toBe(false);
  });

  // 회귀 테스트: 전역(g) 정규식 재사용 시 lastIndex가 남아
  // 같은 입력에 대해 호출마다 결과가 달라지던 버그
  test('같은 입력에 대해 연속 호출해도 결과가 일정하다', () => {
    const content = '1:23:45 노래';
    for (let i = 0; i < 5; i++) {
      expect(isTimelineComment(content)).toBe(true);
    }
  });
});

describe('extractTimestamps', () => {
  test('여러 형식의 타임스탬프를 추출한다', () => {
    const content = '0:01:30 첫곡\n12:45 둘째곡\n3분20초 셋째곡';
    const result = extractTimestamps(content);

    expect(result).toContain('0:01:30');
    expect(result).toContain('12:45');
    expect(result).toContain('3분20초');
  });

  test('중복을 제거한다', () => {
    const result = extractTimestamps('3:45 그리고 또 3:45');
    expect(result.filter((t) => t === '3:45')).toHaveLength(1);
  });

  test('실제 타임라인 댓글 형식을 처리한다', () => {
    const realComment = [
      '🎵 타임라인',
      '0:05:12 어푸 (Ah-Choo)',
      '0:12:48 사건의 지평선',
      '1:02:33 Love Dive',
    ].join('\n');

    const result = extractTimestamps(realComment);
    expect(result).toEqual(expect.arrayContaining(['0:05:12', '0:12:48', '1:02:33']));
  });
});

describe('parseTimeToSeconds', () => {
  test.each([
    ['1:23:45', 5025],
    ['0:05:12', 312],
    ['3:45', 225],
    ['12:00', 720],
    ['90', 90],
    ['3분45초', 225],
    ['5분', 300],
    ['45초', 45],
    ['invalid', 0],
  ])('%s → %d초', (input, expected) => {
    expect(parseTimeToSeconds(input)).toBe(expected);
  });
});

describe('formatSeconds', () => {
  test.each([
    [5025, '1:23:45'],
    [225, '3:45'],
    [59, '0:59'],
    [3600, '1:00:00'],
    [0, '0:00'],
  ])('%d초 → %s', (input, expected) => {
    expect(formatSeconds(input)).toBe(expected);
  });

  test('음수는 0:00으로 클램프한다 (유튜브가 치지직보다 먼저 시작한 경우)', () => {
    expect(formatSeconds(-30)).toBe('0:00');
  });
});

describe('convertCommentTimestamps', () => {
  test('각 줄 머리 타임스탬프에 offset을 더한다 (1시간 미만은 M:SS로 정규화)', () => {
    const content = '0:05:00 첫곡\n1:10:00 둘째곡';
    const result = convertCommentTimestamps(content, 60);

    expect(result).toBe('6:00 첫곡\n1:11:00 둘째곡');
  });

  test('음수 offset으로 음수가 되면 0:00으로 클램프한다', () => {
    expect(convertCommentTimestamps('0:01:00 노래', -120)).toBe('0:00 노래');
  });

  test('타임스탬프가 없는 줄은 그대로 둔다', () => {
    const content = '🎵 타임라인\n3:45 노래';
    const result = convertCommentTimestamps(content, 15);

    expect(result).toContain('🎵 타임라인');
    expect(result).toContain('4:00 노래');
  });

  test('MM:SS 형식도 변환한다', () => {
    expect(convertCommentTimestamps('3:45 노래', 15)).toBe('4:00 노래');
  });
});
