import { Song, SongDetail } from '@/types';

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
    // 1. 구글시트에서 기본 데이터 가져오기
    console.log('📋 구글시트에서 기본 데이터 가져오는 중...');
    const sheetSongs = await fetchRawSongsFromSheet();
    
    // 2. MongoDB에서 상세 데이터 가져오기
    console.log('🗄️ MongoDB에서 상세 데이터 가져오는 중...');
    const songDetails = await fetchSongDetailsFromMongo();
    
    // 3. 두 데이터를 병합
    console.log('🔄 데이터 병합 중...');
    const mergedSongs = mergeSongsData(sheetSongs, songDetails);
    
    console.log(`✅ 병합 완료: 구글시트 ${sheetSongs.length}곡, MongoDB ${songDetails.length}곡, 최종 ${mergedSongs.length}곡`);
    return mergedSongs;
    
  } catch (error) {
    console.error('Error fetching songs from sheet:', error);
    throw error;
  }
}

export async function fetchRawSongsFromSheet(): Promise<Song[]> {
  // 여러 범위를 시도해서 데이터가 있는 시트를 찾습니다
  const ranges = ['Sheet1', 'A:Z', '시트1', '노래목록'];
  
  for (const range of ranges) {
    try {
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}?key=${API_KEY}`,
        {
          timeout: 10000, // 10초 타임아웃
          signal: AbortSignal.timeout(10000)
        }
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
}

export async function fetchSongDetailsFromMongo(): Promise<SongDetail[]> {
  try {
    console.log('🔌 MongoDB 연결 시도 중...');
    
    // 서버사이드에서는 직접 MongoDB 모델 사용
    const dbConnect = (await import('./mongodb')).default;
    const SongDetail = (await import('../models/SongDetail')).default;
    
    console.log('📦 MongoDB 모듈 로드 완료');
    
    await dbConnect();
    console.log('✅ MongoDB 연결 성공');
    
    console.log('📊 MongoDB에서 데이터 조회 중...');
    const songDetails = await SongDetail.find({ 
      $and: [
        // 삭제된 곡 제외 (기존 데이터는 status 필드가 없으므로 null도 허용)
        { $or: [{ status: { $ne: 'deleted' } }, { status: { $exists: false } }] },
        // 유저 추천곡 제외 (기존 데이터는 sourceType 필드가 없으므로 null도 허용)
        { $or: [{ sourceType: { $in: ['sheet', 'admin'] } }, { sourceType: { $exists: false } }] }
      ]
    }).sort({ updatedAt: -1 }).lean();
    console.log(`📋 MongoDB에서 ${songDetails.length}곡 조회 완료 (삭제된 곡 제외)`);
    
    // Mongoose 문서를 일반 객체로 변환 (MongoDB _id 포함)
    return songDetails.map(doc => ({
      _id: doc._id.toString(), // MongoDB ObjectId를 문자열로 변환
      title: doc.title,
      artist: doc.artist,
      titleAlias: doc.titleAlias,
      artistAlias: doc.artistAlias,
      language: doc.language,
      lyrics: doc.lyrics,
      searchTags: doc.searchTags,
      sungCount: doc.sungCount,
      lastSungDate: doc.lastSungDate,
      keyAdjustment: doc.keyAdjustment,
      mrLinks: doc.mrLinks,
      selectedMRIndex: doc.selectedMRIndex,
      personalNotes: doc.personalNotes,
      imageUrl: doc.imageUrl,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      // 새 필드들 (기존 데이터 호환성을 위한 기본값 설정)
      status: doc.status || 'active',
      sourceType: doc.sourceType || 'sheet',
      suggestedBy: doc.suggestedBy,
      deletedAt: doc.deletedAt,
      deletedBy: doc.deletedBy,
      deleteReason: doc.deleteReason,
      approvedAt: doc.approvedAt,
      approvedBy: doc.approvedBy,
    }));
  } catch (error) {
    console.error('❌ MongoDB 오류 발생:', error);
    console.error('스택 트레이스:', error instanceof Error ? error.stack : 'Unknown error');
    
    // 에러 타입별로 상세한 로깅
    if (error instanceof Error) {
      if (error.message.includes('ENOTFOUND') || error.message.includes('connection')) {
        console.error('🔌 MongoDB 연결 실패 - 네트워크 또는 MongoDB URI 확인 필요');
      } else if (error.message.includes('Authentication')) {
        console.error('🔐 MongoDB 인증 실패 - 사용자명/비밀번호 확인 필요');
      } else if (error.message.includes('timeout')) {
        console.error('⏱️ MongoDB 연결 타임아웃');
      }
    }
    
    return []; // MongoDB 오류 시 빈 배열 반환
  }
}

// 제목을 정규화하는 함수 (대소문자, 띄어쓰기 무시)
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s+/g, '') // 모든 공백 제거
    .trim();
}

// 제목+아티스트 복합키를 생성하는 함수
function createSongKey(title: string, artist: string): string {
  return `${normalizeTitle(title)}|||${normalizeTitle(artist)}`;
}

export function mergeSongsData(sheetSongs: Song[], songDetails: SongDetail[]): Song[] {
  // MongoDB 데이터를 정규화된 title+artist 복합키로 맵 생성
  const detailsMap = new Map<string, SongDetail>();
  const normalizedToOriginalMap = new Map<string, string>(); // 디버깅용
  const usedMongoSongs = new Set<string>(); // 이미 매칭된 MongoDB 곡들 추적
  
  songDetails.forEach(detail => {
    const songKey = createSongKey(detail.title, detail.artist);
    detailsMap.set(songKey, detail);
    normalizedToOriginalMap.set(songKey, `${detail.title} - ${detail.artist}`);
  });

  console.log('🔍 병합 디버깅:', {
    sheetSongs: sheetSongs.length,
    mongoSongs: songDetails.length,
    mongoTitles: Array.from(normalizedToOriginalMap.values()).slice(0, 5) // 처음 5개만 샘플 출력
  });

  // 1. 구글시트 데이터에 MongoDB 데이터 병합
  const mergedSheetSongs = sheetSongs.map(song => {
    const sheetSongKey = createSongKey(song.title, song.artist);
    const detail = detailsMap.get(sheetSongKey);
    
    // 디버깅: 몇 개 샘플만 출력
    if (song.id === 'song-75' || song.id === 'song-1' || song.id === 'song-10') {
      console.log(`🔍 "${song.title} - ${song.artist}" 매칭 결과:`, {
        found: !!detail,
        mongoTitle: detail?.title,
        mongoArtist: detail?.artist,
        sheetTitle: song.title,
        sheetArtist: song.artist,
        sheetKey: sheetSongKey
      });
    }
    
    if (!detail) {
      // MongoDB에 데이터가 없는 경우 구글시트 기본 데이터만 반환
      return { ...song, source: 'sheet' as const };
    }

    // 매칭된 MongoDB 곡 표시
    usedMongoSongs.add(sheetSongKey);

    // MongoDB 데이터를 우선하되, title/artist만 구글시트 값 사용
    return {
      // MongoDB _id를 메인 ID로 사용
      id: detail._id,              // MongoDB ObjectId를 메인 ID로 사용
      sheetId: song.id,           // 구글시트 원본 ID는 별도 보관
      title: song.title,           // 구글시트 우선
      artist: song.artist,         // 구글시트 우선
      source: 'merged' as const,   // 병합된 데이터
      
      // MongoDB 데이터 우선 사용
      language: detail.language || song.language,
      lyrics: detail.lyrics || '',
      titleAlias: detail.titleAlias,
      artistAlias: detail.artistAlias,
      searchTags: detail.searchTags,
      sungCount: detail.sungCount,
      lastSungDate: detail.lastSungDate,
      keyAdjustment: detail.keyAdjustment,
      mrLinks: detail.mrLinks,
      selectedMRIndex: detail.selectedMRIndex,
      personalNotes: detail.personalNotes,
      imageUrl: detail.imageUrl,
      dateAdded: detail.createdAt ? detail.createdAt.toISOString().split('T')[0] : song.dateAdded,
    };
  });

  // 2. MongoDB 전용 곡들 추가 (구글시트에 없는 곡들)
  const mongoOnlySongs: Song[] = [];
  let mongoOnlyCounter = 1;
  
  songDetails.forEach(detail => {
    const mongoSongKey = createSongKey(detail.title, detail.artist);
    
    // 구글시트에 매칭되지 않은 MongoDB 곡들만 추가
    if (!usedMongoSongs.has(mongoSongKey)) {
      mongoOnlySongs.push({
        id: detail._id,              // MongoDB ObjectId를 메인 ID로 사용
        title: detail.title,
        artist: detail.artist,
        language: detail.language || '미설정',
        source: 'mongodb' as const,
        
        // MongoDB 데이터 사용
        lyrics: detail.lyrics || '',
        titleAlias: detail.titleAlias,
        artistAlias: detail.artistAlias,
        searchTags: detail.searchTags,
        sungCount: detail.sungCount,
        lastSungDate: detail.lastSungDate,
        keyAdjustment: detail.keyAdjustment,
        mrLinks: detail.mrLinks,
        selectedMRIndex: detail.selectedMRIndex,
        personalNotes: detail.personalNotes,
        imageUrl: detail.imageUrl,
        dateAdded: detail.createdAt ? detail.createdAt.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      });
      mongoOnlyCounter++;
    }
  });

  const finalSongs = [...mergedSheetSongs, ...mongoOnlySongs];
  
  // 중복 제거: 제목+아티스트(alias 기준) 복합키로 중복된 곡들 제거
  const seenSongKeys = new Set<string>();
  const deduplicatedSongs = finalSongs.filter(song => {
    // alias가 있으면 alias 사용, 없으면 원본 사용
    const displayTitle = song.titleAlias || song.title;
    const displayArtist = song.artistAlias || song.artist;
    const songKey = createSongKey(displayTitle, displayArtist);
    
    if (seenSongKeys.has(songKey)) {
      console.log('🚫 중복 곡 발견, 제거:', displayTitle, '-', displayArtist, '(Key:', songKey, ')');
      return false;
    }
    seenSongKeys.add(songKey);
    return true;
  });
  
  console.log('🔍 최종 병합 결과:', {
    totalSongs: finalSongs.length,
    afterDeduplication: deduplicatedSongs.length,
    duplicatesRemoved: finalSongs.length - deduplicatedSongs.length,
    sheetOnly: deduplicatedSongs.filter(s => s.source === 'sheet').length,
    merged: deduplicatedSongs.filter(s => s.source === 'merged').length,
    mongoOnly: deduplicatedSongs.filter(s => s.source === 'mongodb').length,
  });

  return deduplicatedSongs;
}

function parseSheetData(values: string[][]): Song[] {
  if (!values || values.length < 1) return [];

  const firstRow = values[0].map(h => (h || '').toLowerCase().trim());
  
  // 헤더에서 각 컬럼의 인덱스를 찾습니다
  const getColumnIndex = (possibleNames: string[]) => {
    for (const name of possibleNames) {
      const index = firstRow.findIndex(h => h.includes(name));
      if (index !== -1) return index;
    }
    return -1;
  };

  const titleIndex = getColumnIndex(['제목', 'title', '곡명', '노래']); // 제목 컬럼
  const artistIndex = getColumnIndex(['아티스트', 'artist', '가수', '원곡자']); // 아티스트 컬럼

  // 헤더가 감지되었는지 확인 - 실제 헤더 텍스트가 있으면 헤더로 간주
  // 'abir', 'tango' 같은 실제 데이터는 헤더가 아님
  const hasRealHeader = (titleIndex !== -1 && artistIndex !== -1) && 
    !(firstRow.length === 2 && firstRow.every(cell => cell.length < 10 && !cell.includes('제목') && !cell.includes('title')));
  
  // 헤더가 있으면 첫 번째 행을 건너뛰고, 없으면 모든 행을 데이터로 처리
  const dataRows = hasRealHeader ? values.slice(1) : values;

  console.log('🔍 구글시트 헤더 분석:', {
    firstRow: firstRow,
    hasRealHeader: hasRealHeader,
    titleIndex: titleIndex,
    artistIndex: artistIndex,
    totalRows: values.length,
    dataRows: dataRows.length
  });

  console.log('🔍 첫 번째 데이터 행 샘플:', dataRows[0]);

  return dataRows
    .filter(row => row.length > 0 && (row[titleIndex] || row[0])) // 빈 행 제외
    .map((row, index) => {
      // 컬럼이 제대로 감지되지 않은 경우 기본 순서 사용
      let title, artist;
      
      if (hasRealHeader && titleIndex !== -1 && artistIndex !== -1) {
        // 헤더가 있고 컬럼이 제대로 감지된 경우
        title = row[titleIndex] || 'Unknown Title';
        artist = row[artistIndex] || 'Unknown Artist';
      } else {
        // 헤더가 없거나 컬럼 감지 실패 시 실제 구글시트 구조: 첫 번째 컬럼=아티스트, 두 번째 컬럼=제목
        artist = row[0] || 'Unknown Artist';  // 첫 번째 컬럼 = 아티스트  
        title = row[1] || 'Unknown Title';    // 두 번째 컬럼 = 제목
      }

      // 디버깅: 처음 몇 개만 출력
      if (index < 3) {
        console.log(`🔍 Row ${index + 1}:`, {
          raw: row.slice(0, 4),
          parsed: { title, artist }
        });
      }

      const song: Song = {
        id: `song-${index + 1}`,
        title: title.trim(),
        artist: artist.trim(),
        language: 'Korean', // 기본값, MongoDB에서 덮어씀
        dateAdded: new Date().toISOString().split('T')[0], // 기본값
        source: 'sheet' as const, // 구글시트 데이터 표시
      };
      return song;
    })
    .filter(song => {
      // 중복으로 인한 문제가 되는 곡들을 하드코딩으로 제외
      const problematicSongs = [
        { title: 'gods', artist: '뉴진스' },
        { title: 'sugarcoat', artist: '키스오브라이프' },
        { title: '나는 최강', artist: 'ado' },
        { title: '타상연화', artist: '요네즈 켄시' },
        { title: '아이돌', artist: '최애의 아이 ost' }
      ];
      
      const normalizedTitle = song.title.toLowerCase().replace(/\s/g, '');
      const normalizedArtist = song.artist.toLowerCase().replace(/\s/g, '');
      
      const isProblematic = problematicSongs.some(problematic => {
        const problemTitle = problematic.title.toLowerCase().replace(/\s/g, '');
        const problemArtist = problematic.artist.toLowerCase().replace(/\s/g, '');
        return normalizedTitle === problemTitle && normalizedArtist === problemArtist;
      });
      
      if (isProblematic) {
        console.log(`🚫 문제 곡 시트에서 제외: ${song.title} - ${song.artist}`);
        return false;
      }
      
      return true;
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