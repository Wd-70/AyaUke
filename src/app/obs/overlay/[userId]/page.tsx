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
          startPolling(1000);
        }
        
        previousDataStr = currentDataStr;
        
        // 애니메이션 상태 관리 - 상태 변화가 있을 때만 실행
        const currentActive = data?.active && !!data?.currentSong;
        
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
        
        // 5분 경과 체크 (고빈도 모드일 때만) - 더 빠른 복귀
        if (isHighFrequency && Date.now() - lastChangeTime > 5 * 60 * 1000) {
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
        <div className={`relative overflow-hidden transition-all duration-500 ease-out ${
          animationState === 'entering' 
            ? 'opacity-0 transform translate-y-8 scale-95' 
            : animationState === 'visible'
            ? 'opacity-100 transform translate-y-0 scale-100'
            : animationState === 'exiting'
            ? 'opacity-0 transform translate-y-4 scale-95'
            : 'opacity-0 transform translate-y-8 scale-95'
        }`}>
          {/* 메인 컨테이너 - 높은 투명도로 수정 */}
          <div className="relative bg-gradient-to-br from-purple-900/40 via-pink-800/35 to-purple-900/40 
                          backdrop-blur-sm rounded-2xl px-6 py-4 
                          border border-purple-400/20 shadow-xl shadow-purple-500/10
                          transform transition-all duration-300">
            
            {/* 배경 장식 요소들 - 더 투명하게 */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-pink-400/10 to-purple-500/10 rounded-full blur-xl transform translate-x-12 -translate-y-12"></div>
            <div className="absolute bottom-0 left-0 w-20 h-20 bg-gradient-to-tr from-purple-500/8 to-pink-400/8 rounded-full blur-lg transform -translate-x-10 translate-y-10"></div>
            
            {/* 음표 아이콘 */}
            <div className="absolute top-3 right-3 text-pink-300/25">
              <svg className="w-5 h-5 animate-pulse" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
              </svg>
            </div>
            
            {/* 컨텐츠 */}
            <div className="relative z-10">
              {/* "지금 부르는 중" 라벨 */}
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1.5 h-1.5 bg-pink-400/80 rounded-full animate-pulse"></div>
                <span className="text-pink-200/90 text-xs font-medium tracking-wide">
                  ♪ 지금 부르는 중
                </span>
                <div className="flex-1 h-px bg-gradient-to-r from-pink-400/30 to-transparent"></div>
              </div>
              
              {/* 곡 제목 */}
              <div className="mb-1">
                <h2 className="text-white/95 text-xl font-bold leading-tight
                             bg-gradient-to-r from-white/95 via-pink-100/90 to-purple-100/90 bg-clip-text text-transparent
                             drop-shadow-md">
                  {obsData?.currentSong?.title || 'Loading...'}
                </h2>
              </div>
              
              {/* 아티스트 */}
              <div className="flex items-center gap-2">
                <div className="w-0.5 h-0.5 bg-purple-300/70 rounded-full"></div>
                <p className="text-purple-200/85 text-base font-medium">
                  {obsData?.currentSong?.artist || 'Artist'}
                </p>
              </div>
            </div>
            
            {/* 하단 장식 라인 - 더 투명하게 */}
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-pink-500/40 via-purple-500/40 to-pink-500/40"></div>
          </div>
          
          {/* 외곽 글로우 효과 - 더 투명하게 */}
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/8 to-pink-500/8 rounded-2xl blur-xl scale-110 -z-10 animate-pulse"></div>
        </div>
      )}
    </div>
  );
}