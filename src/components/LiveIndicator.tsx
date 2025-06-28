'use client';

import { useStreamStatus } from '@/hooks/useStreamStatus';

export default function LiveIndicator() {
  const streamInfo = useStreamStatus();

  if (!streamInfo?.isLive) {
    return (
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full 
                      bg-gradient-to-r from-gray-500 to-gray-600 text-white font-medium
                      shadow-lg opacity-50">
        <div className="w-2 h-2 bg-white rounded-full"></div>
        <span className="text-sm font-semibold">OFFLINE</span>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full 
                    bg-gradient-to-r from-red-500 to-pink-500 text-white font-medium
                    shadow-lg animate-pulse">
      <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
      <span className="text-sm font-semibold">LIVE</span>
      {streamInfo.viewers && (
        <span className="text-xs opacity-90">
          {streamInfo.viewers.toLocaleString()}명 시청 중
        </span>
      )}
    </div>
  );
}