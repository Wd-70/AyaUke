'use client';

import { useEffect } from 'react';
import { 
  CheckCircleIcon, 
  ExclamationTriangleIcon,
  ClockIcon,
  VideoCameraIcon,
  ChatBubbleBottomCenterTextIcon,
  LinkIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

interface SyncResult {
  totalVideos: number;
  totalTimelineComments: number;
  newVideos: number;
  newComments: number;
  newTimelineComments: number;
  syncDuration: number;
}

interface SyncResultDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  result?: SyncResult;
  isError?: boolean;
}

export default function SyncResultDialog({ 
  isOpen, 
  onClose, 
  title, 
  message, 
  result, 
  isError = false 
}: SyncResultDialogProps) {
  const hasNewData = result && (result.newVideos > 0 || result.newComments > 0);

  // ESC 키로 닫기
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 배경 오버레이 */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* 다이얼로그 */}
      <div className="relative w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-6 text-left shadow-xl transition-all border border-gray-200 dark:border-gray-700 animate-in fade-in-0 zoom-in-95 duration-300">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {isError ? (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
                <ExclamationTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
            ) : hasNewData ? (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
                <CheckCircleIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/20">
                <CheckCircleIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
            )}
            
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {title}
            </h3>
          </div>
          
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors rounded-full p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* 메시지 */}
        <div className="mb-6">
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
            {message}
          </p>
        </div>

        {/* 상세 결과 (새로운 데이터가 있을 때만) */}
        {result && hasNewData && (
          <div className="mb-6 space-y-3">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">수집된 새로운 데이터</h4>
            
            {result.newVideos > 0 && (
              <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <VideoCameraIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <span className="text-blue-800 dark:text-blue-300">
                  새로운 비디오 <strong>{result.newVideos}개</strong>
                </span>
              </div>
            )}
            
            {result.newComments > 0 && (
              <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <ChatBubbleBottomCenterTextIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
                <span className="text-green-800 dark:text-green-300">
                  새로운 댓글 <strong>{result.newComments}개</strong>
                </span>
              </div>
            )}
            
            {result.newTimelineComments > 0 && (
              <div className="flex items-center gap-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <LinkIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                <span className="text-purple-800 dark:text-purple-300">
                  새로운 타임라인 댓글 <strong>{result.newTimelineComments}개</strong>
                </span>
              </div>
            )}
          </div>
        )}

        {/* 처리 시간 */}
        {result && (
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-6">
            <ClockIcon className="h-4 w-4" />
            <span>처리 시간: {result.syncDuration}초</span>
          </div>
        )}

        {/* 액션 버튼 */}
        <div className="flex justify-end">
          <button
            type="button"
            className="inline-flex justify-center rounded-lg border border-transparent bg-blue-600 hover:bg-blue-700 px-4 py-2 text-sm font-medium text-white transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
            onClick={onClose}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}