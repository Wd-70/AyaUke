import type { Song } from '@/types';

/**
 * 공식 등록곡 판별.
 * 구글시트(스트리머가 직접 등록)에 존재하는 곡 = 공식.
 *  - 'sheet'  : 시트 전용
 *  - 'merged' : 시트 + DB 메타데이터
 *  - 'mongodb': 관리자가 우리 툴로만 추가(시트에 없음) → 비공식
 * source가 비어있는 경우는 안전하게 비공식으로 본다(잘못된 공식 표식 방지).
 */
export function isOfficialSong(song: Pick<Song, 'source'>): boolean {
  return song.source === 'sheet' || song.source === 'merged';
}
