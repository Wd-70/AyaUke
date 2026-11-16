import type { Metadata } from 'next';
import Link from 'next/link';
import Navigation from '@/components/Navigation';

export const metadata: Metadata = {
  title: '페이지를 찾을 수 없어요 - 아야 AyaUke',
  robots: { index: false },
};

export default function NotFound() {
  return (
    <div className="min-h-screen bg-light-background text-light-text dark:bg-dark-background dark:text-dark-text">
      <Navigation currentPath="/404" />
      <main className="mx-auto flex min-h-[80vh] max-w-md flex-col items-center justify-center px-6 pt-16 text-center">
        <p className="anim-rise font-display text-7xl font-extrabold">
          <span className="bg-gradient-to-r from-light-title-1 via-light-title-2 to-light-title-3 bg-clip-text text-transparent dark:from-dark-accent dark:via-dark-secondary dark:to-dark-primary">
            404
          </span>
        </p>
        <h1 className="anim-rise mt-4 text-xl font-bold" style={{ animationDelay: '80ms' }}>
          이 노래는 노래책에 없어요
        </h1>
        <p className="anim-rise mt-2 break-keep text-sm text-light-text/65 dark:text-dark-text/60" style={{ animationDelay: '140ms' }}>
          주소가 바뀌었거나 삭제된 페이지예요. 공유받은 링크라면 만료되었을 수 있어요.
        </p>
        <div className="anim-rise mt-8 flex w-full flex-col gap-2 sm:flex-row sm:justify-center" style={{ animationDelay: '200ms' }}>
          <Link
            href="/songbook"
            className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-gradient-to-r from-light-cta-accent to-light-cta-purple px-6 font-semibold text-white shadow-lg transition-transform active:scale-[0.98] dark:from-dark-primary dark:to-dark-secondary"
          >
            노래책 둘러보기
          </Link>
          <Link
            href="/"
            className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-light-primary/30 px-6 font-semibold transition-colors hover:bg-light-primary/10 dark:border-dark-primary/30 dark:hover:bg-dark-primary/10"
          >
            홈으로
          </Link>
        </div>
      </main>
    </div>
  );
}
