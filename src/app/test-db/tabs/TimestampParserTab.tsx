'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  PlayIcon, 
  PlusIcon, 
  ExclamationTriangleIcon,
  CheckIcon,
  ClockIcon,
  MusicalNoteIcon,
  MagnifyingGlassIcon,
  PauseIcon,
  ForwardIcon,
  BackwardIcon,
  ArrowRightIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline';

// YouTube API 타입 정의
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

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
  
  // 클립 설명 템플릿 관리
  const [descriptionTemplate, setDescriptionTemplate] = useState('타임스탬프 파서로 자동 등록');
  const [showDescriptionEditor, setShowDescriptionEditor] = useState(false);
  
  // 클립 미리보기
  const [previewClip, setPreviewClip] = useState<ParsedTimestamp | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  
  // 클립 편집
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editDescription, setEditDescription] = useState('');

  // YouTube 플레이어 관련 상태
  const youtubePlayerRef = useRef<any>(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // 전체 곡 목록 로드 함수
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

  // 초기 로드
  useEffect(() => {
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

  // 클립 미리보기 시작
  const startPreview = (timestamp: ParsedTimestamp) => {
    setPreviewClip(timestamp);
    setEditStartTime(timestamp.time);
    setEditEndTime(timestamp.endTime ? secondsToTime(timestamp.endTime) : '');
    setEditDescription(descriptionTemplate);
    setShowPreview(true);
  };

  // 미리보기 닫기
  const closePreview = () => {
    setShowPreview(false);
    setPreviewClip(null);
    setEditStartTime('');
    setEditEndTime('');
    setEditDescription('');
    
    // 플레이어 상태 초기화
    setIsPlayerReady(false);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    
    // 플레이어 인스턴스 정리
    if (youtubePlayerRef.current && youtubePlayerRef.current.destroy) {
      youtubePlayerRef.current.destroy();
      youtubePlayerRef.current = null;
    }
  };

  // 편집 내용 저장 (parsedTimestamps 업데이트)
  const saveClipEdits = () => {
    if (!previewClip) return;
    
    const updatedTimestamps = parsedTimestamps.map((timestamp, index) => {
      if (timestamp === previewClip) {
        const newStartTime = timeToSeconds(editStartTime);
        const newEndTime = editEndTime.trim() ? timeToSeconds(editEndTime) : undefined;
        
        return {
          ...timestamp,
          time: editStartTime,
          startTime: newStartTime,
          endTime: newEndTime
        };
      }
      return timestamp;
    });
    
    setParsedTimestamps(updatedTimestamps);
    setDescriptionTemplate(editDescription); // 설명 템플릿도 업데이트
    closePreview();
  };

  // YouTube 플레이어 이벤트 핸들러
  const onPlayerReady = useCallback((event: any) => {
    youtubePlayerRef.current = event.target;
    setIsPlayerReady(true);
    setDuration(event.target.getDuration() || 0);
    // 편집된 시작 시간으로 이동
    const startSeconds = timeToSeconds(editStartTime);
    if (startSeconds > 0) {
      event.target.seekTo(startSeconds, true);
    }
  }, [editStartTime]);

  const onPlayerStateChange = useCallback((event: any) => {
    const playerState = event.data;
    setIsPlaying(playerState === 1); // 1 = playing
    
    if (playerState === 1) {
      // 재생 시작 시 현재 시간 업데이트 시작
      const updateTime = () => {
        if (youtubePlayerRef.current && isPlayerReady) {
          const currentTime = youtubePlayerRef.current.getCurrentTime();
          setCurrentTime(currentTime);
        }
      };
      updateTime();
    }
  }, [isPlayerReady]);

  // 현재 시간 실시간 업데이트 및 종료시간 체크
  useEffect(() => {
    if (!isPlayerReady) return;

    const interval = setInterval(() => {
      if (youtubePlayerRef.current && typeof youtubePlayerRef.current.getCurrentTime === 'function') {
        try {
          const time = youtubePlayerRef.current.getCurrentTime();
          setCurrentTime(time);
          
          // 종료시간 체크 (편집된 종료시간이 있는 경우)
          if (editEndTime.trim() && isPlaying) {
            const endSeconds = timeToSeconds(editEndTime);
            if (time >= endSeconds) {
              youtubePlayerRef.current.pauseVideo();
            }
          }
        } catch (error) {
          console.warn('getCurrentTime failed:', error);
        }
      }
    }, isPlaying ? 100 : 500); // 재생 중이면 100ms, 정지 중이면 500ms 간격

    return () => clearInterval(interval);
  }, [isPlaying, isPlayerReady, editEndTime]);

  // YouTube API 로드 및 플레이어 초기화 (미리보기 모달용)
  useEffect(() => {
    if (!showPreview || !videoUrl || !previewClip) return;

    // YouTube API 스크립트 로드
    const loadYouTubeAPI = () => {
      if (window.YT && window.YT.Player) {
        initializePlayer();
        return;
      }

      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        script.async = true;
        document.head.appendChild(script);
      }

      window.onYouTubeIframeAPIReady = initializePlayer;
    };

    const initializePlayer = () => {
      const videoId = extractVideoId(videoUrl);
      if (!videoId) return;

      const playerId = 'preview-youtube-player';
      const playerElement = document.getElementById(playerId);
      
      if (!playerElement) return;

      // 기존 플레이어 정리
      if (youtubePlayerRef.current && youtubePlayerRef.current.destroy) {
        youtubePlayerRef.current.destroy();
      }

      // 새 플레이어 생성
      youtubePlayerRef.current = new window.YT.Player(playerId, {
        videoId: videoId,
        height: '100%',
        width: '100%',
        playerVars: {
          autoplay: 0,
          controls: 1,
          modestbranding: 1,
          rel: 0,
          showinfo: 0,
        },
        events: {
          onReady: onPlayerReady,
          onStateChange: onPlayerStateChange,
        },
      });
    };

    loadYouTubeAPI();

    // 컴포넌트 언마운트 시 플레이어 정리
    return () => {
      if (youtubePlayerRef.current && youtubePlayerRef.current.destroy) {
        youtubePlayerRef.current.destroy();
      }
    };
  }, [showPreview, videoUrl, previewClip, onPlayerReady, onPlayerStateChange]);

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

  // 시간을 hh:mm:ss 형식으로 변환 (플레이어 표시용)
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
  };

  // YouTube 플레이어 제어 함수들
  const seekToTime = useCallback((seconds: number) => {
    if (youtubePlayerRef.current && isPlayerReady) {
      const newTime = Math.max(0, Math.min(duration, seconds));
      youtubePlayerRef.current.seekTo(newTime, true);
    }
  }, [isPlayerReady, duration]);

  const togglePlayPause = useCallback(() => {
    if (!youtubePlayerRef.current || !isPlayerReady) return;
    
    if (isPlaying) {
      youtubePlayerRef.current.pauseVideo();
    } else {
      youtubePlayerRef.current.playVideo();
    }
  }, [isPlaying, isPlayerReady]);

  const seekRelative = useCallback((seconds: number) => {
    if (youtubePlayerRef.current && isPlayerReady && typeof youtubePlayerRef.current.getCurrentTime === 'function') {
      try {
        const actualCurrentTime = youtubePlayerRef.current.getCurrentTime();
        seekToTime(actualCurrentTime + seconds);
        // 상태도 즉시 업데이트
        setCurrentTime(actualCurrentTime + seconds);
      } catch (error) {
        console.warn('seekRelative failed:', error);
      }
    }
  }, [isPlayerReady, seekToTime]);

  // 현재 시간을 시작/종료시간으로 설정
  const setCurrentAsStart = useCallback(() => {
    if (youtubePlayerRef.current && isPlayerReady && typeof youtubePlayerRef.current.getCurrentTime === 'function') {
      try {
        const actualCurrentTime = youtubePlayerRef.current.getCurrentTime();
        const timeStr = secondsToTime(Math.floor(actualCurrentTime));
        setEditStartTime(timeStr);
        setCurrentTime(actualCurrentTime); // 상태도 업데이트
      } catch (error) {
        console.warn('setCurrentAsStart failed:', error);
      }
    }
  }, [isPlayerReady]);

  const setCurrentAsEnd = useCallback(() => {
    if (youtubePlayerRef.current && isPlayerReady && typeof youtubePlayerRef.current.getCurrentTime === 'function') {
      try {
        const actualCurrentTime = youtubePlayerRef.current.getCurrentTime();
        const timeStr = secondsToTime(Math.floor(actualCurrentTime));
        setEditEndTime(timeStr);
        setCurrentTime(actualCurrentTime); // 상태도 업데이트
      } catch (error) {
        console.warn('setCurrentAsEnd failed:', error);
      }
    }
  }, [isPlayerReady]);

  // 시작시간으로 이동
  const seekToStart = useCallback(() => {
    const startSeconds = timeToSeconds(editStartTime);
    seekToTime(startSeconds);
  }, [editStartTime, seekToTime]);

  // 종료시간 3초 전으로 이동
  const seekToEndMinus3 = useCallback(() => {
    if (editEndTime.trim()) {
      const endSeconds = timeToSeconds(editEndTime);
      seekToTime(Math.max(0, endSeconds - 3));
    }
  }, [editEndTime, seekToTime]);

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
      // 재검증 시 최신 DB 데이터 로드
      console.log('🔄 DB 재검증: 최신 곡 목록 로딩 중...');
      await loadAllSongs();
      
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

  // 라이브 클립 일괄 등록 (클라이언트 중복검사 + 배치 업로드)
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

    if (!confirm(`총 ${matchedTimestamps.length}곡을 라이브 클립으로 등록하시겠습니까?\n\n설명: "${descriptionTemplate}"\n\n(매칭되지 않은 ${parsedTimestamps.length - matchedTimestamps.length}곡은 제외됩니다)`)) {
      return;
    }

    setIsProcessing(true);
    console.log('🚀 새로운 배치 업로드 시작...');

    try {
      // 1단계: 전체 기존 클립 데이터 로드
      console.log('📊 전체 라이브클립 데이터 로딩 중...');
      const existingClipsResponse = await fetch('/api/admin/clips?getAllForDuplicateCheck=true');
      
      if (!existingClipsResponse.ok) {
        throw new Error('기존 클립 데이터를 불러올 수 없습니다.');
      }

      const existingClipsData = await existingClipsResponse.json();
      const existingClips = existingClipsData.clips || [];
      
      console.log(`📊 기존 클립 ${existingClips.length}개 로드 완료 (${existingClipsData.meta?.dataSizeMB || 'N/A'}MB)`);

      // 2단계: 클라이언트에서 중복검사 수행
      console.log('🔍 클라이언트 중복검사 시작...');
      
      const videoData = matchedTimestamps[0]; // 첫 번째 타임스탬프에서 videoId 추출
      const videoIdMatch = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
      const videoId = videoIdMatch ? videoIdMatch[1] : '';
      
      if (!videoId) {
        throw new Error('YouTube URL에서 비디오 ID를 추출할 수 없습니다.');
      }

      const duplicateCheckResults = matchedTimestamps.map((timestamp, index) => {
        const isDuplicate = existingClips.some((existing: any) => 
          existing.videoId === videoId &&
          Math.abs(existing.startTime - timestamp.startTime) <= 30
        );
        
        return {
          ...timestamp,
          isDuplicate,
          originalIndex: index
        };
      });

      const duplicateCount = duplicateCheckResults.filter(item => item.isDuplicate).length;
      const validClips = duplicateCheckResults.filter(item => !item.isDuplicate);

      console.log(`🔍 중복검사 완료: 중복 ${duplicateCount}개, 업로드 대상 ${validClips.length}개`);

      if (validClips.length === 0) {
        alert('모든 클립이 중복되어 업로드할 항목이 없습니다.');
        setResults({ 
          success: 0, 
          failed: 0, 
          errors: [`중복 클립 ${duplicateCount}개가 제외되었습니다.`]
        });
        setIsProcessing(false);
        return;
      }

      // 3단계: 배치 업로드 데이터 준비
      const bulkClipData = validClips.map(timestamp => ({
        songId: timestamp.dbMatch?.songId || '',
        videoUrl: videoUrl,
        sungDate: broadcastDate,
        description: descriptionTemplate,
        startTime: timestamp.startTime,
        endTime: timestamp.endTime
      }));

      // 4단계: 배치 업로드 실행
      console.log('📤 배치 업로드 실행...');
      const bulkUploadResponse = await fetch('/api/admin/clips/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ clips: bulkClipData })
      });

      if (!bulkUploadResponse.ok) {
        const errorData = await bulkUploadResponse.json();
        throw new Error(errorData.error || '배치 업로드에 실패했습니다.');
      }

      const uploadResult = await bulkUploadResponse.json();
      
      // 5단계: 결과 처리
      console.log('✅ 배치 업로드 완료:', uploadResult);
      
      const finalErrors = [];
      if (duplicateCount > 0) {
        finalErrors.push(`중복 클립 ${duplicateCount}개가 사전에 제외되었습니다.`);
      }
      if (uploadResult.results?.errors) {
        finalErrors.push(...uploadResult.results.errors);
      }

      setResults({ 
        success: uploadResult.results?.success || 0, 
        failed: uploadResult.results?.failed || 0, 
        errors: finalErrors
      });

      if (uploadResult.success) {
        alert(uploadResult.message || '배치 업로드가 완료되었습니다.');
      }

    } catch (error) {
      console.error('배치 업로드 오류:', error);
      setResults({ 
        success: 0, 
        failed: matchedTimestamps.length, 
        errors: [error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.']
      });
      alert('배치 업로드 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
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
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowDescriptionEditor(!showDescriptionEditor)}
                    className="px-3 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors text-sm"
                  >
                    📝 설명 설정
                  </button>
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
                </div>
              );
            })()}
          </div>

          {/* 설명 템플릿 설정 패널 */}
          {showDescriptionEditor && (
            <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
              <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-3">
                라이브 클립 설명 설정
              </h4>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-blue-800 dark:text-blue-200 mb-1">
                    모든 클립에 적용될 설명 (여러 줄 입력 가능)
                  </label>
                  <textarea
                    value={descriptionTemplate}
                    onChange={(e) => setDescriptionTemplate(e.target.value)}
                    placeholder="타임스탬프 파서로 자동 등록&#10;&#10;여러 줄로 설명을 작성할 수 있습니다.&#10;각 줄은 자동으로 개행됩니다."
                    rows={4}
                    className="w-full px-3 py-2 border border-blue-300 dark:border-blue-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent text-sm resize-vertical"
                  />
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => setDescriptionTemplate('타임스탬프 파서로 자동 등록')}
                    className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    기본값으로 재설정
                  </button>
                  <button
                    onClick={() => setShowDescriptionEditor(false)}
                    className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
                  >
                    확인
                  </button>
                </div>
              </div>
            </div>
          )}

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
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    미리보기
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
                    <td className="px-4 py-3">
                      <button
                        onClick={() => startPreview(timestamp)}
                        disabled={!videoUrl.trim()}
                        className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors text-xs flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <PlayIcon className="w-3 h-3" />
                        재생
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 클립 미리보기 모달 */}
      {showPreview && previewClip && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={closePreview}>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  클립 미리보기
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {previewClip.artist} - {previewClip.title}
                </p>
              </div>
              <button
                onClick={closePreview}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-4">
              {/* 클립 정보 편집 */}
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">클립 정보 편집</h4>
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* 읽기 전용 정보 */}
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">곡명</label>
                      <input
                        type="text"
                        value={previewClip.dbMatch?.dbTitle || previewClip.title}
                        readOnly
                        className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">아티스트</label>
                      <input
                        type="text"
                        value={previewClip.dbMatch?.dbArtist || previewClip.artist}
                        readOnly
                        className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* 편집 가능한 시간 */}
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">시작 시간</label>
                      <input
                        type="text"
                        value={editStartTime}
                        onChange={(e) => setEditStartTime(e.target.value)}
                        placeholder="4:37:20"
                        className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">종료 시간 (비워두면 끝까지)</label>
                      <input
                        type="text"
                        value={editEndTime}
                        onChange={(e) => setEditEndTime(e.target.value)}
                        placeholder="4:40:31"
                        className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono"
                      />
                    </div>
                  </div>
                  
                  {/* 설명 */}
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">설명</label>
                    <input
                      type="text"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="타임스탬프 파서로 자동 등록"
                      className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                  </div>
                  
                  {/* 읽기 전용 정보 */}
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">방송 날짜</label>
                    <input
                      type="text"
                      value={broadcastDate || '미설정'}
                      readOnly
                      className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300"
                    />
                  </div>
                  
                  {/* 계산된 길이 표시 */}
                  {editStartTime && editEndTime && (
                    <div className="text-xs text-blue-600 dark:text-blue-400">
                      길이: {timeToSeconds(editEndTime) - timeToSeconds(editStartTime)}초
                    </div>
                  )}
                </div>
                
                {/* 저장 버튼 */}
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={saveClipEdits}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
                  >
                    수정사항 저장
                  </button>
                  <button
                    onClick={() => {
                      setEditStartTime(previewClip?.time || '');
                      setEditEndTime(previewClip?.endTime ? secondsToTime(previewClip.endTime) : '');
                      setEditDescription(descriptionTemplate);
                    }}
                    className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors text-sm"
                  >
                    원래대로
                  </button>
                </div>
              </div>

              {/* YouTube 플레이어 */}
              {videoUrl && (
                <div className="space-y-3">
                  <div className="aspect-video">
                    <div
                      id="preview-youtube-player"
                      className="w-full h-full rounded-lg"
                    />
                  </div>
                  
                  {/* 플레이어 컨트롤 패널 */}
                  <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg">
                    {/* 현재 시간 표시 */}
                    <div className="mb-3 text-center">
                      <span className="text-sm font-mono text-gray-700 dark:text-gray-300">
                        현재 시간: {Math.floor(currentTime / 60)}:{String(Math.floor(currentTime % 60)).padStart(2, '0')}
                      </span>
                      {duration > 0 && (
                        <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                          / {Math.floor(duration / 60)}:{String(Math.floor(duration % 60)).padStart(2, '0')}
                        </span>
                      )}
                    </div>
                    
                    {/* 컨트롤 버튼들 */}
                    <div className="flex items-center justify-center gap-2 mb-4">
                      {/* 뒤로 이동 버튼들 */}
                      <button
                        onClick={() => seekRelative(-60)}
                        disabled={!isPlayerReady}
                        className="flex flex-col items-center justify-center w-12 h-12 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title="1분 뒤로"
                      >
                        <BackwardIcon className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                        <span className="text-xs text-gray-600 dark:text-gray-400">1m</span>
                      </button>
                      
                      <button
                        onClick={() => seekRelative(-10)}
                        disabled={!isPlayerReady}
                        className="flex flex-col items-center justify-center w-12 h-12 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title="10초 뒤로"
                      >
                        <BackwardIcon className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                        <span className="text-xs text-gray-600 dark:text-gray-400">10s</span>
                      </button>
                      
                      <button
                        onClick={() => seekRelative(-1)}
                        disabled={!isPlayerReady}
                        className="flex flex-col items-center justify-center w-12 h-12 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title="1초 뒤로"
                      >
                        <BackwardIcon className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                        <span className="text-xs text-gray-600 dark:text-gray-400">1s</span>
                      </button>
                      
                      {/* 재생/일시정지 버튼 */}
                      <button
                        onClick={togglePlayPause}
                        disabled={!isPlayerReady}
                        className="flex items-center justify-center w-14 h-14 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 rounded-full transition-colors"
                        title={isPlaying ? "일시정지" : "재생"}
                      >
                        {isPlaying ? (
                          <PauseIcon className="w-6 h-6 text-white" />
                        ) : (
                          <PlayIcon className="w-6 h-6 text-white" />
                        )}
                      </button>
                      
                      {/* 앞으로 이동 버튼들 */}
                      <button
                        onClick={() => seekRelative(1)}
                        disabled={!isPlayerReady}
                        className="flex flex-col items-center justify-center w-12 h-12 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title="1초 앞으로"
                      >
                        <ForwardIcon className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                        <span className="text-xs text-gray-600 dark:text-gray-400">1s</span>
                      </button>
                      
                      <button
                        onClick={() => seekRelative(10)}
                        disabled={!isPlayerReady}
                        className="flex flex-col items-center justify-center w-12 h-12 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title="10초 앞으로"
                      >
                        <ForwardIcon className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                        <span className="text-xs text-gray-600 dark:text-gray-400">10s</span>
                      </button>
                      
                      <button
                        onClick={() => seekRelative(60)}
                        disabled={!isPlayerReady}
                        className="flex flex-col items-center justify-center w-12 h-12 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title="1분 앞으로"
                      >
                        <ForwardIcon className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                        <span className="text-xs text-gray-600 dark:text-gray-400">1m</span>
                      </button>
                    </div>
                    
                    {/* 시간 설정 및 이동 버튼들 */}
                    <div className="flex items-center justify-center gap-2 flex-wrap">
                      <button
                        onClick={seekToStart}
                        disabled={!isPlayerReady}
                        className="px-3 py-2 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors text-sm font-medium"
                        title="시작시간으로 이동"
                      >
                        시작점
                      </button>
                      
                      <button
                        onClick={setCurrentAsStart}
                        disabled={!isPlayerReady}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
                        title="현재 시간을 시작점으로 설정"
                      >
                        IN
                      </button>
                      
                      <button
                        onClick={setCurrentAsEnd}
                        disabled={!isPlayerReady}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
                        title="현재 시간을 종료점으로 설정"
                      >
                        OUT
                      </button>
                      
                      {editEndTime.trim() && (
                        <button
                          onClick={seekToEndMinus3}
                          disabled={!isPlayerReady}
                          className="px-3 py-2 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors text-sm font-medium"
                          title="종료시간 3초 전으로 이동"
                        >
                          끝-3초
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
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