interface ParsedTimelineItem {
  id: string;
  artist: string;
  songTitle: string;
  startTimeSeconds: number;
  endTimeSeconds?: number;
  // 수동 검증 관련 필드
  isTimeVerified?: boolean;
  verifiedBy?: string;
  verifiedAt?: string;
  verificationNotes?: string;
}

/**
 * 시간 검증 상태를 업데이트하는 함수
 */
export async function updateTimeVerification(
  timeline: ParsedTimelineItem, 
  isVerified: boolean, 
  notes?: string
): Promise<{
  success: boolean;
  data?: {
    isTimeVerified: boolean;
    verifiedBy?: string;
    verifiedAt?: string;
  };
  error?: string;
}> {
  try {
    const response = await fetch('/api/timeline-parser', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update-time-verification',
        timelineId: timeline.id,
        isVerified: isVerified,
        verificationNotes: notes || ''
      })
    });

    const result = await response.json();
    
    if (result.success) {
      return {
        success: true,
        data: {
          isTimeVerified: result.data.isTimeVerified,
          verifiedBy: result.data.verifiedBy,
          verifiedAt: result.data.verifiedAt ? new Date(result.data.verifiedAt).toISOString() : undefined
        }
      };
    } else {
      return {
        success: false,
        error: result.error
      };
    }
  } catch (error) {
    console.error('시간 검증 오류:', error);
    return {
      success: false,
      error: '시간 검증 중 오류가 발생했습니다.'
    };
  }
}

/**
 * 검증 상태 표시용 컴포넌트 데이터 생성
 */
export function getVerificationBadgeProps(timeline: ParsedTimelineItem) {
  if (!timeline.isTimeVerified) {
    return null;
  }

  return {
    className: "px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs flex items-center gap-1",
    text: "검증완료"
  };
}