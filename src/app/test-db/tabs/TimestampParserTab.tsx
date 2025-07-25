'use client';

import { useState, useEffect } from 'react';
import { 
  PlayIcon, 
  PlusIcon, 
  ExclamationTriangleIcon,
  CheckIcon,
  ClockIcon,
  MusicalNoteIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';

interface ParsedTimestamp {
  time: string;
  seconds: number;
  artist: string;
  title: string;
  startTime: number;
  endTime?: number;
  // DB 매칭 정보
  dbMatch?: {
    songId: string;
    dbTitle: string;
    dbArtist: string;
    matched: boolean;
    similarity?: number;
    candidates?: Array<{
      songId: string;
      title: string;
      artist: string;
      similarity: number;
      reason: string;
    }>;
  };
  verified?: boolean;
}

interface VideoInfo {
  url: string;
  videoId: string;
  date: string;
}

export default function TimestampParserTab() {
  const [videoUrl, setVideoUrl] = useState('');
  const [broadcastDate, setBroadcastDate] = useState('');
  const [timestampText, setTimestampText] = useState('');
  const [parsedTimestamps, setParsedTimestamps] = useState<ParsedTimestamp[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationComplete, setVerificationComplete] = useState(false);
  const [results, setResults] = useState<{ success: number; failed: number; errors: string[] }>({
    success: 0,
    failed: 0,
    errors: []
  });
  const [showCandidates, setShowCandidates] = useState<{ [key: number]: boolean }>({});
  const [allSongs, setAllSongs] = useState<any[]>([]);
  const [songsLoaded, setSongsLoaded] = useState(false);
  const [showManualSearch, setShowManualSearch] = useState<{ [key: number]: boolean }>({});
  const [manualSearchQuery, setManualSearchQuery] = useState<{ [key: number]: string }>({});

  // 전체 곡 목록 로드
  useEffect(() => {
    const loadAllSongs = async () => {
      try {
        console.log('🎵 전체 곡 목록 로딩 중...');
        
        // MongoDB의 searchTags만 사용
        const response = await fetch('/api/songdetails?limit=1000');
        const data = await response.json();
        
        if (data.success && data.songs) {
          setAllSongs(data.songs);
          console.log(`📊 ${data.songs.length}곡 로드 완료 (MongoDB)`);
          console.log('📝 첫 번째 곡 searchTags 확인:', data.songs[0]?.searchTags || 'No searchTags');
        }
        
        setSongsLoaded(true);
      } catch (error) {
        console.error('곡 목록 로드 실패:', error);
        setSongsLoaded(true);
      }
    };

    loadAllSongs();
  }, []);

  // 후보 선택 함수
  const selectCandidate = (timestampIndex: number, candidateIndex: number) => {
    const newTimestamps = [...parsedTimestamps];
    const timestamp = newTimestamps[timestampIndex];
    
    if (timestamp.dbMatch?.candidates && timestamp.dbMatch.candidates[candidateIndex]) {
      const selectedCandidate = timestamp.dbMatch.candidates[candidateIndex];
      timestamp.dbMatch = {
        songId: selectedCandidate.songId,
        dbTitle: selectedCandidate.title,
        dbArtist: selectedCandidate.artist,
        matched: true,
        similarity: selectedCandidate.similarity,
        candidates: timestamp.dbMatch.candidates
      };
    }
    
    setParsedTimestamps(newTimestamps);
    
    // 후보 목록 숨기기
    setShowCandidates(prev => ({ ...prev, [timestampIndex]: false }));
  };

  // 수동 검색 함수
  const performManualSearch = async (timestampIndex: number) => {
    const query = manualSearchQuery[timestampIndex];
    if (!query || !query.trim()) {
      alert('검색어를 입력해주세요.');
      return;
    }

    const timestamp = parsedTimestamps[timestampIndex];
    console.log(`🔍 수동 검색: "${query}"`);

    // 수동 검색어로 DB 검색 (전체를 제목으로 검색)
    const result = await searchSongInDB(query, '');

    const newTimestamps = [...parsedTimestamps];
    
    // 수동 검색 결과는 무조건 후보로 제시 (매칭되지 않은 상태로)
    newTimestamps[timestampIndex] = {
      ...timestamp,
      dbMatch: {
        songId: '',
        dbTitle: '',
        dbArtist: '',
        matched: false, // 수동 검색은 무조건 후보 선택 단계로
        similarity: 0,
        candidates: result.candidates || []
      },
      verified: true
    };

    setParsedTimestamps(newTimestamps);
    
    // 수동 검색 창 닫기
    setShowManualSearch(prev => ({ ...prev, [timestampIndex]: false }));
    setManualSearchQuery(prev => ({ ...prev, [timestampIndex]: '' }));
  };

  // YouTube URL에서 비디오 ID 추출
  const extractVideoId = (url: string): string => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
    return match ? match[1] : '';
  };

  // 시간 문자열을 초로 변환
  const timeToSeconds = (timeStr: string): number => {
    const parts = timeStr.split(':').map(p => parseInt(p, 10));
    if (parts.length === 2) {
      // MM:SS
      return parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
      // HH:MM:SS
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return 0;
  };

  // 초를 시간 문자열로 변환
  const secondsToTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
  };

  // 문자열 유사도 계산 (Levenshtein Distance 기반)
  const calculateSimilarity = (str1: string, str2: string): number => {
    if (str1 === str2) return 1.0;
    if (!str1 || !str2) return 0;
    
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix: number[][] = [];
    
    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,      // deletion
          matrix[i][j - 1] + 1,      // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );
      }
    }
    
    const maxLen = Math.max(len1, len2);
    return (maxLen - matrix[len1][len2]) / maxLen;
  };

  // 타임스탬프 텍스트 파싱
  const parseTimestamps = () => {
    if (!timestampText.trim()) {
      alert('타임스탬프 텍스트를 입력해주세요.');
      return;
    }

    const lines = timestampText.split('\n').filter(line => line.trim());
    const timestamps: ParsedTimestamp[] = [];
    
    for (const line of lines) {
      // 시간 패턴 매칭: MM:SS 또는 HH:MM:SS
      const timeMatch = line.match(/(\d{1,2}:\d{2}(?::\d{2})?)/);
      if (!timeMatch) continue;

      const timeStr = timeMatch[1];
      const seconds = timeToSeconds(timeStr);
      
      // 시간 이후 텍스트에서 아티스트와 제목 추출
      const afterTime = line.substring(line.indexOf(timeStr) + timeStr.length).trim();
      
      // " - " 또는 " – " 등으로 아티스트와 제목 분리
      const separatorMatch = afterTime.match(/^(.+?)\s*[-–]\s*(.+)$/);
      
      if (separatorMatch) {
        const artist = separatorMatch[1].trim();
        const title = separatorMatch[2].trim();
        
        timestamps.push({
          time: timeStr,
          seconds,
          artist,
          title,
          startTime: seconds
        });
      }
    }

    // 종료 시간 설정 (다음 곡의 시작 시간을 현재 곡의 종료 시간으로)
    for (let i = 0; i < timestamps.length - 1; i++) {
      timestamps[i].endTime = timestamps[i + 1].startTime;
    }

    setParsedTimestamps(timestamps);
    console.log('📋 파싱된 타임스탬프:', timestamps);
  };

  // DB에서 노래 검색 (유사도 기반 + 후보 제안)
  const searchSongInDB = async (title: string, artist: string) => {
    try {
      // 미리 로드된 전체 곡 목록 사용
      if (!songsLoaded || allSongs.length === 0) {
        console.log('⚠️ 곡 목록이 아직 로드되지 않았습니다.');
        return {
          songId: '',
          dbTitle: '',
          dbArtist: '',
          matched: false,
          similarity: 0,
          candidates: []
        };
      }
      
      if (allSongs.length > 0) {
        // 텍스트 정규화: 띄어쓰기, 대소문자, 특수문자를 완전히 무시
        const normalizeText = (text: string) => 
          text.toLowerCase()
              .replace(/\s+/g, '')  // 모든 공백 제거
              .replace(/[-_\.·,]/g, '')  // 하이픈, 언더스코어, 점, 중점, 쉼표 제거
              .replace(/[^\w가-힣]/g, '')  // 특수문자 제거 (영문, 숫자, 한글만 남김)
              .replace(/[ａ-ｚＡ-Ｚ０-９]/g, (match) => {  // 전각 영숫자를 반각으로 변환
                return String.fromCharCode(match.charCodeAt(0) - 0xFEE0);
              })
        
        const searchTitle = normalizeText(title);
        const searchArtist = normalizeText(artist);
        
        console.log(`🔍 검색 정규화: "${title}" -> "${searchTitle}", "${artist}" -> "${searchArtist}"`);
        
        // 모든 곡에 대해 유사도 계산
        const candidates = allSongs.map((song: any) => {
          // 기본 제목과 아티스트
          const songTitle = normalizeText(song.title || '');
          const songArtist = normalizeText(song.artist || '');
          
          // 별칭들도 포함해서 최고 유사도 계산
          const allTitles = [
            songTitle,
            normalizeText(song.titleAlias || ''),
            normalizeText(song.titleAliasKor || ''),
            normalizeText(song.titleAliasEng || '')
          ].filter(t => t);
          
          const allArtists = [
            songArtist,
            normalizeText(song.artistAlias || ''),
            normalizeText(song.artistAliasKor || ''),
            normalizeText(song.artistAliasEng || '')
          ].filter(a => a);
          
          // MongoDB의 searchTags만 사용
          const searchTags = song.searchTags || [];
          
          if (searchTags.length > 0) {
            console.log(`🏷️ ${song.artist} - ${song.title} searchTags:`, searchTags);
          }
          
          // 태그에서 정확 일치 여부 체크
          let tagTitleExactMatch = false;
          let tagArtistExactMatch = false;
          let tagTitleMatches = false;
          let tagArtistMatches = false;
          
          for (const tag of searchTags) {
            const normalizedTag = normalizeText(tag);
            
            // 제목 체크
            if (normalizedTag === searchTitle) {
              tagTitleExactMatch = true;
              tagTitleMatches = true;
              console.log(`🏷️ 태그 제목 정확 매칭: "${tag}" -> "${normalizedTag}" (검색: "${searchTitle}")`);
            } else if (normalizedTag.includes(searchTitle) || searchTitle.includes(normalizedTag)) {
              tagTitleMatches = true;
              console.log(`🏷️ 태그 제목 부분 매칭: "${tag}" -> "${normalizedTag}" (검색: "${searchTitle}")`);
            }
            
            // 아티스트 체크
            if (normalizedTag === searchArtist) {
              tagArtistExactMatch = true;
              tagArtistMatches = true;
              console.log(`🏷️ 태그 아티스트 정확 매칭: "${tag}" -> "${normalizedTag}" (검색: "${searchArtist}")`);
            } else if (normalizedTag.includes(searchArtist) || searchArtist.includes(normalizedTag)) {
              tagArtistMatches = true;
              console.log(`🏷️ 태그 아티스트 부분 매칭: "${tag}" -> "${normalizedTag}" (검색: "${searchArtist}")`);
            }
          }
          
          // 최고 유사도 계산 - 완전 일치 우선 체크
          let titleSimilarity = 0;
          let artistSimilarity = 0;
          
          // 제목 유사도 계산 (태그 정확 매칭 우선)
          if (tagTitleExactMatch) {
            titleSimilarity = 1.0;
          } else {
            for (const t of allTitles) {
              if (searchTitle === t) {
                titleSimilarity = 1.0;
                break;
              }
              titleSimilarity = Math.max(titleSimilarity, calculateSimilarity(searchTitle, t));
            }
          }
          
          // 아티스트 유사도 계산 (태그 정확 매칭 우선)
          if (tagArtistExactMatch) {
            artistSimilarity = 1.0;
          } else {
            for (const a of allArtists) {
              if (searchArtist === a) {
                artistSimilarity = 1.0;
                break;
              }
              artistSimilarity = Math.max(artistSimilarity, calculateSimilarity(searchArtist, a));
            }
          }
          
          // 높은 유사도의 경우 디버깅 로그
          if (titleSimilarity > 0.8 || artistSimilarity > 0.8) {
            console.log(`📊 고유사도 매칭: ${song.artist} - ${song.title}`);
            console.log(`   정규화: "${songArtist}" - "${songTitle}"`);
            console.log(`   유사도: 제목 ${(titleSimilarity*100).toFixed(1)}%, 아티스트 ${(artistSimilarity*100).toFixed(1)}%`);
          }
          
          // 태그 매칭이 있으면 유사도 보정
          if (tagTitleMatches) titleSimilarity = Math.max(titleSimilarity, 0.8);
          if (tagArtistMatches) artistSimilarity = Math.max(artistSimilarity, 0.8);
          
          // 제목 우선 전체 유사도 계산 (제목 70%, 아티스트 30%)
          const overallSimilarity = (titleSimilarity * 0.7) + (artistSimilarity * 0.3);
          
          // 매칭 이유 판단 (태그 정확 매칭 우선)
          let reason = '';
          if (tagTitleExactMatch && tagArtistExactMatch) {
            reason = '태그 제목과 아티스트 정확 매칭';
          } else if (tagTitleExactMatch) {
            reason = '태그 제목 정확 매칭';
          } else if (tagArtistExactMatch) {
            reason = '태그 아티스트 정확 매칭';
          } else if (titleSimilarity >= 0.9 && artistSimilarity >= 0.8) {
            reason = '제목과 아티스트 정확 매칭';
          } else if (titleSimilarity >= 0.9) {
            reason = '제목 정확 매칭';
          } else if (titleSimilarity >= 0.7 && artistSimilarity >= 0.8) {
            reason = '제목 유사, 아티스트 매칭';
          } else if (titleSimilarity >= 0.7) {
            reason = '제목 유사 매칭';
          } else if (artistSimilarity >= 0.9 && titleSimilarity >= 0.3) {
            reason = '아티스트 정확 매칭';
          } else if (tagTitleMatches || tagArtistMatches) {
            reason = '태그 부분 매칭';
          } else {
            reason = '부분 매칭';
          }
          
          return {
            songId: song._id,
            title: song.title,
            artist: song.artist,
            similarity: overallSimilarity,
            titleSimilarity,
            artistSimilarity,
            reason
          };
        }).filter(candidate => 
          // 개선된 필터링 조건:
          // 1. 제목 유사도 60% 이상 (제목이 어느 정도는 유사해야 함)
          // 2. 그리고 다음 중 하나:
          //    - 전체 유사도 70% 이상
          //    - 제목 80% 이상 (아티스트 상관없이)
          //    - 아티스트 90% 이상이면서 제목 30% 이상
          candidate.titleSimilarity >= 0.6 && (
            candidate.similarity >= 0.7 || 
            candidate.titleSimilarity >= 0.8 ||
            (candidate.artistSimilarity >= 0.9 && candidate.titleSimilarity >= 0.3)
          )
        ).sort((a, b) => {
          // 정렬 우선순위: 1) 제목 유사도, 2) 전체 유사도
          if (Math.abs(a.titleSimilarity - b.titleSimilarity) > 0.1) {
            return b.titleSimilarity - a.titleSimilarity;
          }
          return b.similarity - a.similarity;
        });
        
        console.log(`🔍 검색: "${artist} - ${title}" → ${candidates.length}개 후보`);
        console.log(`정규화된 검색어: "${searchArtist}" - "${searchTitle}"`);
        
        if (candidates.length > 0) {
          const bestMatch = candidates[0];
          
          // 95% 이상 유사하면 자동 매칭, 그 외에는 후보로 제시
          const isAutoMatch = bestMatch.similarity >= 0.95;
          
          console.log(`최고 후보: ${bestMatch.artist} - ${bestMatch.title} (유사도: ${(bestMatch.similarity * 100).toFixed(1)}%)`);
          
          return {
            songId: bestMatch.songId,
            dbTitle: bestMatch.title,
            dbArtist: bestMatch.artist,
            matched: isAutoMatch,
            similarity: bestMatch.similarity,
            candidates: candidates.slice(0, 5) // 상위 5개 후보만
          };
        }
      }
      
      return {
        songId: '',
        dbTitle: '',
        dbArtist: '',
        matched: false,
        similarity: 0,
        candidates: []
      };
    } catch (error) {
      console.error('노래 검색 오류:', error);
      return {
        songId: '',
        dbTitle: '',
        dbArtist: '',
        matched: false,
        similarity: 0,
        candidates: []
      };
    }
  };

  // 파싱된 데이터를 DB와 대조하여 검증
  const verifyWithDB = async () => {
    if (parsedTimestamps.length === 0) {
      alert('먼저 타임스탬프를 파싱해주세요.');
      return;
    }

    setIsVerifying(true);
    setVerificationComplete(false);

    try {
      const verifiedTimestamps = await Promise.all(
        parsedTimestamps.map(async (timestamp) => {
          const dbMatch = await searchSongInDB(timestamp.title, timestamp.artist);
          return {
            ...timestamp,
            dbMatch,
            verified: true
          };
        })
      );

      setParsedTimestamps(verifiedTimestamps);
      setVerificationComplete(true);
      console.log('🔍 DB 검증 완료:', verifiedTimestamps);
    } catch (error) {
      console.error('DB 검증 오류:', error);
      alert('DB 검증 중 오류가 발생했습니다.');
    } finally {
      setIsVerifying(false);
    }
  };

  // 라이브 클립 일괄 등록
  const bulkCreateClips = async () => {
    if (!videoUrl.trim() || !broadcastDate) {
      alert('YouTube URL과 방송 날짜를 입력해주세요.');
      return;
    }

    if (parsedTimestamps.length === 0) {
      alert('먼저 타임스탬프를 파싱해주세요.');
      return;
    }

    if (!verificationComplete) {
      alert('먼저 DB 검증을 완료해주세요.');
      return;
    }

    // DB에서 매칭된 곡들만 필터링
    const matchedTimestamps = parsedTimestamps.filter(t => t.dbMatch?.matched);
    
    if (matchedTimestamps.length === 0) {
      alert('DB에서 매칭된 곡이 없습니다.');
      return;
    }

    if (!confirm(`총 ${matchedTimestamps.length}곡을 라이브 클립으로 등록하시겠습니까?\n(매칭되지 않은 ${parsedTimestamps.length - matchedTimestamps.length}곡은 제외됩니다)`)) {
      return;
    }

    setIsProcessing(true);
    const errors: string[] = [];
    let successCount = 0;
    let failedCount = 0;

    for (const timestamp of matchedTimestamps) {
      try {
        if (!timestamp.dbMatch?.songId) {
          errors.push(`노래 ID 없음: ${timestamp.artist} - ${timestamp.title}`);
          failedCount++;
          continue;
        }

        // 라이브 클립 등록
        const response = await fetch(`/api/songs/${timestamp.dbMatch.songId}/videos`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            videoUrl: videoUrl,
            sungDate: broadcastDate,
            description: `타임스탬프 파서로 자동 등록 (${timestamp.time})`,
            startTime: timestamp.startTime,
            endTime: timestamp.endTime
          })
        });

        if (response.ok) {
          successCount++;
          console.log(`✅ 등록 성공: ${timestamp.artist} - ${timestamp.title}`);
        } else {
          const errorData = await response.json();
          errors.push(`등록 실패: ${timestamp.artist} - ${timestamp.title} (${errorData.error})`);
          failedCount++;
        }

        // API 부하 방지를 위한 딜레이
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error('클립 등록 오류:', error);
        errors.push(`오류: ${timestamp.artist} - ${timestamp.title}`);
        failedCount++;
      }
    }

    setResults({ success: successCount, failed: failedCount, errors });
    setIsProcessing(false);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <ClockIcon className="w-6 h-6 text-light-accent dark:text-dark-accent" />
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            타임스탬프 파서
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            다시보기 댓글의 타임스탬프를 파싱하여 라이브 클립을 일괄 등록합니다.
          </p>
        </div>
      </div>

      {/* 입력 섹션 */}
      <div className="space-y-4">
        {/* YouTube URL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            YouTube 다시보기 URL
          </label>
          <input
            type="url"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent focus:border-transparent"
          />
        </div>

        {/* 방송 날짜 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            방송 날짜
          </label>
          <input
            type="date"
            value={broadcastDate}
            onChange={(e) => setBroadcastDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent focus:border-transparent"
          />
        </div>

        {/* 타임스탬프 텍스트 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            타임스탬프 댓글
          </label>
          <textarea
            value={timestampText}
            onChange={(e) => setTimestampText(e.target.value)}
            placeholder="9:57 새소년 - 난춘&#10;14:08 이무진 - 청춘만화&#10;16:12 플레이브 - Pump Up The Volume!&#10;..."
            rows={10}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent focus:border-transparent resize-none font-mono text-sm"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            형식: "9:57 새소년 - 난춘" 또는 "01:01:19 Tones And I - Dance Monkey"
          </p>
        </div>

        {/* 버튼들 */}
        <div className="flex gap-3">
          <button
            onClick={parseTimestamps}
            disabled={!timestampText.trim()}
            className="px-4 py-2 bg-light-accent dark:bg-dark-accent text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <MusicalNoteIcon className="w-4 h-4" />
            1. 타임스탬프 파싱
          </button>
          
          {parsedTimestamps.length > 0 && (
            <button
              onClick={verifyWithDB}
              disabled={isVerifying || !songsLoaded}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isVerifying ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  DB 검증 중...
                </>
              ) : !songsLoaded ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  곡 목록 로딩 중...
                </>
              ) : verificationComplete ? (
                <>
                  <MagnifyingGlassIcon className="w-4 h-4" />
                  2. DB 재검증 ({allSongs.length}곡)
                </>
              ) : (
                <>
                  <MagnifyingGlassIcon className="w-4 h-4" />
                  2. DB 검증 ({allSongs.length}곡)
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* 파싱 결과 */}
      {parsedTimestamps.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              파싱 결과 ({parsedTimestamps.length}곡)
            </h3>
            {verificationComplete && (() => {
              const matchedCount = parsedTimestamps.filter(t => t.dbMatch?.matched).length;
              const isDisabled = isProcessing || !videoUrl.trim() || !broadcastDate || matchedCount === 0;
              
              console.log('🎬 일괄등록 버튼 상태 체크:');
              console.log('  - isProcessing:', isProcessing);
              console.log('  - videoUrl:', videoUrl ? '입력됨' : '비어있음');
              console.log('  - broadcastDate:', broadcastDate ? '입력됨' : '비어있음');
              console.log('  - matchedCount:', matchedCount);
              console.log('  - isDisabled:', isDisabled);
              
              return (
                <button
                  onClick={bulkCreateClips}
                  disabled={isDisabled}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    처리 중...
                  </>
                ) : (
                  <>
                    <PlusIcon className="w-4 h-4" />
                    라이브 클립 일괄 등록 ({parsedTimestamps.filter(t => t.dbMatch?.matched).length}곡)
                  </>
                )}
                </button>
              );
            })()}
          </div>

          <div className="max-h-96 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    시간
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    파싱된 정보
                  </th>
                  {verificationComplete && (
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      DB 매칭 결과
                    </th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    상태
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {parsedTimestamps.map((timestamp, index) => (
                  <tr key={index} className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${
                    verificationComplete && !timestamp.dbMatch?.matched ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''
                  }`}>
                    <td className="px-4 py-3 text-gray-900 dark:text-white font-mono">
                      {timestamp.time}
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <div className="text-gray-900 dark:text-white font-medium">
                          {timestamp.artist} - {timestamp.title}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {secondsToTime(timestamp.startTime)}
                          {timestamp.endTime ? ` → ${secondsToTime(timestamp.endTime)}` : ' → 끝까지'}
                          {timestamp.endTime && (
                            <span className="ml-2 text-green-600 dark:text-green-400">
                              ({timestamp.endTime - timestamp.startTime}초)
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    {verificationComplete && (
                      <td className="px-4 py-3">
                        {timestamp.dbMatch?.matched ? (
                          <div>
                            <div className="text-green-700 dark:text-green-300 font-medium">
                              {timestamp.dbMatch.dbArtist} - {timestamp.dbMatch.dbTitle}
                            </div>
                            <div className="text-xs text-green-600 dark:text-green-400">
                              ✓ DB 매칭됨 
                              {timestamp.dbMatch.similarity && 
                                ` (${(timestamp.dbMatch.similarity * 100).toFixed(1)}%)`}
                            </div>
                            <button
                              onClick={() => setShowManualSearch(prev => ({ 
                                ...prev, 
                                [index]: !prev[index] 
                              }))}
                              className="text-xs text-blue-600 hover:underline mt-1"
                            >
                              직접 검색
                            </button>
                            {showManualSearch[index] && (
                              <div className="mt-2 p-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-xs">
                                <input
                                  type="text"
                                  value={manualSearchQuery[index] || ''}
                                  onChange={(e) => setManualSearchQuery(prev => ({ 
                                    ...prev, 
                                    [index]: e.target.value 
                                  }))}
                                  placeholder="검색어 입력 (예: 새소년 난춘)"
                                  className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs"
                                  onKeyPress={(e) => e.key === 'Enter' && performManualSearch(index)}
                                />
                                <div className="flex gap-1 mt-1">
                                  <button
                                    onClick={() => performManualSearch(index)}
                                    className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                                  >
                                    검색
                                  </button>
                                  <button
                                    onClick={() => setShowManualSearch(prev => ({ 
                                      ...prev, 
                                      [index]: false 
                                    }))}
                                    className="px-2 py-1 bg-gray-500 text-white rounded text-xs hover:bg-gray-600"
                                  >
                                    취소
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : timestamp.dbMatch?.candidates && timestamp.dbMatch.candidates.length > 0 ? (
                          <div>
                            <div className="text-blue-600 dark:text-blue-400">
                              <button
                                onClick={() => setShowCandidates(prev => ({ 
                                  ...prev, 
                                  [index]: !prev[index] 
                                }))}
                                className="text-sm hover:underline"
                              >
                                후보 {timestamp.dbMatch.candidates.length}개 선택
                              </button>
                            </div>
                            {showCandidates[index] && (
                              <div className="mt-2 p-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-xs max-w-xs">
                                {timestamp.dbMatch.candidates.map((candidate, candidateIndex) => (
                                  <div key={candidateIndex} className="mb-1 last:mb-0">
                                    <button
                                      onClick={() => selectCandidate(index, candidateIndex)}
                                      className="text-left w-full hover:bg-gray-100 dark:hover:bg-gray-600 p-1 rounded"
                                    >
                                      <div className="font-medium">
                                        {candidate.artist} - {candidate.title}
                                      </div>
                                      <div className="text-gray-500 dark:text-gray-400">
                                        {candidate.reason} ({(candidate.similarity * 100).toFixed(1)}%)
                                      </div>
                                    </button>
                                  </div>
                                ))}
                                <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                                  <button
                                    onClick={() => setShowManualSearch(prev => ({ 
                                      ...prev, 
                                      [index]: !prev[index] 
                                    }))}
                                    className="text-blue-600 hover:underline"
                                  >
                                    직접 검색
                                  </button>
                                  {showManualSearch[index] && (
                                    <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded">
                                      <input
                                        type="text"
                                        value={manualSearchQuery[index] || ''}
                                        onChange={(e) => setManualSearchQuery(prev => ({ 
                                          ...prev, 
                                          [index]: e.target.value 
                                        }))}
                                        placeholder="검색어 입력 (예: 새소년 난춘)"
                                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs"
                                        onKeyPress={(e) => e.key === 'Enter' && performManualSearch(index)}
                                      />
                                      <div className="flex gap-1 mt-1">
                                        <button
                                          onClick={() => performManualSearch(index)}
                                          className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                                        >
                                          검색
                                        </button>
                                        <button
                                          onClick={() => setShowManualSearch(prev => ({ 
                                            ...prev, 
                                            [index]: false 
                                          }))}
                                          className="px-2 py-1 bg-gray-500 text-white rounded text-xs hover:bg-gray-600"
                                        >
                                          취소
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div>
                            <div className="text-yellow-600 dark:text-yellow-400">
                              <div className="text-sm">매칭 실패</div>
                              <div className="text-xs">DB에서 찾을 수 없음</div>
                            </div>
                            <button
                              onClick={() => setShowManualSearch(prev => ({ 
                                ...prev, 
                                [index]: !prev[index] 
                              }))}
                              className="text-xs text-blue-600 hover:underline mt-1"
                            >
                              직접 검색
                            </button>
                            {showManualSearch[index] && (
                              <div className="mt-2 p-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-xs">
                                <input
                                  type="text"
                                  value={manualSearchQuery[index] || ''}
                                  onChange={(e) => setManualSearchQuery(prev => ({ 
                                    ...prev, 
                                    [index]: e.target.value 
                                  }))}
                                  placeholder="검색어 입력 (예: 새소년 난춘)"
                                  className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs"
                                  onKeyPress={(e) => e.key === 'Enter' && performManualSearch(index)}
                                />
                                <div className="flex gap-1 mt-1">
                                  <button
                                    onClick={() => performManualSearch(index)}
                                    className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                                  >
                                    검색
                                  </button>
                                  <button
                                    onClick={() => setShowManualSearch(prev => ({ 
                                      ...prev, 
                                      [index]: false 
                                    }))}
                                    className="px-2 py-1 bg-gray-500 text-white rounded text-xs hover:bg-gray-600"
                                  >
                                    취소
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      {!timestamp.verified ? (
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-gray-300 rounded-full animate-pulse"></div>
                          <span className="text-xs text-gray-500">대기중</span>
                        </div>
                      ) : timestamp.dbMatch?.matched ? (
                        <div className="flex items-center gap-2">
                          <CheckIcon className="h-4 w-4 text-green-600" />
                          <span className="text-xs text-green-600">준비됨</span>
                        </div>
                      ) : timestamp.dbMatch?.candidates && timestamp.dbMatch.candidates.length > 0 ? (
                        <div className="flex items-center gap-2">
                          <MagnifyingGlassIcon className="h-4 w-4 text-blue-600" />
                          <span className="text-xs text-blue-600">선택대기</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <ExclamationTriangleIcon className="h-4 w-4 text-yellow-600" />
                          <span className="text-xs text-yellow-600">제외됨</span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 결과 섹션 */}
      {(results.success > 0 || results.failed > 0) && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            등록 결과
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
              <div className="flex items-center gap-2">
                <CheckIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
                <span className="text-green-700 dark:text-green-300 font-medium">
                  성공: {results.success}곡
                </span>
              </div>
            </div>
            
            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
              <div className="flex items-center gap-2">
                <ExclamationTriangleIcon className="w-5 h-5 text-red-600 dark:text-red-400" />
                <span className="text-red-700 dark:text-red-300 font-medium">
                  실패: {results.failed}곡
                </span>
              </div>
            </div>
          </div>

          {results.errors.length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-red-700 dark:text-red-300 mb-2">
                오류 목록:
              </h4>
              <ul className="text-sm text-red-600 dark:text-red-400 space-y-1">
                {results.errors.map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}