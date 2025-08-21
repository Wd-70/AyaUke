'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function TimelineAdjusterRedirect() {
  const router = useRouter();

  useEffect(() => {
    // /tools/timeline으로 리다이렉트
    router.replace('/tools/timeline');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-light-primary/10 via-white to-light-secondary/10 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-light-accent dark:border-dark-primary mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">
          타임라인 도구로 이동 중...
        </p>
      </div>
    </div>
  );
}