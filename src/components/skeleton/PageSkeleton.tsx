import Navigation from '@/components/Navigation';

/**
 * 라우트 loading.tsx 공용 스켈레톤.
 * 탭을 누르는 즉시 이 화면이 뜨고(서버 응답 대기 중 이전 화면이 얼어 있지 않게),
 * 상단 내비·하단 탭은 실제 페이지와 같은 자리에 그대로 둔다.
 */
type Variant = 'songbook' | 'grid' | 'list' | 'detail';

const bar = 'animate-pulse rounded bg-light-primary/10 dark:bg-dark-primary/15';

export default function PageSkeleton({ variant, path }: { variant: Variant; path: string }) {
  return (
    <div className="min-h-screen bg-light-background text-light-text dark:bg-dark-background dark:text-dark-text">
      <Navigation currentPath={path} />
      <main
        aria-busy="true"
        aria-label="불러오는 중"
        className="anim-fade mx-auto max-w-6xl px-4 pb-12 pt-20 sm:px-6 sm:pt-24"
        style={{ animationDuration: '400ms', animationDelay: '120ms' }}
      >
        {variant !== 'detail' && (
          <div className="mb-8 space-y-3">
            <div className={`${bar} h-9 w-40 sm:h-11 sm:w-56`} />
            <div className={`${bar} h-4 w-64 max-w-full`} />
          </div>
        )}

        {variant === 'songbook' && (
          <>
            <div className={`${bar} mb-6 h-12 w-full rounded-2xl`} />
            <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 lg:gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex h-52 flex-col rounded-xl border border-light-primary/20 p-6 dark:border-dark-primary/20">
                  <div className={`${bar} mb-2 h-5 w-2/3`} />
                  <div className={`${bar} h-3.5 w-1/3`} />
                  <div className={`${bar} mt-auto h-9 w-full rounded-lg`} />
                </div>
              ))}
            </div>
          </>
        )}

        {variant === 'grid' && (
          <>
            <div className={`${bar} mx-auto mb-6 h-12 w-full max-w-md rounded-2xl`} />
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="overflow-hidden rounded-2xl border border-light-primary/15 dark:border-dark-primary/15">
                  <div className="aspect-video animate-pulse bg-light-primary/10 dark:bg-dark-primary/15" />
                  <div className="space-y-2 p-3">
                    <div className={`${bar} h-4 w-3/4`} />
                    <div className={`${bar} h-3 w-1/2`} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {variant === 'list' && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-2xl border border-light-primary/15 p-3 dark:border-dark-primary/15">
                <div className={`${bar} h-16 w-16 shrink-0 rounded-xl`} />
                <div className="flex-1 space-y-2">
                  <div className={`${bar} h-4 w-1/2`} />
                  <div className={`${bar} h-3 w-1/4`} />
                </div>
              </div>
            ))}
          </div>
        )}

        {variant === 'detail' && (
          <div className="mx-auto max-w-3xl">
            <div className="aspect-video w-full animate-pulse rounded-2xl bg-light-primary/10 dark:bg-dark-primary/15" />
            <div className={`${bar} mt-6 h-7 w-2/3`} />
            <div className={`${bar} mt-3 h-4 w-1/3`} />
            <div className="mt-6 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className={`${bar} h-14 w-full rounded-xl`} />
              ))}
            </div>
          </div>
        )}
        <span className="sr-only">불러오는 중…</span>
      </main>
    </div>
  );
}
