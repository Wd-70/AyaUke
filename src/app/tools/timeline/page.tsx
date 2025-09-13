import { Suspense } from 'react';
import TimelineToolsClient from './TimelineToolsClient';

export const metadata = {
  title: '타임라인 도구 - 아야 팬사이트',
  description: '타임라인 조정 및 타임스탬프 파싱 도구 모음입니다.',
};

function TimelineToolsLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-light-accent dark:border-dark-accent"></div>
    </div>
  );
}

export default function TimelineToolsPage() {
  return (
    <Suspense fallback={<TimelineToolsLoading />}>
      <TimelineToolsClient />
    </Suspense>
  );
}