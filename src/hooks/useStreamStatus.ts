'use client';

import { useState, useEffect } from 'react';
import { StreamInfo } from '@/types';

export function useStreamStatus() {
  const [streamInfo, setStreamInfo] = useState<StreamInfo>({
    isLive: false,
    platform: 'chzzk',
  });
  const [previousStatus, setPreviousStatus] = useState(false);

  useEffect(() => {
    const checkStreamStatus = async () => {
      try {
        // 실제 구현에서는 치지직 API나 웹스크래핑을 통해 실시간 상태를 확인
        // 현재는 랜덤하게 생성하여 테스트
        const mockIsLive = Math.random() > 0.7; // 30% 확률로 라이브
        
        const newStreamInfo: StreamInfo = {
          isLive: mockIsLive,
          title: mockIsLive ? '🎵 노래방송 | 신청곡 받아요~' : undefined,
          viewers: mockIsLive ? Math.floor(Math.random() * 500) + 100 : undefined,
          startTime: mockIsLive ? new Date().toISOString() : undefined,
          platform: 'chzzk',
        };

        setStreamInfo(newStreamInfo);

        // 방송 시작 감지
        if (!previousStatus && mockIsLive) {
          // 방송 시작 알림 트리거
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('streamStarted', { 
              detail: newStreamInfo 
            }));
          }
        }

        setPreviousStatus(mockIsLive);
      } catch (error) {
        console.error('Error checking stream status:', error);
      }
    };

    checkStreamStatus();
    
    // 30초마다 상태 확인
    const interval = setInterval(checkStreamStatus, 30000);

    return () => clearInterval(interval);
  }, [previousStatus]);

  return streamInfo;
}