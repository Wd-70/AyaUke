import { Song } from '@/types';

const SHEET_ID = '1g-hVYnHn20XkS2HLAzOI9UcOnNHNtz1H-1g1MgVXTAc';
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_SHEETS_API_KEY;

interface SheetData {
  values: string[][];
}

export async function fetchSongsFromSheet(): Promise<Song[]> {
  if (!API_KEY || API_KEY === 'test_key') {
    throw new Error('MISSING_API_KEY');
  }

  try {
    // 여러 범위를 시도해서 데이터가 있는 시트를 찾습니다
    const ranges = ['Sheet1', 'A:Z', '시트1', '노래목록'];
    
    for (const range of ranges) {
      try {
        const response = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}?key=${API_KEY}`
        );

        if (response.ok) {
          const data: SheetData = await response.json();
          if (data.values && data.values.length > 0) {
            console.log(`Successfully fetched data from range: ${range}`);
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
  } catch (error) {
    console.error('Error fetching songs from sheet:', error);
    throw error;
  }
}

function parseSheetData(values: string[][]): Song[] {
  if (!values || values.length < 2) return [];

  const headers = values[0].map(h => h.toLowerCase().trim());
  const rows = values.slice(1);

  // 헤더에서 각 컬럼의 인덱스를 찾습니다
  const getColumnIndex = (possibleNames: string[]) => {
    for (const name of possibleNames) {
      const index = headers.findIndex(h => h.includes(name));
      if (index !== -1) return index;
    }
    return -1;
  };

  const artistIndex = getColumnIndex(['제목', 'title', '곡명', '노래']); // 첫 번째 열이 아티스트
  const titleIndex = getColumnIndex(['아티스트', 'artist', '가수', '원곡자']); // 두 번째 열이 제목
  const languageIndex = getColumnIndex(['언어', 'language', 'lang']);
  const mrIndex = getColumnIndex(['mr', 'link', '링크', '반주']);
  const lyricsIndex = getColumnIndex(['가사', 'lyrics']);
  const tagsIndex = getColumnIndex(['태그', 'tags', '분류']);
  const dateIndex = getColumnIndex(['날짜', 'date', '추가일']);

  console.log('Detected column indices:', {
    title: titleIndex,
    artist: artistIndex,
    language: languageIndex,
    mr: mrIndex,
  });

  return rows
    .filter(row => row.length > 0 && (row[titleIndex] || row[0])) // 빈 행 제외
    .map((row, index) => {
      // 언어 감지 (한국어/영어/일본어 자동 판별)
      const artist = row[artistIndex] || row[0] || 'Unknown Artist';
      const title = row[titleIndex] || row[1] || 'Unknown Title';
      
      let detectedLanguage = 'Korean';
      if (/[ひらがなカタカナ]/.test(title + artist)) {
        detectedLanguage = 'Japanese';
      } else if (/^[a-zA-Z\s]+$/.test(title + artist)) {
        detectedLanguage = 'English';
      }

      const song: Song = {
        id: `song-${index + 1}`,
        title: title.trim(),
        artist: artist.trim(),
        language: row[languageIndex] || detectedLanguage,
        mrLinks: row[mrIndex] ? 
          row[mrIndex].split(/[,\n]/).map(link => link.trim()).filter(link => link.length > 0) : [],
        lyrics: row[lyricsIndex] || '',
        tags: row[tagsIndex] ? 
          row[tagsIndex].split(',').map(tag => tag.trim()).filter(tag => tag.length > 0) : [],
        dateAdded: row[dateIndex] || new Date().toISOString().split('T')[0],
      };
      return song;
    });
}

export function getErrorMessage(error: Error): { title: string; message: string; suggestion: string } {
  const errorType = error.message;
  
  switch (errorType) {
    case 'MISSING_API_KEY':
      return {
        title: 'API 키가 설정되지 않았습니다',
        message: 'Google Sheets API 키가 필요합니다.',
        suggestion: 'GOOGLE_SHEETS_SETUP.md 파일을 참고하여 API 키를 설정해주세요.'
      };
    case 'API_KEY_INVALID':
      return {
        title: 'API 키가 유효하지 않습니다',
        message: '설정된 Google Sheets API 키가 올바르지 않거나 권한이 없습니다.',
        suggestion: 'API 키를 다시 확인하거나 새로 생성해주세요.'
      };
    case 'SHEET_NOT_FOUND':
      return {
        title: '시트를 찾을 수 없습니다',
        message: '지정된 구글 시트에 접근할 수 없습니다.',
        suggestion: '시트가 공개되어 있는지 확인하고 시트 ID가 올바른지 확인해주세요.'
      };
    case 'NO_DATA_FOUND':
      return {
        title: '노래 데이터가 없습니다',
        message: '구글 시트에서 노래 데이터를 찾을 수 없습니다.',
        suggestion: '시트에 제목과 아티스트 정보가 포함된 데이터가 있는지 확인해주세요.'
      };
    default:
      return {
        title: '데이터를 불러올 수 없습니다',
        message: '구글 시트에서 노래 데이터를 가져오는 중 문제가 발생했습니다.',
        suggestion: '잠시 후 다시 시도해주세요. 문제가 지속되면 네트워크 연결을 확인해주세요.'
      };
  }
}