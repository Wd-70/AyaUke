'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface CurrentSong {
  title: string;
  artist: string;
}

interface OBSData {
  active: boolean;
  currentSong?: CurrentSong;
  message?: string;
}

export default function OBSOverlayPage() {
  const params = useParams();
  const userId = params.userId as string;
  const [obsData, setObsData] = useState<OBSData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showOverlay, setShowOverlay] = useState(false);
  const [animationState, setAnimationState] = useState<'entering' | 'visible' | 'exiting' | 'hidden'>('hidden');
  const [lastValidSong, setLastValidSong] = useState<CurrentSong | null>(null);

  useEffect(() => {
    if (!userId) return;

    let previousDataStr = '';
    let previousActive: boolean | null = null; // useEffect 내부에서 관리
    let intervalId: NodeJS.Timeout;
    let isHighFrequency = false;
    let lastChangeTime = 0;

    const fetchData = async () => {
      try {
        const response = await fetch(`/api/obs/status/${userId}`);
        const data = await response.json();
        const currentDataStr = JSON.stringify(data);
        
        // 상태 변경 감지
        if (previousDataStr && previousDataStr !== currentDataStr) {
          isHighFrequency = true;
          lastChangeTime = Date.now();
          
          // 고빈도 모드로 전환
          clearInterval(intervalId);
          startPolling(2000);
        }
        
        previousDataStr = currentDataStr;
        
        // 애니메이션 상태 관리 - 상태 변화가 있을 때만 실행
        const currentActive = data?.active && !!data?.currentSong;
        
        // 유효한 곡 정보가 있을 때 저장
        if (currentActive && data?.currentSong) {
          setLastValidSong(data.currentSong);
        }
        
        if (previousActive !== null && previousActive !== currentActive) {
          // 상태가 변했을 때만 애니메이션 실행
          if (currentActive) {
            // 비활성 → 활성: 나타남 애니메이션
            setAnimationState('entering');
            setShowOverlay(true);
            setTimeout(() => setAnimationState('visible'), 100);
          } else {
            // 활성 → 비활성: 사라짐 애니메이션
            setAnimationState('exiting');
            setTimeout(() => {
              setShowOverlay(false);
              setAnimationState('hidden');
            }, 500);
          }
        } else if (previousActive === null) {
          // 초기 로드: 애니메이션 없이 상태만 설정
          if (currentActive) {
            setShowOverlay(true);
            setAnimationState('visible');
          } else {
            setShowOverlay(false);
            setAnimationState('hidden');
          }
        }
        
        previousActive = currentActive; // 지역 변수로 직접 업데이트
        setObsData(data);
        setIsLoading(false);
      } catch (error) {
        console.error('OBS 데이터 조회 오류:', error);
        setObsData({ active: false, message: 'Error loading data' });
        setIsLoading(false);
      }
    };

    const startPolling = (interval: number) => {
      intervalId = setInterval(() => {
        
        // 20분 경과 체크 (고빈도 모드일 때만) - 더 빠른 복귀
        if (isHighFrequency && Date.now() - lastChangeTime > 20 * 60 * 1000) {
          isHighFrequency = false;
          clearInterval(intervalId);
          startPolling(7000); // 기본 모드로 복귀
          return;
        }
        
        fetchData();
      }, interval);
    };

    // 초기 로드 후 기본 폴링 시작
    fetchData().then(() => {
      startPolling(7000); // 기본 7초 간격
    });

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [userId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="text-white text-lg font-medium">Loading...</div>
      </div>
    );
  }

  // showOverlay가 true이거나 애니메이션 중일 때 렌더링
  const shouldShowContent = showOverlay || animationState === 'exiting';

  return (
    <div className="min-h-screen bg-transparent flex items-end justify-start p-6">
      {shouldShowContent && (
        <div className={`relative overflow-hidden transition-all duration-500 ease-out min-w-52 ${
          animationState === 'entering' 
            ? 'opacity-0 transform translate-y-8 scale-95' 
            : animationState === 'visible'
            ? 'opacity-100 transform translate-y-0 scale-100'
            : animationState === 'exiting'
            ? 'opacity-0 transform translate-y-4 scale-95'
            : 'opacity-0 transform translate-y-8 scale-95'
        }`}>
          {/* 메인 컨테이너 - 사이트 컬러 팔레트 적용 */}
          <div className="relative bg-gradient-to-br from-light-primary/30 via-light-accent/25 to-light-purple/30 
                          dark:from-dark-secondary/30 dark:via-dark-accent/25 dark:to-dark-purple/30
                          backdrop-blur-sm rounded-2xl px-6 py-4 min-w-52
                          border border-light-accent/20 dark:border-dark-accent/20 
                          shadow-xl shadow-light-accent/10 dark:shadow-dark-accent/10
                          transform transition-all duration-300 overflow-hidden">
            
            {/* 배경 장식 요소들 - 컨테이너 내부에 맞게 조정 */}
            <div className="absolute top-1 right-1 w-16 h-16 bg-gradient-to-br from-light-accent/8 to-light-purple/8 
                            dark:from-dark-accent/8 dark:to-dark-purple/8 rounded-full blur-lg transform translate-x-6 -translate-y-6"></div>
            <div className="absolute bottom-1 left-1 w-14 h-14 bg-gradient-to-tr from-light-purple/6 to-light-accent/6 
                            dark:from-dark-purple/6 dark:to-dark-accent/6 rounded-full blur-md transform -translate-x-6 translate-y-6"></div>
            
            {/* 음표 아이콘 - 빨간색 하이라이트 */}
            <div className="absolute top-3 right-3 text-dark-primary/40">
              <svg className="w-5 h-5 animate-pulse" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
              </svg>
            </div>
            
            {/* 컨텐츠 */}
            <div className="relative z-10">
              {/* "지금 부르는 중" 라벨 - 빨간색 하이라이트 */}
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1.5 h-1.5 bg-dark-primary rounded-full animate-pulse"></div>
                <span className="text-white text-xs font-medium tracking-wide">
                  ♪ 지금 부르는 중
                </span>
                <div className="flex-1 h-px bg-gradient-to-r from-dark-primary/40 to-transparent"></div>
              </div>
              
              {/* 곡 제목 - 흰색 텍스트 */}
              <div className="mb-1">
                <h2 className="text-xl font-bold leading-tight text-white drop-shadow-md">
                  {(animationState === 'exiting' ? lastValidSong?.title : obsData?.currentSong?.title) || 'Loading...'}
                </h2>
              </div>
              
              {/* 아티스트 - 흰색 텍스트 */}
              <div className="flex items-center gap-2">
                <div className="w-0.5 h-0.5 bg-white/70 rounded-full"></div>
                <p className="text-white/90 text-base font-medium">
                  {(animationState === 'exiting' ? lastValidSong?.artist : obsData?.currentSong?.artist) || 'Artist'}
                </p>
              </div>
            </div>
            
            {/* 하단 장식 라인 - 빨간색 하이라이트 그라디언트 */}
            <div className="absolute bottom-0 left-0 right-0 h-0.5 
                            bg-gradient-to-r from-dark-primary/50 via-light-purple/30 to-dark-primary/50"></div>
          </div>
          
          {/* 외곽 글로우 효과 - 보라색과 빨간색 하이라이트 조합 */}
          <div className="absolute inset-0 
                          bg-gradient-to-br from-light-purple/5 via-dark-primary/4 to-light-accent/5 
                          rounded-2xl blur-xl scale-110 -z-10 animate-pulse"></div>
        </div>
      )}
    </div>
  );
}