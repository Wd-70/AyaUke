import { describe, test, expect } from 'vitest';
import { parseChzzkTimelineComment, parseSongInfo } from '../chzzk-timeline';

// 실제 chzzkcomments 데이터 기반 골든 샘플 (db:inspect로 추출)
const REAL_COMMENT = [
  '고생많았다에요...ㅠㅠ ',
  '오늘의 오프닝곡 : ㅁ?ㄹ',
  '2:54 안녕하세요',
  '7:20 팝업 이벤트 공지 읽어보기',
  '',
  '1.8 독감 재활 노래방 🪻🥛',
  '',
  '1:15:05 Aimer - 짝사랑(카타오모이)',
  '',
  '1:22:40 Aimer - 별무리 비너스',
  '',
  ' 1:28:16 Aimer - Brave Shine ',
  '',
  '1:34:21 호시마치 스이세이 - 비비디바',
  '',
  '7:10:20 방종뽑뽀 + 잘자',
].join('\n');

describe('parseChzzkTimelineComment', () => {
  test('실제 댓글에서 곡 항목을 추출한다', () => {
    const entries = parseChzzkTimelineComment(REAL_COMMENT);

    const songs = entries.filter((e) => e.isRelevant);
    expect(songs.map((s) => `${s.artist} - ${s.songTitle}`)).toEqual([
      'Aimer - 짝사랑(카타오모이)',
      'Aimer - 별무리 비너스',
      'Aimer - Brave Shine',
      '호시마치 스이세이 - 비비디바',
    ]);
  });

  test('구분자 없는 줄은 isRelevant=false로 보존된다 (방송 메모)', () => {
    const entries = parseChzzkTimelineComment(REAL_COMMENT);
    const memo = entries.find((e) => e.songTitle === '안녕하세요');

    expect(memo).toBeDefined();
    expect(memo!.isRelevant).toBe(false);
    expect(memo!.artist).toBe('알 수 없음');
    expect(memo!.startTimeSeconds).toBe(2 * 60 + 54);
  });

  test('endTime은 다음 항목의 시작 시간, 마지막은 null', () => {
    const entries = parseChzzkTimelineComment('3:00 곡A - 가수A\n5:30 곡B - 가수B');

    expect(entries[0].startTimeSeconds).toBe(180);
    expect(entries[0].endTimeSeconds).toBe(330);
    expect(entries[0].duration).toBe(150);
    expect(entries[1].endTimeSeconds).toBeNull();
    expect(entries[1].duration).toBeNull();
  });

  test('시간 순서가 뒤섞여 있어도 정렬된다', () => {
    const entries = parseChzzkTimelineComment('10:00 B - b\n5:00 A - a');
    expect(entries[0].startTimeSeconds).toBe(300);
    expect(entries[0].endTimeSeconds).toBe(600);
  });

  test('타임스탬프 없는 텍스트만 있으면 빈 배열', () => {
    expect(parseChzzkTimelineComment('오늘 방송 재밌었어요\n다음에 또 만나요')).toEqual([]);
  });

  test('"1.8 독감 재활 노래방" 같은 날짜 표기는 타임스탬프로 오인하지 않는다', () => {
    const entries = parseChzzkTimelineComment('1.8 독감 재활 노래방');
    expect(entries).toEqual([]);
  });
});

describe('parseSongInfo', () => {
  test.each([
    ['Aimer - Ref:rain', 'Aimer', 'Ref:rain'],
    ['요네즈 켄시 – Lemon', '요네즈 켄시', 'Lemon'],
    ['LiSA / 홍련화', 'LiSA', '홍련화'],
    ['그냥 메모', '알 수 없음', '그냥 메모'],
  ])('%s → %s / %s', (input, artist, title) => {
    expect(parseSongInfo(input)).toEqual({ artist, songTitle: title });
  });

  test('곡명에 구분자가 또 있으면 뒷부분 전체를 곡명으로', () => {
    expect(parseSongInfo('HUNTR/X - Golden - Remix')).toEqual({
      artist: 'HUNTR/X',
      songTitle: 'Golden - Remix',
    });
  });
});
