import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '오프라인 · 아야 AyaUke',
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-light-background px-6 text-center text-light-text dark:bg-dark-background dark:text-dark-text">
      <div className="text-4xl">📡</div>
      <h1 className="text-xl font-bold">오프라인 상태예요</h1>
      <p className="max-w-sm text-sm text-light-text/60 dark:text-dark-text/60">
        네트워크에 연결되면 다시 이용할 수 있어요. 영상 재생에는 인터넷 연결이 필요합니다.
      </p>
    </div>
  );
}
