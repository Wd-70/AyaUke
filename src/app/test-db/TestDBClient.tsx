'use client';

import { useState } from 'react';
import { songDetailApi } from '@/lib/songDetailApi';
import { SongDetail } from '@/types';
import { fetchSongsFromSheet } from '@/lib/googleSheets';

export default function TestDBClient() {
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [testData] = useState<Partial<SongDetail>>({
    title: '좋은 날',
    artist: '아이유',
    titleAlias: 'Good Day',
    artistAlias: 'IU',
    language: 'Korean',
    lyrics: '정말 좋은 날이야...',
    searchTags: ['발라드', '감성', '명곡'],
    keyAdjustment: 2,
    isFavorite: true,
    mrLinks: [
      {
        url: 'https://youtube.com/watch?v=test1',
        skipSeconds: 10,
        label: '공식 MR',
        duration: '3:45'
      },
      {
        url: 'https://youtube.com/watch?v=test2',
        skipSeconds: 0,
        label: '피아노 버전',
        duration: '4:12'
      }
    ],
    selectedMRIndex: 0,
    playlists: ['즐겨듣기', '발라드'],
    personalNotes: '키가 높아서 -2키로 부르기'
  });

  const logResult = (operation: string, data: unknown) => {
    const timestamp = new Date().toLocaleTimeString();
    const resultText = `[${timestamp}] ${operation}:\n${JSON.stringify(data, null, 2)}\n\n`;
    setResult(prev => resultText + prev);
  };

  const handleTest = async (operation: string, testFn: () => Promise<unknown>) => {
    setLoading(true);
    try {
      const result = await testFn();
      logResult(`✅ ${operation} SUCCESS`, result);
    } catch (error) {
      logResult(`❌ ${operation} ERROR`, { error: error instanceof Error ? error.message : String(error) });
    }
    setLoading(false);
  };

  const testCreate = () => handleTest('CREATE', async () => {
    return await songDetailApi.createSongDetail(testData as SongDetail);
  });

  const testRead = () => handleTest('READ', async () => {
    return await songDetailApi.getSongDetail(testData.title!);
  });

  const testUpdate = () => handleTest('UPDATE', async () => {
    return await songDetailApi.updateSongDetail({
      title: testData.title!,
      sungCount: 5,
      lastSungDate: '2024-01-15',
      personalNotes: '업데이트된 메모입니다'
    });
  });

  const testDelete = () => handleTest('DELETE', async () => {
    await songDetailApi.deleteSongDetail(testData.title!);
    return { message: 'Deleted successfully' };
  });

  const testGetAll = () => handleTest('READ ALL', async () => {
    return await songDetailApi.getAllSongDetails();
  });

  const testToggleFavorite = () => handleTest('TOGGLE FAVORITE', async () => {
    return await songDetailApi.toggleFavorite(testData.title!);
  });

  const testIncrementSung = () => handleTest('INCREMENT SUNG COUNT', async () => {
    return await songDetailApi.incrementSungCount(testData.title!);
  });

  const testSelectMR = () => handleTest('SELECT MR', async () => {
    return await songDetailApi.selectMR(testData.title!, 1);
  });

  const testAddPlaylist = () => handleTest('ADD TO PLAYLIST', async () => {
    return await songDetailApi.addToPlaylist(testData.title!, '새 플레이리스트');
  });

  const clearResults = () => setResult('');

  // 대량 테스트 데이터 생성
  const generateBulkTestData = (count: number): SongDetail[] => {
    const genres = ['발라드', '댄스', '힙합', 'R&B', '트로트', '팝', '록'];
    const languages = ['Korean', 'English', 'Japanese'];
    const artists = ['아이유', '방탄소년단', '태연', '아이브', '뉴진스', '에스파', '세븐틴', '트와이스'];
    
    return Array.from({ length: count }, (_, i) => ({
      title: `테스트곡 ${i + 1}`,
      artist: artists[i % artists.length],
      titleAlias: `Test Song ${i + 1}`,
      artistAlias: artists[i % artists.length],
      language: languages[i % languages.length],
      lyrics: `이것은 테스트곡 ${i + 1}의 가사입니다...`,
      searchTags: [genres[i % genres.length], '테스트'],
      sungCount: Math.floor(Math.random() * 10),
      lastSungDate: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000)
        .toISOString().split('T')[0],
      keyAdjustment: Math.floor(Math.random() * 25) - 12, // -12 ~ +12
      isFavorite: Math.random() > 0.7,
      mrLinks: [
        {
          url: `https://youtube.com/watch?v=test${i + 1}_1`,
          skipSeconds: Math.floor(Math.random() * 30),
          label: '공식 MR',
          duration: `${Math.floor(Math.random() * 2) + 3}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`
        },
        {
          url: `https://youtube.com/watch?v=test${i + 1}_2`,
          skipSeconds: 0,
          label: '피아노 버전',
          duration: `${Math.floor(Math.random() * 2) + 3}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`
        }
      ],
      selectedMRIndex: Math.floor(Math.random() * 2),
      playlists: i % 3 === 0 ? ['즐겨듣기'] : i % 5 === 0 ? ['발라드', '명곡'] : [],
      personalNotes: i % 4 === 0 ? `곡 ${i + 1}에 대한 개인 메모` : undefined
    }));
  };

  const testBulkCreate = (count: number) => handleTest(`BULK CREATE (${count}개)`, async () => {
    const bulkData = generateBulkTestData(count);
    const results = [];
    
    for (let i = 0; i < bulkData.length; i++) {
      try {
        const result = await songDetailApi.createSongDetail(bulkData[i]);
        results.push({ index: i + 1, success: true, title: result.title });
      } catch (error) {
        results.push({ index: i + 1, success: false, error: error instanceof Error ? error.message : String(error) });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    const failCount = results.length - successCount;
    
    return {
      total: results.length,
      success: successCount,
      failed: failCount,
      details: results
    };
  });

  const testBulkDelete = () => handleTest('BULK DELETE (테스트곡 전체)', async () => {
    const allSongs = await songDetailApi.getAllSongDetails();
    const testSongs = allSongs.filter(song => song.title.startsWith('테스트곡'));
    
    const results = [];
    for (const song of testSongs) {
      try {
        await songDetailApi.deleteSongDetail(song.title);
        results.push({ title: song.title, success: true });
      } catch (error) {
        results.push({ title: song.title, success: false, error: error instanceof Error ? error.message : String(error) });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    
    return {
      deleted: successCount,
      total: testSongs.length,
      details: results
    };
  });

  const testDbStats = () => handleTest('DATABASE STATS', async () => {
    const allSongs = await songDetailApi.getAllSongDetails();
    const favorites = allSongs.filter(song => song.isFavorite);
    const testSongs = allSongs.filter(song => song.title.startsWith('테스트곡'));
    const realSongs = allSongs.filter(song => !song.title.startsWith('테스트곡'));
    
    const languages = allSongs.reduce((acc, song) => {
      acc[song.language || 'Unknown'] = (acc[song.language || 'Unknown'] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return {
      totalSongs: allSongs.length,
      testSongs: testSongs.length,
      realSongs: realSongs.length,
      favorites: favorites.length,
      languageDistribution: languages,
      avgSungCount: allSongs.reduce((sum, song) => sum + (song.sungCount || 0), 0) / allSongs.length
    };
  });

  // 구글시트 동기화 기능
  const testGoogleSheetSync = () => handleTest('GOOGLE SHEET SYNC', async () => {
    try {
      // 1. 구글시트에서 데이터 가져오기
      logResult('📋 구글시트 데이터 읽는 중...', { status: 'fetching' });
      const sheetSongs = await fetchSongsFromSheet();
      
      if (sheetSongs.length === 0) {
        throw new Error('구글시트에서 데이터를 가져올 수 없습니다.');
      }

      logResult('📋 구글시트 데이터 읽기 완료', { 
        count: sheetSongs.length,
        sample: sheetSongs.slice(0, 3).map(s => ({ title: s.title, artist: s.artist }))
      });

      // 2. MongoDB 기존 데이터 확인
      const existingSongs = await songDetailApi.getAllSongDetails();
      const existingTitles = new Set(existingSongs.map(s => s.title));

      // 3. 새로운 곡들만 필터링
      const newSongs = sheetSongs.filter(song => !existingTitles.has(song.title));
      const duplicates = sheetSongs.length - newSongs.length;

      logResult('🔍 중복 확인 완료', {
        total: sheetSongs.length,
        existing: duplicates,
        new: newSongs.length
      });

      if (newSongs.length === 0) {
        return {
          status: 'success',
          message: '모든 곡이 이미 MongoDB에 존재합니다.',
          total: sheetSongs.length,
          new: 0,
          duplicates: duplicates
        };
      }

      // 4. 새로운 곡들을 MongoDB에 저장
      logResult('💾 새로운 곡들을 MongoDB에 저장 중...', { count: newSongs.length });
      
      const results = [];
      for (let i = 0; i < newSongs.length; i++) {
        const song = newSongs[i];
        try {
          // Song 데이터를 SongDetail 형태로 변환
          const songDetail: SongDetail = {
            title: song.title,
            artist: song.artist,
            language: song.language || 'Korean',
            lyrics: song.lyrics || '',
            searchTags: song.tags || [],
            sungCount: 0,
            keyAdjustment: 0,
            isFavorite: false,
            mrLinks: song.mrLinks?.map(link => ({
              url: link,
              skipSeconds: 0,
              label: '구글시트 MR'
            })) || [],
            selectedMRIndex: 0,
            playlists: [],
            personalNotes: ''
          };

          const result = await songDetailApi.createSongDetail(songDetail);
          results.push({ 
            index: i + 1, 
            success: true, 
            title: result.title,
            artist: result.artist 
          });

          // 진행 상황 로깅 (10개마다)
          if ((i + 1) % 10 === 0) {
            logResult(`📝 진행 상황: ${i + 1}/${newSongs.length} 완료`, {
              progress: `${Math.round(((i + 1) / newSongs.length) * 100)}%`
            });
          }
        } catch (error) {
          results.push({ 
            index: i + 1, 
            success: false, 
            title: song.title,
            artist: song.artist,
            error: error instanceof Error ? error.message : String(error) 
          });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failCount = results.length - successCount;

      return {
        status: 'success',
        googleSheetTotal: sheetSongs.length,
        duplicatesSkipped: duplicates,
        newSongsProcessed: newSongs.length,
        savedSuccessfully: successCount,
        failed: failCount,
        details: results.filter(r => !r.success) // 실패한 것들만 상세 표시
      };

    } catch (error) {
      return {
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
        suggestion: '구글시트 API 키와 권한을 확인해주세요.'
      };
    }
  });

  const testGoogleSheetPreview = () => handleTest('GOOGLE SHEET PREVIEW', async () => {
    try {
      const sheetSongs = await fetchSongsFromSheet();
      
      return {
        total: sheetSongs.length,
        preview: sheetSongs.slice(0, 10),
        languages: [...new Set(sheetSongs.map(s => s.language))],
        artists: [...new Set(sheetSongs.map(s => s.artist))].slice(0, 10)
      };
    } catch (error) {
      throw new Error(`구글시트 읽기 실패: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">MongoDB CRUD 테스트</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 테스트 버튼들 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">테스트 작업</h2>
            
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={testCreate}
                  disabled={loading}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                >
                  1. CREATE
                </button>
                <button
                  onClick={testRead}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  2. READ
                </button>
                <button
                  onClick={testUpdate}
                  disabled={loading}
                  className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50"
                >
                  3. UPDATE
                </button>
                <button
                  onClick={testDelete}
                  disabled={loading}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                >
                  4. DELETE
                </button>
              </div>
              
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={testGetAll}
                  disabled={loading}
                  className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                >
                  전체 조회
                </button>
                <button
                  onClick={testToggleFavorite}
                  disabled={loading}
                  className="px-4 py-2 bg-pink-600 text-white rounded hover:bg-pink-700 disabled:opacity-50"
                >
                  좋아요 토글
                </button>
                <button
                  onClick={testIncrementSung}
                  disabled={loading}
                  className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
                >
                  부른 횟수 증가
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={testSelectMR}
                  disabled={loading}
                  className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 disabled:opacity-50"
                >
                  MR 선택 (2번째)
                </button>
                <button
                  onClick={testAddPlaylist}
                  disabled={loading}
                  className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50"
                >
                  플레이리스트 추가
                </button>
              </div>

              {/* 대량 테스트 섹션 */}
              <div className="mt-6 pt-4 border-t">
                <h3 className="font-semibold text-gray-800 mb-3">🚀 대량 데이터 테스트</h3>
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => testBulkCreate(10)}
                      disabled={loading}
                      className="px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 text-sm"
                    >
                      10개 생성
                    </button>
                    <button
                      onClick={() => testBulkCreate(50)}
                      disabled={loading}
                      className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-sm"
                    >
                      50개 생성
                    </button>
                    <button
                      onClick={() => testBulkCreate(100)}
                      disabled={loading}
                      className="px-3 py-2 bg-green-700 text-white rounded hover:bg-green-800 disabled:opacity-50 text-sm"
                    >
                      100개 생성
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={testDbStats}
                      disabled={loading}
                      className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 text-sm"
                    >
                      📊 DB 통계
                    </button>
                    <button
                      onClick={testBulkDelete}
                      disabled={loading}
                      className="px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 text-sm"
                    >
                      🗑️ 테스트곡 전체 삭제
                    </button>
                  </div>
                </div>
              </div>

              {/* 구글시트 동기화 섹션 */}
              <div className="mt-6 pt-4 border-t">
                <h3 className="font-semibold text-gray-800 mb-3">📋 구글시트 동기화</h3>
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={testGoogleSheetPreview}
                      disabled={loading}
                      className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 text-sm"
                    >
                      📖 구글시트 미리보기
                    </button>
                    <button
                      onClick={testGoogleSheetSync}
                      disabled={loading}
                      className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-sm"
                    >
                      🔄 구글시트 → MongoDB 동기화
                    </button>
                  </div>
                  <p className="text-xs text-gray-600">
                    ※ 동기화는 새로운 곡만 추가하며, 기존 곡은 건드리지 않습니다.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="mt-6 pt-4 border-t">
              <button
                onClick={clearResults}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                결과 지우기
              </button>
            </div>
          </div>

          {/* 테스트 데이터 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">테스트 데이터</h2>
            <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto max-h-96">
              {JSON.stringify(testData, null, 2)}
            </pre>
          </div>
        </div>

        {/* 결과 출력 */}
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">테스트 결과</h2>
          {loading && (
            <div className="text-blue-600 mb-4">🔄 처리 중...</div>
          )}
          <pre className="bg-gray-900 text-green-400 p-4 rounded text-sm overflow-auto h-96 whitespace-pre-wrap">
            {result || '테스트 결과가 여기에 표시됩니다...'}
          </pre>
        </div>
      </div>
    </div>
  );
}