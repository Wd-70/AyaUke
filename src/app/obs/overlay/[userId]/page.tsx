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

  useEffect(() => {
    if (!userId) return;

    let previousDataStr = '';
    let intervalId: NodeJS.Timeout;
    let isHighFrequency = false;
    let lastChangeTime = 0;

    const fetchData = async () => {
      try {
        const response = await fetch(`/api/obs/current/${userId}`);
        const data = await response.json();
        const currentDataStr = JSON.stringify(data);
        
        // 상태 변경 감지
        if (previousDataStr && previousDataStr !== currentDataStr) {
          console.log('🔄 OBS 상태 변경 감지');
          isHighFrequency = true;
          lastChangeTime = Date.now();
          
          // 고빈도 모드로 전환
          clearInterval(intervalId);
          startPolling(1000);
        }
        
        previousDataStr = currentDataStr;
        setObsData(data);
        setIsLoading(false);
      } catch (error) {
        console.error('OBS 데이터 조회 오류:', error);
        setObsData({ active: false, message: 'Error loading data' });
        setIsLoading(false);
      }
    };

    const startPolling = (interval: number) => {
      console.log(`📡 폴링 ${interval === 1000 ? '고빈도' : '기본'} 모드: ${interval}ms`);
      intervalId = setInterval(() => {
        
        // 30분 경과 체크 (고빈도 모드일 때만)
        if (isHighFrequency && Date.now() - lastChangeTime > 30 * 60 * 1000) {
          console.log('⏰ 30분 경과 - 기본 모드로 복귀');
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

  if (!obsData?.active || !obsData.currentSong) {
    // OBS가 비활성 상태일 때는 아무것도 표시하지 않음
    return <div className="min-h-screen bg-transparent"></div>;
  }

  return (
    <div className="min-h-screen bg-transparent flex items-end justify-center p-8">
      <div className="bg-black/80 backdrop-blur-sm rounded-lg px-6 py-4 border border-purple-500/30 shadow-2xl">
        <div className="text-center">
          <div className="text-purple-300 text-sm font-medium mb-1">Now Playing</div>
          <div className="text-white text-xl font-bold mb-1">{obsData.currentSong.title}</div>
          <div className="text-purple-200 text-lg">{obsData.currentSong.artist}</div>
        </div>
      </div>
    </div>
  );
}