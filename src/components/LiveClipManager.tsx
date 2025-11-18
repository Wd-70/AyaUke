'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { SongVideo } from '@/types';
import { 
  PlayIcon, 
  PlusIcon, 
  XMarkIcon, 
  PencilIcon, 
  TrashIcon,
  PauseIcon,
  ForwardIcon,
  BackwardIcon,
  ArrowRightIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline';
import YouTube from 'react-youtube';
import { useSession } from 'next-auth/react';
import { UserRole, roleToIsAdmin } from '@/lib/permissions';
import { updateVideoData } from '@/lib/youtube';
import { useToast } from './Toast';
import { useConfirm } from './ConfirmDialog';
import { parseOriginalDateString, formatOriginalDateForDisplay } from '@/utils/dateUtils';

// YouTube 플레이어 타입 정의
interface YouTubePlayer {
  playVideo(): void;
  pauseVideo(): void;
  getCurrentTime(): number;
  seekTo(seconds: number): void;
  getPlayerState(): number;
}

interface LiveClipManagerProps {
  songId: string;
  songTitle: string;
  songVideos: SongVideo[];
  setSongVideos: (videos: SongVideo[]) => void;
  videosLoading: boolean;
  loadSongVideos: () => Promise<void>;
  onEditingStateChange?: (isEditing: boolean) => void;
}

export default function LiveClipManager({ 
  songId, 
  songTitle, 
  songVideos, 
  setSongVideos, 
  videosLoading, 
  loadSongVideos,
  onEditingStateChange
}: LiveClipManagerProps) {
  const { data: session } = useSession();
  const { showSuccess, showError } = useToast();
  const confirm = useConfirm();
  
  // YouTube URL에서 비디오 ID 추출
  const extractVideoId = (url: string): string => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
    return match ? match[1] : '';
  };

  // YouTube URL에서 시간 파라미터 추출
  const extractTimeFromUrl = (url: string): number => {
    if (!url) return 0;
    
    const timeMatch = url.match(/[?&]t=(\d+)/);
    if (timeMatch) {
      return parseInt(timeMatch[1], 10);
    }
    
    const startMatch = url.match(/[?&]start=(\d+)/);
    if (startMatch) {
      return parseInt(startMatch[1], 10);
    }
    
    return 0;
  };

  // 시간을 hh:mm:ss 형식으로 변환 (소수점 아래 1자리)
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const decimal = Math.floor((seconds % 1) * 10);
    
    const timeStr = hours > 0 
      ? `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}` 
      : `${mins}:${secs.toString().padStart(2, '0')}`;
    
    return `${timeStr}.${decimal}`;
  };
  
  // 라이브 클립 관련 상태 (videos 탭의 상태만 유지)
  const [selectedVideoIndex, setSelectedVideoIndex] = useState(0);
  const [videoPlayer, setVideoPlayer] = useState<YouTubePlayer | null>(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [shouldAutoPlay, setShouldAutoPlay] = useState(false);
  const [showAddVideoForm, setShowAddVideoForm] = useState(false);
  const [addVideoData, setAddVideoData] = useState({
    videoUrl: '',
    endVideoUrl: '', // 종료 시간용 URL
    sungDate: '',
    description: '',
    startTime: 0,
    endTime: undefined as number | undefined
  });
  
  // 영상 메타데이터 상태
  const [videoMetadata, setVideoMetadata] = useState({
    title: '',
    extractedDate: '',
    parsedStartTime: 0,
    parsedEndTime: undefined as number | undefined
  });
  const [isAddingVideo, setIsAddingVideo] = useState(false);
  const [isPlayerMinimized, setIsPlayerMinimized] = useState(false);
  const [editingVideoId, setEditingVideoId] = useState<string | null>(null);
  const [editingVideoData, setEditingVideoData] = useState({
    videoUrl: '',
    sungDate: '',
    description: '',
    startTime: 0,
    endTime: undefined as number | undefined
  });
  const [isEditingVideo, setIsEditingVideo] = useState(false);

  const [durationInput, setDurationInput] = useState('');
  const [isDeletingVideo, setIsDeletingVideo] = useState<string | null>(null);
  const [expandedOverlapInfo, setExpandedOverlapInfo] = useState<string | null>(null);

  // 선택된 영상 정보
  const selectedVideo = songVideos[selectedVideoIndex];

  // 시간 중복 검사 함수
  const checkTimeOverlap = (video1: SongVideo, video2: SongVideo): boolean => {
    // 같은 영상이 아니면 중복 아님
    if (video1.videoId !== video2.videoId) return false;
    
    // 같은 클립이면 중복 아님
    if (video1._id === video2._id) return false;
    
    const start1 = video1.startTime || 0;
    const end1 = video1.endTime || Number.MAX_SAFE_INTEGER; // 종료시간이 없으면 무한대로 처리
    const start2 = video2.startTime || 0;
    const end2 = video2.endTime || Number.MAX_SAFE_INTEGER;
    
    // 시작시간과 종료시간이 정확히 연결되는 경우는 정상 (중복 아님)
    if (end1 === start2 || end2 === start1) return false;
    
    // 중복 구간이 있는지 확인
    return Math.max(start1, start2) < Math.min(end1, end2);
  };

  // 각 영상의 중복 상태를 계산
  const getVideoOverlapInfo = (video: SongVideo) => {
    const overlappingVideos = songVideos.filter((otherVideo: SongVideo) => 
      checkTimeOverlap(video, otherVideo)
    );
    
    return {
      hasOverlap: overlappingVideos.length > 0,
      overlappingVideos,
      overlappingCount: overlappingVideos.length
    };
  };


  // YouTube URL에서 시간 파라미터 제거
  const cleanYouTubeUrl = (url: string): string => {
    if (!url) return url;
    
    // 시간 파라미터들 (&t=, ?t=, &start=, ?start=) 제거
    let cleanedUrl = url.replace(/[?&]t=\d+/g, '');
    cleanedUrl = cleanedUrl.replace(/[?&]start=\d+/g, '');
    
    // 연속된 &를 하나로 정리
    cleanedUrl = cleanedUrl.replace(/&+/g, '&');
    
    // URL 끝의 & 또는 ? 제거
    cleanedUrl = cleanedUrl.replace(/[?&]$/, '');
    
    // ? 뒤에 &가 오는 경우 정리 (?&param -> ?param)
    cleanedUrl = cleanedUrl.replace(/\?&/, '?');
    
    return cleanedUrl;
  };

  // YouTube 제목에서 날짜 추출
  const extractDateFromTitle = (title: string): string => {
    if (!title) return '';
    
    // [YY.MM.DD] 또는 [YYYY.MM.DD] 형식 찾기
    const dateMatch = title.match(/\[(\d{2,4})\.(\d{1,2})\.(\d{1,2})\]/);
    if (dateMatch) {
      let year = parseInt(dateMatch[1], 10);
      const month = parseInt(dateMatch[2], 10);
      const day = parseInt(dateMatch[3], 10);
      
      // 2자리 년도인 경우 20XX로 변환
      if (year < 100) {
        year += 2000;
      }
      
      // YYYY-MM-DD 형식으로 변환
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    
    return '';
  };

  // YouTube API로 영상 메타데이터 가져오기 (제목 추출용)
  const fetchVideoMetadata = async (videoUrl: string) => {
    try {
      const parsedStartTime = extractTimeFromUrl(videoUrl);
      
      // API로 메타데이터 가져오기
      const response = await fetch(`/api/youtube/metadata?url=${encodeURIComponent(videoUrl)}`);
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.success && data.metadata) {
          const metadata = data.metadata;
          
          
          setVideoMetadata(prev => ({
            ...prev,
            title: metadata.title,
            extractedDate: metadata.extractedDate,
            parsedStartTime
          }));
          
          // 자동 감지된 날짜가 있으면 설정
          if (metadata.extractedDate) {
            setAddVideoData(prev => ({
              ...prev,
              sungDate: metadata.extractedDate,
              startTime: parsedStartTime
            }));
          } else {
            setAddVideoData(prev => ({
              ...prev,
              startTime: parsedStartTime
            }));
          }
          
          return;
        }
      }
      
      
      // API 실패 시 기본 파싱만 수행
      setVideoMetadata(prev => ({
        ...prev,
        parsedStartTime
      }));
      
      setAddVideoData(prev => ({
        ...prev,
        startTime: parsedStartTime
      }));
      
    } catch (error) {
      console.error('영상 메타데이터 추출 실패:', error);
      
      // 오류 시에도 시간 파싱은 수행
      const parsedStartTime = extractTimeFromUrl(videoUrl);
      setVideoMetadata(prev => ({
        ...prev,
        parsedStartTime
      }));
      
      setAddVideoData(prev => ({
        ...prev,
        startTime: parsedStartTime
      }));
    }
  };

  // URL 변경 시 자동 파싱
  const handleVideoUrlChange = async (url: string) => {
    setAddVideoData(prev => ({
      ...prev,
      videoUrl: url
    }));
    
    if (url) {
      await fetchVideoMetadata(url);
    }
  };

  // 종료 URL 변경 시 종료 시간 추출
  const handleEndVideoUrlChange = (url: string) => {
    setAddVideoData(prev => ({
      ...prev,
      endVideoUrl: url,
      endTime: url ? extractTimeFromUrl(url) : undefined
    }));
  };

  // 데이터 로드 여부 추적 제거 - 상위 컴포넌트에서 관리

  // 업로더 현재 정보 조회 함수
  const getUploaderInfo = async (userId: string): Promise<{ displayName?: string; channelName?: string; success: boolean }> => {
    try {
      const response = await fetch(`/api/user/${userId}`);
      const result = await response.json();
      
      if (result.success && result.user) {
        return { 
          displayName: result.user.displayName, 
          channelName: result.user.channelName, 
          success: true 
        };
      }
      return { success: false };
    } catch (error) {
      console.error('업로더 정보 조회 실패:', error);
      return { success: false };
    }
  };

  // 업로더 닉네임 동기화 함수
  const syncUploaderName = async (videoId: string): Promise<{ updated: boolean; newName?: string }> => {
    try {
      const response = await fetch(`/api/videos/${videoId}/sync-uploader`, {
        method: 'PATCH',
      });
      const result = await response.json();
      
      if (result.success && result.updated) {
        console.log(`✅ 닉네임 동기화: ${result.previousNickname} → ${result.currentNickname}`);
        return { updated: true, newName: result.currentNickname };
      }
      return { updated: false };
    } catch (error) {
      console.error('닉네임 동기화 실패:', error);
      return { updated: false };
    }
  };

  // 닉네임 동기화는 props로 받은 데이터에 대해서만 수행
  useEffect(() => {
    if (!songVideos || songVideos.length === 0) return;
    
    // 백그라운드에서 닉네임 동기화 처리
    setTimeout(async () => {
      // 업로더별로 그룹핑 (중복 제거)
      const uploaderGroups = new Map<string, { 
        uploaderInfo: { displayName?: string; channelName?: string; success: boolean } | null; 
        videoIndexes: number[]; 
        videoNames: string[];  // 모든 클립의 닉네임들
      }>();
      
      // 업로더별 비디오 그룹핑
      songVideos.forEach((video: SongVideo, index: number) => {
        if (!uploaderGroups.has(video.addedBy)) {
          uploaderGroups.set(video.addedBy, {
            uploaderInfo: null,
            videoIndexes: [],
            videoNames: []
          });
        }
        const group = uploaderGroups.get(video.addedBy)!;
        group.videoIndexes.push(index);
        group.videoNames.push(video.addedByName);
      });
      
      if (uploaderGroups.size === 0) return;
      
      console.log(`🔄 닉네임 동기화 시작: ${uploaderGroups.size}명의 업로더`);
      
      const updatePromises = Array.from(uploaderGroups.entries()).map(async ([uploaderId, group]) => {
        try {
          // 업로더 정보 조회 (업로더당 1회만)  
          const firstVideoName = group.videoNames?.[0] || 'Unknown';
          console.log(`🔍 업로더 "${uploaderId}" (${firstVideoName}) 정보 확인`);
          const uploaderInfo = await getUploaderInfo(uploaderId);
          const currentDisplayName = uploaderInfo.displayName || uploaderInfo.channelName;
          
          if (!uploaderInfo.success || !currentDisplayName) {
            console.log(`⚠️ 업로더 "${uploaderId}" 정보 조회 실패`);
            return;
          }
          
          // 모든 클립의 닉네임과 비교하여 동기화 필요 여부 확인
          const outdatedIndexes: number[] = [];
          const uniqueCurrentNames = [...new Set(group.videoNames || [])];
          
          group.videoIndexes?.forEach((videoIndex, i) => {
            const currentVideoName = group.videoNames?.[i];
            if (currentVideoName !== currentDisplayName) {
              outdatedIndexes.push(videoIndex);
            }
          });
          
          if (outdatedIndexes.length === 0) {
            console.log(`ℹ️ 업로더 "${uploaderId}" 모든 클립 닉네임 최신: "${currentDisplayName}" (${group.videoIndexes.length}개 클립)`);
            return;
          }
          
          console.log(`🔄 닉네임 동기화 필요: 업로더 "${uploaderId}" ${outdatedIndexes.length}/${group.videoIndexes.length}개 클립`);
          uniqueCurrentNames.forEach(oldName => {
            if (oldName !== currentDisplayName) {
              console.log(`   변경: "${oldName}" → "${currentDisplayName}"`);
            }
          });
          
          // 즉시 화면 업데이트 (해당 업로더의 모든 비디오)
          setSongVideos(prevVideos => {
            const updatedVideos = [...prevVideos];
            group.videoIndexes.forEach(index => {
              if (updatedVideos[index] && updatedVideos[index].addedBy === uploaderId) {
                updatedVideos[index] = { ...updatedVideos[index], addedByName: currentDisplayName };
              }
            });
            return updatedVideos;
          });
          
          // DB 동기화 (업데이트가 필요한 클립들만)
          const syncPromises = outdatedIndexes.map(async (index) => {
            try {
              const videoId = songVideos[index]._id;
              const oldName = songVideos[index].addedByName;
              const syncResult = await syncUploaderName(videoId);
              return { 
                videoId, 
                oldName, 
                success: syncResult.updated, 
                error: null 
              };
            } catch (error) {
              return { 
                videoId: songVideos[index]._id, 
                oldName: songVideos[index].addedByName,
                success: false, 
                error 
              };
            }
          });
          
          try {
            const syncResults = await Promise.all(syncPromises);
            const successCount = syncResults.filter(r => r.success).length;
            const totalCount = syncResults.length;
            
            if (successCount > 0) {
              console.log(`✅ 업로더 "${uploaderId}" DB 동기화 완료: ${successCount}/${totalCount}개 클립 업데이트됨 → "${currentDisplayName}"`);
              
              // 성공한 클립들의 이전 닉네임들 표시
              const successResults = syncResults.filter(r => r.success);
              const uniqueOldNames = [...new Set(successResults.map(r => r.oldName))];
              uniqueOldNames.forEach(oldName => {
                console.log(`   "${oldName}" → "${currentDisplayName}"`);
              });
            } else if (totalCount > 0) {
              console.log(`ℹ️ 업로더 "${uploaderId}" DB 동기화: ${totalCount}개 클립 이미 최신 상태 또는 업데이트 불필요`);
            }
            
            // 실패한 클립이 있다면 로그 출력
            const failedResults = syncResults.filter(r => !r.success && r.error);
            if (failedResults.length > 0) {
              console.log(`⚠️ 업로더 "${uploaderId}" 일부 클립 동기화 실패: ${failedResults.length}개`);
              failedResults.forEach(result => {
                console.log(`   실패: ${result.videoId} (${result.oldName})`, result.error);
              });
            }
          } catch (error) {
            console.log(`❌ 업로더 "${uploaderId}" DB 동기화 중 오류:`, error);
          }
          
        } catch (error) {
          console.error(`❌ 업로더 "${uploaderId}" 처리 실패:`, error);
        }
      });
      
      // 모든 업로더 처리 완료 대기 (백그라운드에서)
      await Promise.all(updatePromises);
      console.log('🎯 모든 업로더 동기화 완료');
    }, 0); // 다음 이벤트 루프에서 실행
  }, [songVideos]); // songVideos가 변경될 때만 동기화 수행

  // 관리자 여부 확인
  const isAdmin = (): boolean => {
    if (!session?.user?.isAdmin || !session?.user?.role) return false;
    return roleToIsAdmin(session.user.role as UserRole);
  };

  // 권한 확인 함수 (메모이제이션으로 무한 리렌더링 방지)
  const canEditVideo = useCallback((video: SongVideo): boolean => {
    if (!session || !session.user) return false;
    
    const isOwner = video.addedBy === session.user.userId;
    const isAdminUser = isAdmin();
    
    // 자신이 추가한 클립이거나 관리자인 경우
    return isOwner || isAdminUser;
  }, [session, isAdmin]);

  // 편집 모드 시작
  const startEditVideo = (video: SongVideo) => {
    setEditingVideoId(video._id);
    setEditingVideoData({
      videoUrl: video.videoUrl,
      sungDate: parseOriginalDateString(video.originalDateString, video.sungDate),
      description: video.description || '',
      startTime: video.startTime || 0,
      endTime: video.endTime
    });
  };

  // 편집 취소
  const cancelEditVideo = () => {
    setEditingVideoId(null);
    setEditingVideoData({
      videoUrl: '',
      sungDate: '',
      description: '',
      startTime: 0,
      endTime: undefined
    });
    setDurationInput('');
  };


  // 시간 형식을 초로 변환 (mm:ss.d 또는 h:mm:ss.d 형식 지원)
  const parseTimeToSeconds = (timeStr: string): number => {
    if (!timeStr) return 0;
    
    // 숫자만 있으면 초 단위로 처리
    if (/^\d+$/.test(timeStr)) {
      return parseInt(timeStr) || 0;
    }
    
    // mm:ss.d 또는 h:mm:ss.d 형식 처리
    const timePattern = /^(?:(\d+):)?(\d+):(\d+)(?:\.(\d))?$/;
    const match = timeStr.match(timePattern);
    
    if (match) {
      const hours = parseInt(match[1] || '0') || 0;
      const minutes = parseInt(match[2] || '0') || 0;
      const seconds = parseInt(match[3] || '0') || 0;
      const decimal = parseInt(match[4] || '0') || 0;
      
      return hours * 3600 + minutes * 60 + seconds + decimal / 10;
    }
    
    return 0;
  };

  // 재생시간을 입력받아 종료시간 설정 (시간 형식 지원)
  const handleDurationInputChange = (value: string) => {
    setDurationInput(value);
    const durationSeconds = parseTimeToSeconds(value);
    if (durationSeconds > 0) {
      setEditingVideoData(prev => ({ 
        ...prev, 
        endTime: (prev.startTime || 0) + durationSeconds 
      }));
    }
  };

  // 클립 선택 핸들러 (수정 중일 때 확인)
  const handleVideoSelect = (index: number) => {
    // 편집 중일 때는 아예 이동을 차단
    if (editingVideoId) {
      return; // 아무것도 하지 않음
    }
    
    // 편집 중이 아니면 바로 이동
    setSelectedVideoIndex(index);
  };

  // 편집 중인 영상의 시간 중복 검사
  const getEditingVideoOverlapInfo = () => {
    if (!editingVideoId) return { hasOverlap: false, overlappingVideos: [], overlappingCount: 0 };
    
    const editingVideo = songVideos.find(v => v._id === editingVideoId);
    if (!editingVideo) return { hasOverlap: false, overlappingVideos: [], overlappingCount: 0 };
    
    // 편집 중인 데이터로 임시 비디오 객체 생성
    const tempVideo = {
      ...editingVideo,
      startTime: editingVideoData.startTime,
      endTime: editingVideoData.endTime
    };
    
    const overlappingVideos = songVideos.filter(otherVideo => 
      checkTimeOverlap(tempVideo, otherVideo)
    );
    
    return {
      hasOverlap: overlappingVideos.length > 0,
      overlappingVideos,
      overlappingCount: overlappingVideos.length
    };
  };


  // 편집 모드: 재생시간을 입력받아 종료시간 설정
  const handleEditDurationInputChange = useCallback((value: string) => {
    setDurationInput(value);
    const durationSeconds = parseInt(value) || 0;
    if (durationSeconds > 0) {
      setEditingVideoData(prev => ({ 
        ...prev, 
        endTime: (prev.startTime || 0) + durationSeconds 
      }));
    }
  }, []);


  // 기존 플레이어 제어 함수들 (수정 모드용)
  const seekToTime = useCallback((seconds: number) => {
    if (videoPlayer && typeof videoPlayer.seekTo === 'function') {
      try {
        videoPlayer.seekTo(seconds);
      } catch (e) {
        console.error('시간 이동 실패:', e);
      }
    }
  }, [videoPlayer]);

  const seekRelative = useCallback((seconds: number) => {
    try {
      if (!videoPlayer || typeof videoPlayer.getCurrentTime !== 'function') {
        console.warn('YouTube 플레이어가 준비되지 않았거나 getCurrentTime 메서드가 없습니다.');
        return;
      }
      
      const currentTime = videoPlayer.getCurrentTime();
      seekToTime(currentTime + seconds);
    } catch (e) {
      console.error('상대 시간 이동 실패:', e);
      setVideoPlayer(null); // 오류 시 플레이어 참조 초기화
    }
  }, [videoPlayer, seekToTime]);

  const togglePlayPause = useCallback(() => {
    try {
      if (!videoPlayer || !videoPlayer.playVideo || !videoPlayer.pauseVideo) {
        console.warn('YouTube 플레이어가 준비되지 않았거나 메서드가 없습니다.');
        return;
      }
      
      if (isVideoPlaying) {
        if (typeof videoPlayer.pauseVideo === 'function') {
          videoPlayer.pauseVideo();
        }
      } else {
        if (typeof videoPlayer.playVideo === 'function') {
          videoPlayer.playVideo();
        }
      }
    } catch (e) {
      console.warn('⚠️ 재생/일시정지 실패 (영상에 문제가 있을 수 있음):', e.message);
      // 오류 발생 시 플레이어 참조 초기화
      setVideoPlayer(null);
      setIsVideoPlaying(false);
    }
  }, [videoPlayer, isVideoPlaying]);

  // 현재 재생 시간을 시작 시간으로 설정
  const setCurrentTimeAsStart = useCallback(() => {
    try {
      if (!videoPlayer || typeof videoPlayer.getCurrentTime !== 'function') {
        console.warn('YouTube 플레이어가 준비되지 않았거나 getCurrentTime 메서드가 없습니다.');
        return;
      }
      
      const currentTime = Math.floor(videoPlayer.getCurrentTime());
      setEditingVideoData(prev => ({
        ...prev,
        startTime: currentTime
      }));
    } catch (e) {
      console.error('시작 시간 설정 실패:', e);
      setVideoPlayer(null); // 오류 시 플레이어 참조 초기화
    }
  }, [videoPlayer]);

  // 현재 재생 시간을 종료 시간으로 설정
  const setCurrentTimeAsEnd = useCallback(() => {
    try {
      if (!videoPlayer || typeof videoPlayer.getCurrentTime !== 'function') {
        console.warn('YouTube 플레이어가 준비되지 않았거나 getCurrentTime 메서드가 없습니다.');
        return;
      }
      
      const currentTime = Math.floor(videoPlayer.getCurrentTime());
      setEditingVideoData(prev => ({
        ...prev,
        endTime: currentTime
      }));
    } catch (e) {
      console.error('종료 시간 설정 실패:', e);
      setVideoPlayer(null); // 오류 시 플레이어 참조 초기화
    }
  }, [videoPlayer]);

  // 현재 시간 실시간 업데이트 (수정 모드일 때만)
  useEffect(() => {
    if (!editingVideoId || !isVideoPlaying || !videoPlayer) return;

    const interval = setInterval(() => {
      try {
        if (videoPlayer && typeof videoPlayer.getCurrentTime === 'function') {
          const time = videoPlayer.getCurrentTime();
          setCurrentTime(time);
        }
      } catch (e) {
        console.error('현재 시간 업데이트 실패:', e);
        setVideoPlayer(null); // 오류 시 플레이어 참조 초기화
      }
    }, 100);

    return () => clearInterval(interval);
  }, [editingVideoId, isVideoPlaying, videoPlayer]);

  // 편집 상태 변경을 상위 컴포넌트에 알림
  useEffect(() => {
    if (onEditingStateChange) {
      onEditingStateChange(!!editingVideoId);
    }
  }, [editingVideoId, onEditingStateChange]);

  // 컴포넌트 언마운트 시 videoPlayer 정리
  useEffect(() => {
    return () => {
      setVideoPlayer(null);
    };
  }, []);

  // 선택된 영상이 변경될 때 기존 플레이어 참조 정리
  useEffect(() => {
    setVideoPlayer(null);
    setIsVideoPlaying(false);
  }, [selectedVideoIndex]);

  // 영상 수정 핸들러 (편집 모드 유지)
  const handleEditVideoAndStay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVideoId) return;

    setIsEditingVideo(true);
    try {
      // 관리자가 아닌 경우 URL 수정 제외
      const updateData = isAdmin() 
        ? {
            ...editingVideoData,
            videoUrl: cleanYouTubeUrl(editingVideoData.videoUrl) // URL 정리
          }
        : {
            sungDate: editingVideoData.sungDate,
            description: editingVideoData.description,
            startTime: editingVideoData.startTime,
            endTime: editingVideoData.endTime
          };

      const response = await fetch(`/api/videos/${editingVideoId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (response.ok) {
        const result = await response.json();
        // 상위 컴포넌트에서 데이터 새로고침
        await loadSongVideos();
        // 편집 모드는 유지
        console.log('라이브 클립이 성공적으로 수정되었습니다!');
      } else {
        const error = await response.json();
        console.error('라이브 클립 수정 실패:', error.error);
        showError('수정 실패', error.error || '라이브 클립 수정에 실패했습니다.');
      }
    } catch (error) {
      console.error('라이브 클립 수정 오류:', error);
      showError('오류 발생', '라이브 클립 수정 중 오류가 발생했습니다.');
    } finally {
      setIsEditingVideo(false);
    }
  };

  // 영상 수정 후 편집 종료
  const handleEditVideoAndClose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVideoId) return;

    setIsEditingVideo(true);
    try {
      // 관리자가 아닌 경우 URL 수정 제외
      const updateData = isAdmin() 
        ? {
            ...editingVideoData,
            videoUrl: cleanYouTubeUrl(editingVideoData.videoUrl) // URL 정리
          }
        : {
            sungDate: editingVideoData.sungDate,
            description: editingVideoData.description,
            startTime: editingVideoData.startTime,
            endTime: editingVideoData.endTime
          };

      const response = await fetch(`/api/videos/${editingVideoId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (response.ok) {
        const result = await response.json();
        // 상위 컴포넌트에서 데이터 새로고침
        await loadSongVideos();
        cancelEditVideo();
        console.log('라이브 클립이 성공적으로 수정되었습니다!');
      } else {
        const error = await response.json();
        console.error('라이브 클립 수정 실패:', error.error);
        showError('수정 실패', error.error || '라이브 클립 수정에 실패했습니다.');
      }
    } catch (error) {
      console.error('라이브 클립 수정 오류:', error);
      showError('오류 발생', '라이브 클립 수정 중 오류가 발생했습니다.');
    } finally {
      setIsEditingVideo(false);
    }
  };

  // 관리자 전용: 같은 곡의 다른 모든 클립들에게 현재 클립의 길이 적용
  const applyDurationToSameSongClips = async (currentVideoId: string, duration: number) => {
    try {
      const confirmed = await confirm.confirm({
        title: '같은 곡 클립들에 길이 일괄 적용',
        message: `현재 클립의 길이(${formatTime(duration)})를 "${songTitle}" 곡의 다른 모든 클립들에게 적용하시겠습니까?\n\n시작시간은 그대로 유지되고 종료시간만 조정됩니다.`,
        confirmText: '적용',
        cancelText: '취소',
        type: 'warning'
      });

      if (!confirmed) return;

      const response = await fetch('/api/admin/clips', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clipId: currentVideoId, // 더미 값 (사실상 사용되지 않음)
          action: 'bulkUpdateDuration',
          data: {
            songId,
            duration,
            excludeVideoId: currentVideoId // 현재 편집 중인 클립은 제외
          }
        }),
      });

      if (response.ok) {
        const result = await response.json();
        showSuccess('성공', `${result.updatedCount}개의 클립에 길이가 적용되었습니다.`);
        // 데이터 새로고침
        await loadSongVideos();
      } else {
        const error = await response.json();
        showError('적용 실패', error.error || '길이 일괄 적용에 실패했습니다.');
      }
    } catch (error) {
      console.error('길이 일괄 적용 오류:', error);
      showError('오류 발생', '길이 일괄 적용 중 오류가 발생했습니다.');
    }
  };

  // 영상 삭제 핸들러
  const handleDeleteVideo = async (videoId: string) => {
    const video = songVideos.find(v => v._id === videoId);
    if (!video) return;

    // 시간 포맷 함수
    const formatTime = (seconds: number) => {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const remainingSeconds = Math.floor(seconds % 60);
      
      if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
      } else {
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
      }
    };

    const clipInfo = [
      `부른날: ${formatOriginalDateForDisplay(video.originalDateString, video.sungDate)}`,
      `시간: ${formatTime(video.startTime || 0)} - ${formatTime(video.endTime || 0)}`,
      video.description ? `설명: ${video.description}` : '설명: 없음'
    ].join('\n');

    const confirmed = await confirm.confirm({
      title: '라이브 클립 삭제',
      message: `정말로 이 라이브 클립을 삭제하시겠습니까?\n\n${clipInfo}`,
      confirmText: '삭제',
      cancelText: '취소',
      type: 'danger'
    });
    
    if (!confirmed) return;

    setIsDeletingVideo(videoId);
    try {
      const response = await fetch(`/api/videos/${videoId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // 상위 컴포넌트에서 데이터 새로고침
        await loadSongVideos();
        // 삭제된 영상이 현재 선택된 영상이었다면 첫 번째 영상으로 변경
        if (selectedVideo && selectedVideo._id === videoId) {
          setSelectedVideoIndex(0);
        }
        console.log('라이브 클립이 성공적으로 삭제되었습니다!');
      } else {
        const error = await response.json();
        console.error('라이브 클립 삭제 실패:', error.error);
        showError('삭제 실패', error.error || '라이브 클립 삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('라이브 클립 삭제 오류:', error);
      showError('오류 발생', '라이브 클립 삭제 중 오류가 발생했습니다.');
    } finally {
      setIsDeletingVideo(null);
    }
  };

  // 새로 추가할 영상의 시간 중복 검사
  const getAddVideoOverlapInfo = () => {
    const videoData = updateVideoData(addVideoData.videoUrl);
    if (!videoData) return { hasOverlap: false, overlappingVideos: [], overlappingCount: 0 };
    
    // 추가할 영상 데이터로 임시 비디오 객체 생성
    const tempVideo = {
      _id: 'temp-add',
      videoId: videoData.videoId,
      startTime: addVideoData.startTime,
      endTime: addVideoData.endTime
    } as SongVideo;
    
    const overlappingVideos = songVideos.filter(otherVideo => 
      checkTimeOverlap(tempVideo, otherVideo)
    );
    
    return {
      hasOverlap: overlappingVideos.length > 0,
      overlappingVideos,
      overlappingCount: overlappingVideos.length
    };
  };

  // 라이브 클립 추가 핸들러
  const handleAddVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!songId || !addVideoData.videoUrl) return;
    
    // originalDateString을 파싱해서 정확한 날짜 사용 (fallback으로 addVideoData.sungDate 사용)
    const sungDate = parseOriginalDateString(selectedTimeline?.originalDateString, addVideoData.sungDate) || new Date().toISOString().split('T')[0];

    setIsAddingVideo(true);
    try {
      const response = await fetch(`/api/songs/${songId}/videos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...addVideoData,
          videoUrl: cleanYouTubeUrl(addVideoData.videoUrl), // URL 정리
          sungDate: sungDate
        }),
      });

      if (response.ok) {
        const result = await response.json();
        // 상위 컴포넌트에서 데이터 새로고침
        await loadSongVideos();
        // 폼 초기화
        setAddVideoData({
          videoUrl: '',
          endVideoUrl: '',
          sungDate: '',
          description: '',
          startTime: 0,
          endTime: undefined
        });
        setVideoMetadata({
          title: '',
          extractedDate: '',
          parsedStartTime: 0,
          parsedEndTime: undefined
        });
        setShowAddVideoForm(false);
        console.log('라이브 클립이 성공적으로 추가되었습니다!');
      } else {
        const error = await response.json();
        console.error('라이브 클립 추가 실패:', error.error);
        showError('추가 실패', error.error || '라이브 클립 추가에 실패했습니다.');
      }
    } catch (error) {
      console.error('라이브 클립 추가 오류:', error);
      showError('오류 발생', '라이브 클립 추가 중 오류가 발생했습니다.');
    } finally {
      setIsAddingVideo(false);
    }
  };


  return (
    <>
      <div className="flex flex-col h-full min-h-0 p-0 pb-1">
        {!showAddVideoForm ? (
          videosLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-light-accent dark:border-dark-accent"></div>
            </div>
          ) : songVideos.length > 0 ? (
            <div className="flex-1 min-h-0 overflow-y-auto" 
               style={{
                 scrollbarWidth: 'thin',
                 scrollbarColor: 'rgba(156, 163, 175, 0.5) transparent'
               }}>
            <div className="space-y-2 p-2 pb-4">
              {/* 유튜브 플레이어 */}
              <div className="relative">
              <div className={`w-full bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden transition-all duration-300 ${
                isPlayerMinimized 
                  ? 'aspect-video max-h-[20vh] min-h-[120px]' 
                  : 'aspect-video max-h-[40vh] sm:max-h-[45vh] min-h-[200px] sm:min-h-[250px]'
              }`}>
                {selectedVideo && (
                  <YouTube
                    key={`liveclip-player-${selectedVideo._id}`}
                    videoId={selectedVideo.videoId}
                    opts={{
                      width: '100%',
                      height: '100%',
                      playerVars: {
                        autoplay: 0,
                        controls: 1,
                        rel: 0,
                        modestbranding: 1,
                        start: selectedVideo.startTime || 0,
                        end: selectedVideo.endTime || undefined,
                        iv_load_policy: 3,
                        cc_load_policy: 0,
                        // 백그라운드 재생 개선을 위한 추가 설정
                        playsinline: 1,
                        enablejsapi: 1
                      },
                    }}
                    onReady={(event) => {
                      if (event.target && typeof event.target.playVideo === 'function') {
                        console.log('🎵 LiveClip 플레이어 준비 완료');
                        setVideoPlayer(event.target);
                        // 자동 재생은 onStateChange에서 처리하지만, 백업으로 여기서도 시도
                        if (shouldAutoPlay) {
                          console.log('🔄 자동 재생 대기 중 - onStateChange에서 처리될 예정');
                          
                          // 백업 자동 재생 로직 (2초 후 시도)
                          setTimeout(() => {
                            if (shouldAutoPlay) {
                              console.log('⏰ 백업 자동 재생 시도');
                              try {
                                const player = event.target;
                                if (player && 
                                    typeof player.playVideo === 'function' &&
                                    typeof player.getPlayerState === 'function') {
                                  
                                  const state = player.getPlayerState();
                                  console.log('⏰ 백업 재생 시 플레이어 상태:', state);
                                  
                                  // 재생 중이 아닌 경우에만 재생 시도
                                  if (state !== 1) {
                                    player.playVideo();
                                    setShouldAutoPlay(false);
                                    console.log('✅ 백업 자동 재생 성공');
                                  } else {
                                    console.log('ℹ️ 이미 재생 중이므로 백업 재생 건너뜀');
                                    setShouldAutoPlay(false);
                                  }
                                }
                              } catch (e) {
                                console.warn('⚠️ 백업 자동 재생 실패 (영상에 문제가 있을 수 있음):', e.message);
                                setShouldAutoPlay(false);
                                // 플레이어 참조 초기화
                                setVideoPlayer(null);
                              }
                            }
                          }, 2000);
                        }
                      }
                    }}
                    onStateChange={(event) => {
                      // YouTube 플레이어 상태와 동기화
                      const playerState = event.data;
                      const isCurrentlyPlaying = playerState === 1; // 재생 중
                      const isPaused = playerState === 2; // 일시정지
                      const isReady = playerState === 5; // 준비완료
                      
                      console.log('🎵 플레이어 상태 변경:', {
                        state: playerState,
                        shouldAutoPlay,
                        stateNames: {
                          [-1]: '시작되지 않음',
                          0: '종료됨',
                          1: '재생 중',
                          2: '일시정지됨',
                          3: '버퍼링 중',
                          5: '준비완료'
                        }[playerState] || '알 수 없음'
                      });
                      
                      setIsVideoPlaying(isCurrentlyPlaying);
                      
                      // 자동 재생이 필요한 경우 여러 상태에서 시도
                      if (shouldAutoPlay && (isReady || playerState === -1 || playerState === 2)) {
                        console.log('🎵 자동 재생 조건 충족 - 재생 시도');
                        setTimeout(() => {
                          try {
                            if (event.target && typeof event.target.playVideo === 'function') {
                              event.target.playVideo();
                              setShouldAutoPlay(false);
                              console.log('✅ 자동 재생 성공');
                            }
                          } catch (e) {
                            console.warn('⚠️ 상태 변경 시 자동 재생 실패 (영상에 문제가 있을 수 있음):', e.message);
                            setShouldAutoPlay(false);
                            // 플레이어 참조 초기화
                            setVideoPlayer(null);
                          }
                        }, 200);
                      }
                      
                      // 탭이 숨겨진 상태에서 재생이 중단된 경우 복원 시도
                      if (document.hidden && isPaused) {
                        console.log('🔄 백그라운드에서 재생 중단 감지 - 복원 시도');
                        setTimeout(() => {
                          try {
                            if (event.target && typeof event.target.playVideo === 'function') {
                              event.target.playVideo();
                              console.log('🎵 백그라운드 재생 복원');
                            }
                          } catch (e) {
                            console.log('⚠️ 백그라운드 재생 복원 실패:', e);
                          }
                        }, 100);
                      }
                    }}
                    onPlay={() => setIsVideoPlaying(true)}
                    onPause={() => setIsVideoPlaying(false)}
                    onError={(event) => {
                      console.warn('⚠️ YouTube 영상 재생 오류:', {
                        errorCode: event.data,
                        videoId: selectedVideo.videoId,
                        errorMessages: {
                          2: '잘못된 매개변수 - 영상 ID가 올바르지 않음',
                          5: '플레이어 HTML5 오류',
                          100: '영상을 찾을 수 없음 - 삭제되었거나 비공개',
                          101: '영상 소유자가 임베드를 허용하지 않음',
                          150: '영상 소유자가 임베드를 허용하지 않음'
                        }[event.data] || '알 수 없는 오류'
                      });
                      
                      // 재생 상태 초기화
                      setIsVideoPlaying(false);
                      setVideoPlayer(null);
                      setShouldAutoPlay(false);
                    }}
                    onEnd={() => {
                      setIsVideoPlaying(false);
                      
                      // 다음 영상 전환 (수정 중이 아닐 때만)
                      if (selectedVideoIndex < songVideos.length - 1 && !editingVideoId) {
                        console.log('🔄 다음 영상으로 전환 시작');
                        setVideoPlayer(null); // 다음 영상으로 넘어갈 때만 플레이어 참조 제거
                        // 약간의 딜레이를 두고 자동재생 플래그 설정
                        setTimeout(() => {
                          setShouldAutoPlay(true);
                          setSelectedVideoIndex(selectedVideoIndex + 1);
                          console.log('✅ 다음 영상 설정 완료 - shouldAutoPlay: true');
                        }, 100);
                      } else {
                        console.log('🔄 영상 종료 - 수정 중이므로 플레이어 참조 유지');
                        // 수정 중이거나 마지막 영상인 경우 플레이어 참조 유지 (제어 패널 계속 사용 가능)
                      }
                    }}
                    className="w-full h-full"
                  />
                )}
              </div>
              
              {/* 플레이어 크기 조절 버튼 */}
              <button
                onClick={() => setIsPlayerMinimized(!isPlayerMinimized)}
                className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 text-white 
                         rounded-lg transition-colors duration-200 backdrop-blur-sm z-10"
                title={isPlayerMinimized ? "플레이어 확대" : "플레이어 축소"}
              >
                {isPlayerMinimized ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12l-5-5m5 5l-5 5m5-5H4" />
                  </svg>
                )}
              </button>
            </div>
            
            {/* 수정 모드일 때만 표시되는 고급 플레이어 제어 패널 */}
            {editingVideoId && (
              <div className="bg-white dark:bg-gray-700 p-2 sm:p-3 rounded-lg border border-gray-200 dark:border-gray-600 space-y-2 sm:space-y-3">
                {/* 현재 시간 표시 */}
                <div className="text-center">
                  <div className="text-sm font-mono font-bold text-gray-900 dark:text-white">
                    현재: {formatTime(currentTime)}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    시작: {formatTime(editingVideoData.startTime)} {editingVideoData.endTime && `/ 종료: ${formatTime(editingVideoData.endTime)}`}
                  </div>
                  {editingVideoData.endTime && editingVideoData.endTime > editingVideoData.startTime && (
                    <div 
                      className="text-xs sm:text-xs text-blue-600 dark:text-blue-400 mt-1 cursor-pointer hover:text-blue-800 dark:hover:text-blue-200 transition-colors"
                      onClick={() => {
                        const clipDuration = formatTime(editingVideoData.endTime - editingVideoData.startTime);
                        navigator.clipboard.writeText(clipDuration).then(() => {
                          console.log('클립 길이 복사됨:', clipDuration);
                        }).catch(() => {
                          console.log('복사 실패');
                        });
                      }}
                      title="클립 길이를 복사하려면 클릭하세요 (재생시간 입력에 붙여넣기 가능)"
                    >
                      클립 길이: {formatTime(editingVideoData.endTime - editingVideoData.startTime)} 📋
                    </div>
                  )}
                </div>

                {/* 재생 컨트롤 */}
                <div className="flex items-center justify-center gap-2 sm:gap-4">
                  <button
                    type="button"
                    onClick={() => seekRelative(-60)}
                    className="p-1.5 sm:p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors text-xs bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-lg min-w-[2rem] min-h-[2rem] sm:min-w-[2.5rem] sm:min-h-[2.5rem] flex flex-col items-center justify-center"
                    title="1분 뒤로"
                  >
                    <BackwardIcon className="w-4 h-4" />
                    1m
                  </button>
                  <button
                    type="button"
                    onClick={() => seekRelative(-10)}
                    className="p-1.5 sm:p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors text-xs bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-lg min-w-[2rem] min-h-[2rem] sm:min-w-[2.5rem] sm:min-h-[2.5rem] flex flex-col items-center justify-center"
                    title="10초 뒤로"
                  >
                    <ArrowLeftIcon className="w-4 h-4" />
                    10s
                  </button>
                  <button
                    type="button"
                    onClick={() => seekRelative(-1)}
                    className="p-1.5 sm:p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors text-xs bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-lg min-w-[2rem] min-h-[2rem] sm:min-w-[2.5rem] sm:min-h-[2.5rem] flex flex-col items-center justify-center"
                    title="1초 뒤로"
                  >
                    <ArrowLeftIcon className="w-3 h-3" />
                    1s
                  </button>

                  <button
                    type="button"
                    onClick={togglePlayPause}
                    className="p-2 sm:p-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors min-w-[2.5rem] min-h-[2.5rem] sm:min-w-[3rem] sm:min-h-[3rem] flex items-center justify-center"
                    title={isVideoPlaying ? "일시정지" : "재생"}
                  >
                    {isVideoPlaying ? (
                      <PauseIcon className="w-4 h-4" />
                    ) : (
                      <PlayIcon className="w-4 h-4" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => seekRelative(1)}
                    className="p-1.5 sm:p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors text-xs bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-lg min-w-[2rem] min-h-[2rem] sm:min-w-[2.5rem] sm:min-h-[2.5rem] flex flex-col items-center justify-center"
                    title="1초 앞으로"
                  >
                    <ArrowRightIcon className="w-3 h-3" />
                    1s
                  </button>
                  <button
                    type="button"
                    onClick={() => seekRelative(10)}
                    className="p-1.5 sm:p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors text-xs bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-lg min-w-[2rem] min-h-[2rem] sm:min-w-[2.5rem] sm:min-h-[2.5rem] flex flex-col items-center justify-center"
                    title="10초 앞으로"
                  >
                    <ArrowRightIcon className="w-4 h-4" />
                    10s
                  </button>
                  <button
                    type="button"
                    onClick={() => seekRelative(60)}
                    className="p-1.5 sm:p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors text-xs bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-lg min-w-[2rem] min-h-[2rem] sm:min-w-[2.5rem] sm:min-h-[2.5rem] flex flex-col items-center justify-center"
                    title="1분 앞으로"
                  >
                    <ForwardIcon className="w-4 h-4" />
                    1m
                  </button>
                </div>

                {/* 시간 설정 버튼 */}
                <div className="flex items-center justify-center gap-1.5 sm:gap-3 flex-wrap">
                  <button
                    type="button"
                    onClick={() => seekToTime(editingVideoData.startTime)}
                    className="px-2 py-1.5 sm:px-3 sm:py-2 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors text-xs sm:text-sm font-medium min-w-[3rem] min-h-[2rem] sm:min-w-[4rem] sm:min-h-[2.5rem] flex items-center justify-center"
                    title="시작시간으로 이동"
                  >
                    시작점
                  </button>
                  <button
                    type="button"
                    onClick={setCurrentTimeAsStart}
                    className="px-2 py-1.5 sm:px-3 sm:py-2 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-200 dark:hover:bg-green-800 transition-colors text-xs sm:text-sm font-medium min-w-[3rem] min-h-[2rem] sm:min-w-[4rem] sm:min-h-[2.5rem] flex items-center justify-center"
                    title="현재 시간을 시작시간으로 설정"
                  >
                    IN
                  </button>
                  <button
                    type="button"
                    onClick={setCurrentTimeAsEnd}
                    className="px-2 py-1.5 sm:px-3 sm:py-2 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-800 transition-colors text-xs sm:text-sm font-medium min-w-[3rem] min-h-[2rem] sm:min-w-[4rem] sm:min-h-[2.5rem] flex items-center justify-center"
                    title="현재 시간을 종료시간으로 설정"
                  >
                    OUT
                  </button>
                  {editingVideoData.endTime && (
                    <button
                      type="button"
                      onClick={() => seekToTime(Math.max(0, editingVideoData.endTime - 3))}
                      className="px-2 py-1.5 sm:px-3 sm:py-2 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors text-xs sm:text-sm font-medium min-w-[3rem] min-h-[2rem] sm:min-w-[4rem] sm:min-h-[2.5rem] flex items-center justify-center"
                      title="종료시간 3초 전으로 이동"
                    >
                      끝-3초
                    </button>
                  )}
                </div>
              </div>
            )}
            
              {/* 영상 목록 헤더 */}
              <div className="flex items-center justify-between">
                <h5 className="text-sm font-medium text-light-text/70 dark:text-dark-text/70">
                  라이브 클립 ({songVideos.length}개)
                </h5>
                {session && (
                  <button
                    onClick={() => setShowAddVideoForm(true)}
                    className="px-3 py-1.5 text-xs bg-light-accent/20 dark:bg-dark-accent/20 
                             text-light-accent dark:text-dark-accent 
                             rounded-lg hover:bg-light-accent/30 dark:hover:bg-dark-accent/30 
                             transition-colors duration-200 font-medium
                             flex items-center gap-1"
                  >
                    <PlusIcon className="w-3 h-3" />
                    추가
                  </button>
                )}
              </div>
              
              {/* 영상 목록 */}
              <div className="space-y-2">
                {songVideos.map((video, index) => {
                  const overlapInfo = getVideoOverlapInfo(video);
                  
                  return editingVideoId === video._id ? (
                    // 편집 모드
                    <div key={video._id} className="p-3 sm:p-4 rounded-lg border border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20">
                      <div className="space-y-2 sm:space-y-3">
                        <div className="flex items-center justify-between mb-3">
                          <h6 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                            클립 수정 {isAdmin() ? <span className="text-xs opacity-60">(관리자 - 모든 항목 수정 가능)</span> : <span className="text-xs opacity-60">(일부 항목만 수정 가능)</span>}
                          </h6>
                          <button
                            type="button"
                            onClick={cancelEditVideo}
                            className="p-1 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                          >
                            <XMarkIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          </button>
                        </div>
                        
                        {/* 관리자만 URL 수정 가능 */}
                        {isAdmin() && (
                          <div>
                            <label className="block text-xs font-medium text-blue-800 dark:text-blue-200 mb-1">
                              YouTube URL
                              <span className="text-xs opacity-60 ml-2">(관리자 전용)</span>
                            </label>
                            <input
                              type="url"
                              value={editingVideoData.videoUrl}
                              onChange={(e) => setEditingVideoData(prev => ({...prev, videoUrl: e.target.value}))}
                              onPaste={(e) => {
                                const pastedUrl = e.clipboardData.getData('text');
                                if (pastedUrl && pastedUrl.includes('://')) {
                                  const parsedTime = extractTimeFromUrl(pastedUrl);
                                  if (parsedTime > 0) {
                                    // 시간 파라미터가 있으면 시작시간에 파싱하고 URL은 깔끔하게 정리
                                    const cleanedUrl = cleanYouTubeUrl(pastedUrl);
                                    e.preventDefault();
                                    setEditingVideoData(prev => ({
                                      ...prev, 
                                      videoUrl: cleanedUrl,
                                      startTime: parsedTime
                                    }));
                                  }
                                }
                              }}
                              className="w-full px-2 py-1 text-xs bg-white dark:bg-gray-800 border border-blue-300 dark:border-blue-600 rounded text-light-text dark:text-dark-text"
                              placeholder="https://youtu.be/... (시간 포함 URL 붙여넣기 시 자동 파싱)"
                            />
                          </div>
                        )}
                        
                        <div>
                          <label className="block text-xs font-medium text-blue-800 dark:text-blue-200 mb-1">날짜</label>
                          <input
                            type="date"
                            value={editingVideoData.sungDate}
                            onChange={(e) => setEditingVideoData(prev => ({...prev, sungDate: e.target.value}))}
                            className="w-full px-2 py-1 text-xs bg-white dark:bg-gray-800 border border-blue-300 dark:border-blue-600 rounded text-light-text dark:text-dark-text"
                            required
                          />
                        </div>
                        
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-medium text-blue-800 dark:text-blue-200 mb-1">
                              시작 시간 (초)
                              {editingVideoData.startTime > 0 && (
                                <span className="text-xs text-green-600 dark:text-green-400 ml-1">
                                  ({formatTime(editingVideoData.startTime)})
                                </span>
                              )}
                            </label>
                            <input
                              type="number"
                              value={editingVideoData.startTime}
                              onChange={(e) => setEditingVideoData(prev => ({...prev, startTime: parseInt(e.target.value) || 0}))}
                              onPaste={(e) => {
                                const pastedText = e.clipboardData.getData('text');
                                // URL인지 확인 (프로토콜 포함)
                                if (pastedText.includes('://')) {
                                  const parsedTime = extractTimeFromUrl(pastedText);
                                  if (parsedTime > 0) {
                                    e.preventDefault();
                                    setEditingVideoData(prev => ({...prev, startTime: parsedTime}));
                                  }
                                }
                              }}
                              className="w-full px-2 py-1 text-xs bg-white dark:bg-gray-800 border border-blue-300 dark:border-blue-600 rounded text-light-text dark:text-dark-text"
                              min="0"
                              placeholder="시간(s) 또는 URL"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-blue-800 dark:text-blue-200 mb-1">
                              종료 시간 (초)
                              {editingVideoData.endTime && (
                                <span className="text-xs text-green-600 dark:text-green-400 ml-1">
                                  ({formatTime(editingVideoData.endTime)})
                                </span>
                              )}
                            </label>
                            <input
                              type="number"
                              value={editingVideoData.endTime || ''}
                              onChange={(e) => setEditingVideoData(prev => ({...prev, endTime: e.target.value ? parseInt(e.target.value) : undefined}))}
                              onPaste={(e) => {
                                const pastedText = e.clipboardData.getData('text');
                                // URL인지 확인 (프로토콜 포함)
                                if (pastedText.includes('://')) {
                                  const parsedTime = extractTimeFromUrl(pastedText);
                                  if (parsedTime > 0) {
                                    e.preventDefault();
                                    setEditingVideoData(prev => ({...prev, endTime: parsedTime}));
                                  }
                                }
                              }}
                              className="w-full px-2 py-1 text-xs bg-white dark:bg-gray-800 border border-blue-300 dark:border-blue-600 rounded text-light-text dark:text-dark-text"
                              placeholder="시간(s) 또는 URL"
                              min="0"
                            />
                          </div>
                        </div>
                        
                        {/* 재생시간으로 종료시간 설정 */}
                        <div>
                          <label className="block text-xs font-medium text-blue-800 dark:text-blue-200 mb-1">
                            재생시간 입력 (선택사항)
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={durationInput}
                              onChange={(e) => handleDurationInputChange(e.target.value)}
                              className="flex-1 px-2 py-1 text-xs bg-white dark:bg-gray-800 border border-blue-300 dark:border-blue-600 rounded text-light-text dark:text-dark-text"
                              placeholder="예: 180 또는 3:05.0"
                            />
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  const text = await navigator.clipboard.readText();
                                  const duration = parseTimeToSeconds(text);
                                  if (duration > 0) {
                                    setDurationInput(text);
                                    setEditingVideoData(prev => ({ 
                                      ...prev, 
                                      endTime: (prev.startTime || 0) + duration 
                                    }));
                                  }
                                } catch (error) {
                                  console.error('클립보드 읽기 실패:', error);
                                }
                              }}
                              className="px-3 py-1 text-xs bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors"
                              title="클립보드에서 재생시간 붙여넣기"
                            >
                              📋 붙여넣기
                            </button>
                            
                            {/* 관리자 전용: 같은 곡 모든 클립에 길이 적용 */}
                            {isAdmin() && (
                              <button
                                onClick={() => {
                                  const currentDuration = editingVideoData.endTime - editingVideoData.startTime;
                                  if (currentDuration > 0 && editingVideoId) {
                                    applyDurationToSameSongClips(editingVideoId, currentDuration);
                                  }
                                }}
                                className="px-3 py-1 text-xs bg-orange-600 hover:bg-orange-700 text-white rounded transition-colors"
                                title="현재 클립의 길이를 같은 곡의 모든 다른 클립들에게 적용 (관리자 전용)"
                              >
                                🎵 모든 클립에 적용
                              </button>
                            )}
                          </div>
                          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                            시간 형식: 180(초) 또는 3:05.0(mm:ss.d)
                            {durationInput && ` → 종료: ${formatTime((editingVideoData.startTime || 0) + parseTimeToSeconds(durationInput))}`}
                          </p>
                        </div>
                        
                        <div>
                          <label className="block text-xs font-medium text-blue-800 dark:text-blue-200 mb-1">설명</label>
                          <textarea
                            value={editingVideoData.description}
                            onChange={(e) => setEditingVideoData(prev => ({...prev, description: e.target.value}))}
                            className="w-full px-2 py-1 text-xs bg-white dark:bg-gray-800 border border-blue-300 dark:border-blue-600 rounded resize-none text-light-text dark:text-dark-text"
                            rows={2}
                            maxLength={500}
                            placeholder="클립에 대한 설명..."
                          />
                          <div className="text-xs text-blue-600 dark:text-blue-400 mt-1 text-right">
                            {editingVideoData.description.length}/500
                          </div>
                        </div>
                        
                        {/* 시간 중복 경고 */}
                        {(() => {
                          const editOverlapInfo = getEditingVideoOverlapInfo();
                          return editOverlapInfo.hasOverlap ? (
                            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                              <div className="text-xs font-medium text-amber-800 dark:text-amber-200 mb-2">
                                ⚠️ 시간 중복 경고 ({editOverlapInfo.overlappingCount}개 클립과 중복)
                              </div>
                              <div className="space-y-1">
                                {editOverlapInfo.overlappingVideos.map((overlappingVideo) => (
                                  <div key={overlappingVideo._id} className="text-xs text-amber-700 dark:text-amber-300">
                                    • {formatOriginalDateForDisplay(overlappingVideo.originalDateString, overlappingVideo.sungDate)} ({overlappingVideo.addedByName}) - {formatTime(overlappingVideo.startTime || 0)} ~ {overlappingVideo.endTime ? formatTime(overlappingVideo.endTime) : '∞'}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null;
                        })()}

                        {/* 일반 사용자를 위한 안내 메시지 */}
                        {!isAdmin() && (
                          <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                            <p className="text-xs text-yellow-800 dark:text-yellow-200">
                              💡 링크가 잘못되었다면 삭제 후 다시 등록해주세요. URL은 관리자만 수정할 수 있습니다.
                            </p>
                          </div>
                        )}
                        
                        <div className="flex gap-2 pt-2">
                          <button
                            type="button"
                            onClick={cancelEditVideo}
                            className="px-3 py-1.5 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                          >
                            취소
                          </button>
                          <button
                            type="button"
                            onClick={handleEditVideoAndStay}
                            disabled={isEditingVideo}
                            className="flex-1 px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50"
                            title="저장하고 편집 계속"
                          >
                            {isEditingVideo ? '저장 중...' : '저장'}
                          </button>
                          <button
                            type="button"
                            onClick={handleEditVideoAndClose}
                            disabled={isEditingVideo}
                            className="flex-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
                            title="저장하고 편집 종료"
                          >
                            {isEditingVideo ? '저장 중...' : '완료'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // 일반 모드
                    <div
                      key={video._id}
                      onClick={() => handleVideoSelect(index)}
                      className={`p-2 sm:p-3 rounded-lg border transition-all duration-200 relative group ${
                        editingVideoId && selectedVideoIndex !== index
                          ? 'cursor-not-allowed opacity-60'
                          : 'cursor-pointer'
                      } ${
                        overlapInfo.hasOverlap
                          ? selectedVideoIndex === index
                            ? 'border-amber-400 dark:border-amber-500 bg-amber-50 dark:bg-amber-900/20 shadow-amber-100 dark:shadow-amber-900/20 shadow-md'
                            : editingVideoId && selectedVideoIndex !== index
                              ? 'border-amber-300 dark:border-amber-600 bg-amber-50/70 dark:bg-amber-900/10'
                              : 'border-amber-300 dark:border-amber-600 bg-amber-50/70 dark:bg-amber-900/10 hover:border-amber-400 dark:hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                          : selectedVideoIndex === index
                            ? 'border-light-accent/50 dark:border-dark-accent/50 bg-light-accent/10 dark:bg-dark-accent/10'
                            : editingVideoId && selectedVideoIndex !== index
                              ? 'border-light-primary/20 dark:border-dark-primary/20'
                              : 'border-light-primary/20 dark:border-dark-primary/20 hover:border-light-accent/30 dark:hover:border-dark-accent/30 hover:bg-light-primary/5 dark:hover:bg-dark-primary/5'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-light-text dark:text-dark-text truncate">
                            {formatOriginalDateForDisplay(video.originalDateString, video.sungDate)}
                            {/* 재생시간 표시 */}
                            {video.startTime !== undefined && video.endTime !== undefined && video.endTime > video.startTime && (
                              <span className="ml-2 text-blue-600 dark:text-blue-400">
                                ({formatTime(video.endTime - video.startTime)})
                              </span>
                            )}
                          </div>
                          {video.description && (
                            <div className="text-xs text-light-text/60 dark:text-dark-text/60 mt-1 whitespace-pre-line">
                              {video.description}
                            </div>
                          )}
                          <div className="text-xs text-light-text/50 dark:text-dark-text/50 mt-1">
                            {video.addedByName}
                            {video.isVerified && (
                              <span className="ml-2 text-green-600 dark:text-green-400">✓ 검증됨</span>
                            )}
                            {overlapInfo.hasOverlap && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedOverlapInfo(
                                    expandedOverlapInfo === video._id ? null : video._id
                                  );
                                }}
                                className="ml-2 text-amber-600 dark:text-amber-400 font-medium hover:text-amber-700 dark:hover:text-amber-300 underline decoration-dotted"
                                title="중복 상세 정보 보기"
                              >
                                ⚠️ 시간 중복 ({overlapInfo.overlappingCount}개)
                              </button>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {/* 편집/삭제 버튼 (권한 있는 사용자만, 편집 중이 아닐 때만, 선택된 클립만) */}
                          {canEditVideo(video) && !editingVideoId && selectedVideoIndex === index && (
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startEditVideo(video);
                                }}
                                className="p-1.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                                title="수정"
                              >
                                <PencilIcon className="w-3 h-3" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteVideo(video._id);
                                }}
                                disabled={isDeletingVideo === video._id}
                                className="p-1.5 rounded-full bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-800 transition-colors disabled:opacity-50"
                                title="삭제"
                              >
                                {isDeletingVideo === video._id ? (
                                  <div className="animate-spin rounded-full h-3 w-3 border border-red-500 border-t-transparent"></div>
                                ) : (
                                  <TrashIcon className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          )}
                          
                          {selectedVideoIndex === index && (
                            <PlayIcon className="w-4 h-4 text-light-accent dark:text-dark-accent" />
                          )}
                        </div>
                      </div>
                      
                      {/* 중복 상세 정보 확장 영역 */}
                      {expandedOverlapInfo === video._id && overlapInfo.hasOverlap && (
                        <div className="mt-3 pt-3 border-t border-amber-200 dark:border-amber-800 bg-amber-25 dark:bg-amber-950/30 -mx-3 px-3 pb-3 rounded-b-lg">
                          <div className="text-xs font-medium text-amber-800 dark:text-amber-200 mb-2">
                            🔍 시간 중복 상세 정보:
                          </div>
                          <div className="space-y-2">
                            {overlapInfo.overlappingVideos.map((overlappingVideo) => {
                              const video1Start = video.startTime || 0;
                              const video1End = video.endTime || '∞';
                              const video2Start = overlappingVideo.startTime || 0;
                              const video2End = overlappingVideo.endTime || '∞';
                              
                              return (
                                <div key={overlappingVideo._id} className="text-xs text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/50 p-2 rounded border border-amber-200 dark:border-amber-800">
                                  <div className="font-medium mb-1">
                                    📅 {formatOriginalDateForDisplay(overlappingVideo.originalDateString, overlappingVideo.sungDate)} ({overlappingVideo.addedByName})
                                  </div>
                                  <div className="space-y-1 text-amber-600 dark:text-amber-400">
                                    <div>현재 클립: {formatTime(video1Start)} ~ {typeof video1End === 'number' ? formatTime(video1End) : video1End}</div>
                                    <div>중복 클립: {formatTime(video2Start)} ~ {typeof video2End === 'number' ? formatTime(video2End) : video2End}</div>
                                  </div>
                                  {overlappingVideo.description && (
                                    <div className="text-amber-600 dark:text-amber-400 mt-1 italic whitespace-pre-line">
                                      "{overlappingVideo.description}"
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          <div className="mt-2 text-xs text-amber-600 dark:text-amber-400 italic">
                            💡 관리자에게 문의하여 중복된 클립을 정리하세요.
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-light-text/50 dark:text-dark-text/50 min-h-0">
            <div className="text-center">
              <PlayIcon className="w-16 h-16 mb-4 opacity-30 mx-auto" />
              <p className="text-lg mb-2">아직 등록된 라이브 클립이 없습니다</p>
              <p className="text-base">사용자가 라이브 클립을 추가할 수 있습니다</p>
              {session && (
                <button
                  onClick={() => setShowAddVideoForm(true)}
                  className="mt-4 px-4 py-2 bg-gradient-to-r from-light-accent to-light-purple 
                           dark:from-dark-accent dark:to-dark-purple text-white 
                           rounded-lg hover:shadow-lg transform hover:scale-105 
                           transition-all duration-200 font-medium"
                >
                  + 라이브 클립 추가
                </button>
              )}
            </div>
          </div>
        )
      ) : (
        /* 라이브 클립 추가 폼 */
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col flex-1 min-h-0 h-full"
        >
          <div className="flex-1 min-h-0 overflow-y-auto p-2 pb-4 bg-gradient-to-br from-light-primary/10 to-light-accent/5 
                        dark:from-dark-primary/10 dark:to-dark-accent/5 
                        border border-light-accent/20 dark:border-dark-accent/20 
                        rounded-2xl backdrop-blur-sm"
               style={{
                 scrollbarWidth: 'thin',
                 scrollbarColor: 'rgba(156, 163, 175, 0.5) transparent'
               }}
          >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-light-accent to-light-purple 
                            dark:from-dark-accent dark:to-dark-purple 
                            flex items-center justify-center">
                <PlayIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h4 className="text-lg font-semibold text-light-text dark:text-dark-text">
                  라이브 클립 추가
                </h4>
                <p className="text-sm text-light-text/60 dark:text-dark-text/60">
                  {songTitle}의 라이브 영상을 추가해보세요
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowAddVideoForm(false)}
              className="p-2 rounded-full hover:bg-light-primary/20 dark:hover:bg-dark-primary/20 
                       transition-colors duration-200"
            >
              <XMarkIcon className="w-5 h-5 text-light-text/60 dark:text-dark-text/60" />
            </button>
          </div>

          <form onSubmit={handleAddVideo} className="space-y-4 sm:space-y-6">
            {/* YouTube URL 입력 (시작 시간 포함) */}
            <div>
              <label className="block text-sm font-medium text-light-text/80 dark:text-dark-text/80 mb-2">
                시작 위치 유튜브 URL * 
                <span className="text-xs text-light-text/60 dark:text-dark-text/60 ml-2">
                  (시간 파라미터 포함된 링크를 붙여넣으세요)
                </span>
              </label>
              <div className="relative">
                <input
                  type="url"
                  value={addVideoData.videoUrl}
                  onChange={(e) => handleVideoUrlChange(e.target.value)}
                  placeholder="https://youtu.be/DbMJrwTVf0Q?t=25416"
                  className="w-full px-4 py-3 pl-12 bg-white/50 dark:bg-gray-800/50 
                           border border-light-accent/30 dark:border-dark-accent/30 
                           rounded-xl outline-none 
                           focus:border-light-accent dark:focus:border-dark-accent 
                           focus:ring-2 focus:ring-light-accent/20 dark:focus:ring-dark-accent/20
                           text-light-text dark:text-dark-text"
                  required
                />
                <PlayIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-light-accent dark:text-dark-accent" />
              </div>
              {videoMetadata.parsedStartTime > 0 && (
                <div className="mt-2 text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 p-2 rounded-lg">
                  ✅ 시작 시간 자동 인식: {Math.floor(videoMetadata.parsedStartTime / 3600)}:{String(Math.floor((videoMetadata.parsedStartTime % 3600) / 60)).padStart(2, '0')}:{String(videoMetadata.parsedStartTime % 60).padStart(2, '0')} → 아래 시작 시간 필드에 자동 입력됨
                </div>
              )}
            </div>

            {/* 종료 URL 입력 (선택사항) */}
            <div>
              <label className="block text-sm font-medium text-light-text/80 dark:text-dark-text/80 mb-2">
                종료 위치 유튜브 URL (선택사항)
                <span className="text-xs text-light-text/60 dark:text-dark-text/60 ml-2">
                  (노래 끝나는 시점의 링크)
                </span>
              </label>
              <div className="relative">
                <input
                  type="url"
                  value={addVideoData.endVideoUrl}
                  onChange={(e) => handleEndVideoUrlChange(e.target.value)}
                  placeholder="https://youtu.be/DbMJrwTVf0Q?t=25500"
                  className="w-full px-4 py-3 pl-12 bg-white/50 dark:bg-gray-800/50 
                           border border-light-accent/30 dark:border-dark-accent/30 
                           rounded-xl outline-none 
                           focus:border-light-accent dark:focus:border-dark-accent 
                           focus:ring-2 focus:ring-light-accent/20 dark:focus:ring-dark-accent/20
                           text-light-text dark:text-dark-text"
                />
                <PlayIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-red-500" />
              </div>
              {addVideoData.endTime && (
                <div className="mt-2 text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 p-2 rounded-lg">
                  ✅ 종료 시간 자동 인식: {Math.floor(addVideoData.endTime / 3600)}:{String(Math.floor((addVideoData.endTime % 3600) / 60)).padStart(2, '0')}:{String(addVideoData.endTime % 60).padStart(2, '0')} → 아래 종료 시간 필드에 자동 입력됨
                </div>
              )}
            </div>

            {/* 사용법 가이드 */}
            <div className="p-3 sm:p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
              <h5 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">💡 사용법 가이드</h5>
              <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                <li>• 유튜브에서 노래 시작 부분으로 이동 후 "공유" → "시작시간" 체크 → 링크 복사</li>
                <li>• 종료 시간도 설정하려면 노래 끝나는 부분에서 같은 방식으로 링크 복사</li>
                <li>• "[25.06.01]" 형식의 제목이면 날짜가 자동으로 인식됩니다</li>
                <li>• 날짜 인식에 실패하면 "재분석" 버튼으로 다시 시도하거나 수동 입력하세요</li>
              </ul>
            </div>

            {/* 메타데이터 분석 상태 */}
            {addVideoData.videoUrl && (
              <div className="p-3 sm:p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="text-sm font-medium text-gray-800 dark:text-gray-200">📺 영상 정보</h5>
                  <button
                    type="button"
                    onClick={() => fetchVideoMetadata(addVideoData.videoUrl)}
                    disabled={!addVideoData.videoUrl}
                    className="px-3 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 
                             rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors duration-200
                             disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    🔄 재분석
                  </button>
                </div>
                {videoMetadata.title ? (
                  <>
                    <div className="text-xs text-gray-700 dark:text-gray-300 mb-2">
                      제목: {videoMetadata.title}
                    </div>
                    {videoMetadata.extractedDate ? (
                      <div className="text-xs text-green-600 dark:text-green-400">
                        ✅ 날짜 인식 성공: {videoMetadata.extractedDate}
                      </div>
                    ) : (
                      <div className="text-xs text-amber-600 dark:text-amber-400">
                        ⚠️ 날짜 자동 인식 실패 - 수동으로 입력해주세요
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    💡 "재분석" 버튼을 클릭하여 영상 제목과 날짜를 자동으로 추출하세요
                  </div>
                )}
              </div>
            )}

            {/* 날짜와 수동 시간 입력 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-light-text/80 dark:text-dark-text/80 mb-2">
                  부른 날짜 
                  <span className="text-xs text-light-text/60 dark:text-dark-text/60 ml-2">
                    (선택사항)
                  </span>
                </label>
                <input
                  type="date"
                  value={addVideoData.sungDate}
                  onChange={(e) => setAddVideoData(prev => ({...prev, sungDate: e.target.value}))}
                  className="w-full px-4 py-3 bg-white/50 dark:bg-gray-800/50 
                           border border-light-accent/30 dark:border-dark-accent/30 
                           rounded-xl outline-none 
                           focus:border-light-accent dark:focus:border-dark-accent 
                           focus:ring-2 focus:ring-light-accent/20 dark:focus:ring-dark-accent/20
                           text-light-text dark:text-dark-text"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-light-text/80 dark:text-dark-text/80 mb-2">
                  시작 시간 (초)
                  {addVideoData.startTime > 0 && (
                    <span className="text-xs text-green-600 dark:text-green-400 ml-2">
                      ({Math.floor(addVideoData.startTime / 3600)}:{String(Math.floor((addVideoData.startTime % 3600) / 60)).padStart(2, '0')}:{String(addVideoData.startTime % 60).padStart(2, '0')})
                    </span>
                  )}
                </label>
                <input
                  type="number"
                  value={addVideoData.startTime}
                  onChange={(e) => setAddVideoData(prev => ({...prev, startTime: parseInt(e.target.value) || 0}))}
                  placeholder="0"
                  min="0"
                  className="w-full px-4 py-3 bg-white/50 dark:bg-gray-800/50 
                           border border-light-accent/30 dark:border-dark-accent/30 
                           rounded-xl outline-none 
                           focus:border-light-accent dark:focus:border-dark-accent 
                           focus:ring-2 focus:ring-light-accent/20 dark:focus:ring-dark-accent/20
                           text-light-text dark:text-dark-text"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-light-text/80 dark:text-dark-text/80 mb-2">
                  종료 시간 (초)
                  {addVideoData.endTime && (
                    <span className="text-xs text-green-600 dark:text-green-400 ml-2">
                      ({Math.floor(addVideoData.endTime / 3600)}:{String(Math.floor((addVideoData.endTime % 3600) / 60)).padStart(2, '0')}:{String(addVideoData.endTime % 60).padStart(2, '0')})
                    </span>
                  )}
                </label>
                <input
                  type="number"
                  value={addVideoData.endTime || ''}
                  onChange={(e) => setAddVideoData(prev => ({...prev, endTime: e.target.value ? parseInt(e.target.value) : undefined}))}
                  placeholder="자동 (영상 끝까지)"
                  min="0"
                  className="w-full px-4 py-3 bg-white/50 dark:bg-gray-800/50 
                           border border-light-accent/30 dark:border-dark-accent/30 
                           rounded-xl outline-none 
                           focus:border-light-accent dark:focus:border-dark-accent 
                           focus:ring-2 focus:ring-light-accent/20 dark:focus:ring-dark-accent/20
                           text-light-text dark:text-dark-text"
                />
              </div>
            </div>

            {/* 시간 중복 경고 (클립 추가 시) */}
            {addVideoData.videoUrl && (() => {
              const addOverlapInfo = getAddVideoOverlapInfo();
              return addOverlapInfo.hasOverlap ? (
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                  <div className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">
                    ⚠️ 시간 중복 경고 ({addOverlapInfo.overlappingCount}개 클립과 중복)
                  </div>
                  <div className="space-y-2">
                    {addOverlapInfo.overlappingVideos.map((overlappingVideo) => (
                      <div key={overlappingVideo._id} className="text-xs text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/50 p-2 rounded border border-amber-200 dark:border-amber-800">
                        <div className="font-medium">
                          📅 {formatOriginalDateForDisplay(overlappingVideo.originalDateString, overlappingVideo.sungDate)} ({overlappingVideo.addedByName})
                        </div>
                        <div className="text-amber-600 dark:text-amber-400">
                          기존 클립: {formatTime(overlappingVideo.startTime || 0)} ~ {overlappingVideo.endTime ? formatTime(overlappingVideo.endTime) : '∞'}
                        </div>
                        {overlappingVideo.description && (
                          <div className="italic whitespace-pre-line">"{overlappingVideo.description}"</div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                    💡 그래도 등록하시겠습니까? 관리자가 나중에 중복을 정리할 수 있습니다.
                  </div>
                </div>
              ) : null;
            })()}

            {/* 설명 입력 */}
            <div>
              <label className="block text-sm font-medium text-light-text/80 dark:text-dark-text/80 mb-2">
                설명 (선택사항)
              </label>
              <textarea
                value={addVideoData.description}
                onChange={(e) => setAddVideoData({...addVideoData, description: e.target.value})}
                placeholder="이 라이브 클립에 대한 간단한 설명을 적어주세요..."
                rows={3}
                className="w-full px-4 py-3 bg-white/50 dark:bg-gray-800/50 
                         border border-light-accent/30 dark:border-dark-accent/30 
                         rounded-xl outline-none resize-none
                         focus:border-light-accent dark:focus:border-dark-accent 
                         focus:ring-2 focus:ring-light-accent/20 dark:focus:ring-dark-accent/20
                         text-light-text dark:text-dark-text"
                maxLength={500}
              />
              <div className="text-xs text-light-text/50 dark:text-dark-text/50 mt-1 text-right">
                {addVideoData.description.length}/500
              </div>
            </div>

            {/* 버튼 */}
            <div className="flex gap-2 sm:gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowAddVideoForm(false);
                  // 폼 취소 시 초기화
                  setAddVideoData({
                    videoUrl: '',
                    endVideoUrl: '',
                    sungDate: '',
                    description: '',
                    startTime: 0,
                    endTime: undefined
                  });
                  setVideoMetadata({
                    title: '',
                    extractedDate: '',
                    parsedStartTime: 0,
                    parsedEndTime: undefined
                  });
                }}
                className="flex-1 px-4 py-2 sm:px-6 sm:py-3 bg-gray-100 dark:bg-gray-700 
                         text-gray-700 dark:text-gray-300 
                         rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 
                         transition-colors duration-200 font-medium"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={isAddingVideo || !addVideoData.videoUrl}
                className="flex-1 px-4 py-2 sm:px-6 sm:py-3 bg-gradient-to-r from-light-accent to-light-purple 
                         dark:from-dark-accent dark:to-dark-purple text-white 
                         rounded-xl hover:shadow-lg transform hover:scale-105 
                         transition-all duration-200 font-medium
                         disabled:opacity-50 disabled:transform-none disabled:shadow-none
                         flex items-center justify-center gap-2"
              >
                {isAddingVideo ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    추가 중...
                  </>
                ) : (
                  <>
                    <PlusIcon className="w-4 h-4" />
                    라이브 클립 추가
                  </>
                )}
              </button>
            </div>
          </form>
          </div>
        </motion.div>
      )}
    </div>
    </>
  );
}