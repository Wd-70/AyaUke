'use client';

import { useState } from 'react';
import { CheckCircleIcon, ClockIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { ParsedTimelineItem } from '@/domains/archive/parsed-timeline.types';

interface TimeVerificationSectionProps {
  timeline: ParsedTimelineItem;
  onVerificationUpdate: (timeline: ParsedTimelineItem, isVerified: boolean, notes?: string) => Promise<void>;
}

export default function TimeVerificationSection({ 
  timeline, 
  onVerificationUpdate 
}: TimeVerificationSectionProps) {
  const [isUpdating, setIsUpdating] = useState(false);

  const handleVerificationToggle = async (isVerified: boolean, notes?: string) => {
    setIsUpdating(true);
    try {
      await onVerificationUpdate(timeline, isVerified, notes);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-gray-900 dark:text-white">시간 검증</h4>
        <div className="flex items-center gap-2">
          {timeline.isTimeVerified ? (
            <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded text-xs font-medium flex items-center gap-1">
              <CheckCircleIcon className="w-3 h-3" />
              검증 완료
            </span>
          ) : (
            <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded text-xs font-medium flex items-center gap-1">
              <ClockIcon className="w-3 h-3" />
              검증 필요
            </span>
          )}
        </div>
      </div>
      
      <div className="space-y-3">
        {timeline.isTimeVerified && (
          <div className="bg-white dark:bg-gray-800 rounded p-3 border border-green-200 dark:border-green-700">
            <div className="text-xs text-green-700 dark:text-green-300 space-y-1">
              <p><strong>검증자:</strong> {timeline.verifiedBy}</p>
              {timeline.verifiedAt && (
                <p><strong>검증 시간:</strong> {new Date(timeline.verifiedAt).toLocaleString('ko-KR')}</p>
              )}
              {timeline.verificationNotes && (
                <p><strong>메모:</strong> {timeline.verificationNotes}</p>
              )}
            </div>
          </div>
        )}
        
        <div className="flex gap-2">
          {!timeline.isTimeVerified ? (
            <button
              onClick={() => handleVerificationToggle(true, '시간 검증 완료')}
              disabled={isUpdating}
              className="px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed text-white rounded text-sm transition-colors flex items-center gap-2"
            >
              {isUpdating ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <CheckCircleIcon className="w-4 h-4" />
              )}
              검증 완료
            </button>
          ) : (
            <button
              onClick={() => handleVerificationToggle(false)}
              disabled={isUpdating}
              className="px-3 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded text-sm transition-colors flex items-center gap-2"
            >
              {isUpdating ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <XMarkIcon className="w-4 h-4" />
              )}
              검증 해제
            </button>
          )}
        </div>
        
        <div className="text-xs text-gray-600 dark:text-gray-400">
          💡 자동 파싱된 시간이 정확한지 확인 후 검증 완료를 클릭하세요.
        </div>
      </div>
    </div>
  );
}