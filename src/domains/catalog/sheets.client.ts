import { Song } from '@/types';
import { config } from '@/shared/config';

/** 구글시트에서 노래 목록을 읽어오는 클라이언트. 시트 접근과 행 파싱만 담당한다. */

const SHEET_ID = config.googleSheetId;
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_SHEETS_API_KEY;

interface SheetData {
  values: string[][];
}

export function assertSheetsApiKey(): void {
  if (!API_KEY || API_KEY === 'test_key') {
    throw new Error('MISSING_API_KEY');
  }
}

export async function fetchRawSongsFromSheet(): Promise<Song[]> {
  // 여러 범위를 시도해서 데이터가 있는 시트를 찾는다
  const ranges = ['Sheet1', 'A:Z', '시트1', '노래목록'];

  for (const range of ranges) {
    try {
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}?key=${API_KEY}`,
        { signal: AbortSignal.timeout(10000) },
      );

      if (response.ok) {
        const data: SheetData = await response.json();
        if (data.values && data.values.length > 0) {
          const songs = parseSheetData(data.values);
          if (songs.length > 0) {
            return songs;
          }
        }
      } else if (response.status === 403) {
        throw new Error('API_KEY_INVALID');
      } else if (response.status === 404) {
        throw new Error('SHEET_NOT_FOUND');
      }
    } catch (rangeError) {
      console.warn(`Failed to fetch from range ${range}:`, rangeError);
      continue;
    }
  }

  throw new Error('NO_DATA_FOUND');
}

// 시트 구조 문제로 중복 생성되는 곡들 수동 제외 목록
const PROBLEMATIC_SONGS = [
  { title: 'gods', artist: '뉴진스' },
  { title: 'sugarcoat', artist: '키스오브라이프' },
  { title: '나는 최강', artist: 'ado' },
  { title: '타상연화', artist: '요네즈 켄시' },
  { title: '아이돌', artist: '최애의 아이 ost' },
];

export function parseSheetData(values: string[][]): Song[] {
  if (!values || values.length < 1) return [];

  const firstRow = values[0].map((h) => (h || '').toLowerCase().trim());

  const getColumnIndex = (possibleNames: string[]) => {
    for (const name of possibleNames) {
      const index = firstRow.findIndex((h) => h.includes(name));
      if (index !== -1) return index;
    }
    return -1;
  };

  const titleIndex = getColumnIndex(['제목', 'title', '곡명', '노래']);
  const artistIndex = getColumnIndex(['아티스트', 'artist', '가수', '원곡자']);

  // 실제 헤더 텍스트가 있으면 헤더로 간주 ('abir', 'tango' 같은 실제 데이터는 헤더가 아님)
  const hasRealHeader =
    titleIndex !== -1 &&
    artistIndex !== -1 &&
    !(
      firstRow.length === 2 &&
      firstRow.every((cell) => cell.length < 10 && !cell.includes('제목') && !cell.includes('title'))
    );

  const dataRows = hasRealHeader ? values.slice(1) : values;

  return dataRows
    .filter((row) => row.length > 0 && (row[titleIndex] || row[0]))
    .map((row, index) => {
      let title: string, artist: string;

      if (hasRealHeader && titleIndex !== -1 && artistIndex !== -1) {
        title = row[titleIndex]?.trim() || '';
        artist = row[artistIndex]?.trim() || '';
      } else {
        // 헤더가 없으면 실제 구글시트 구조: 첫 컬럼=아티스트, 둘째 컬럼=제목
        artist = row[0]?.trim() || '';
        title = row[1]?.trim() || '';
      }

      if (!title || !artist) return null;

      return {
        id: `song-${index + 1}`,
        title,
        artist,
        language: 'Korean', // 기본값, MongoDB에서 덮어씀
        dateAdded: new Date().toISOString().split('T')[0],
        source: 'sheet' as const,
      } satisfies Song;
    })
    .filter((song): song is Song => song !== null)
    .filter((song) => {
      const normalize = (s: string) => s.toLowerCase().replace(/\s/g, '');
      return !PROBLEMATIC_SONGS.some(
        (p) => normalize(song.title) === normalize(p.title) && normalize(song.artist) === normalize(p.artist),
      );
    });
}

export function getErrorMessage(error: Error): { title: string; message: string; suggestion: string } {
  switch (error.message) {
    case 'MISSING_API_KEY':
      return {
        title: 'API 키가 설정되지 않았습니다',
        message: 'Google Sheets API 키가 필요합니다.',
        suggestion: 'GOOGLE_SHEETS_SETUP.md 파일을 참고하여 API 키를 설정해주세요.',
      };
    case 'API_KEY_INVALID':
      return {
        title: 'API 키가 유효하지 않습니다',
        message: '설정된 Google Sheets API 키가 올바르지 않거나 권한이 없습니다.',
        suggestion: 'API 키를 다시 확인하거나 새로 생성해주세요.',
      };
    case 'SHEET_NOT_FOUND':
      return {
        title: '시트를 찾을 수 없습니다',
        message: '지정된 구글 시트에 접근할 수 없습니다.',
        suggestion: '시트가 공개되어 있는지 확인하고 시트 ID가 올바른지 확인해주세요.',
      };
    case 'NO_DATA_FOUND':
      return {
        title: '노래 데이터가 없습니다',
        message: '구글 시트에서 노래 데이터를 찾을 수 없습니다.',
        suggestion: '시트에 제목과 아티스트 정보가 포함된 데이터가 있는지 확인해주세요.',
      };
    default:
      return {
        title: '데이터를 불러올 수 없습니다',
        message: '구글 시트에서 노래 데이터를 가져오는 중 문제가 발생했습니다.',
        suggestion: '잠시 후 다시 시도해주세요. 문제가 지속되면 네트워크 연결을 확인해주세요.',
      };
  }
}
