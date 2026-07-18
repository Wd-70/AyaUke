import Link from 'next/link';

const SOCIALS = [
  {
    label: 'Chzzk',
    href: 'https://chzzk.naver.com/abe8aa82baf3d3ef54ad8468ee73e7fc',
    hover: 'hover:border-light-accent hover:bg-light-accent dark:hover:border-dark-primary dark:hover:bg-dark-primary',
    icon: (
      <img
        src="/chzzk Icon_02.png"
        alt=""
        className="h-4 w-4 object-contain opacity-70 transition-opacity duration-200 group-hover:opacity-100"
      />
    ),
  },
  {
    label: 'YouTube',
    href: 'https://youtube.com/@AyaUke_Projecti',
    hover: 'hover:border-red-500 hover:bg-red-500',
    icon: (
      <svg className="h-4 w-4 text-gray-500 transition-colors duration-200 group-hover:text-white dark:text-gray-400" viewBox="0 0 24 24" fill="currentColor">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    ),
  },
  {
    label: 'X (Twitter)',
    href: 'https://twitter.com/AyaUke_V',
    hover: 'hover:border-gray-900 hover:bg-gray-900 dark:hover:border-gray-100 dark:hover:bg-gray-100',
    icon: (
      <svg className="h-4 w-4 text-gray-500 transition-colors duration-200 group-hover:text-white dark:text-gray-400 dark:group-hover:text-gray-900" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    label: '팬카페',
    href: 'https://cafe.naver.com/projectiofficial',
    hover: 'hover:border-[#03C75A] hover:bg-[#03C75A]',
    icon: (
      <img
        src="/navercafe2.png"
        alt=""
        className="h-4 w-4 rounded object-contain opacity-70 transition-opacity duration-200 group-hover:opacity-100"
      />
    ),
  },
];

const FOUNDED_YEAR = 2025; // 사이트 운영 시작연도 (저작권 기산점)

export default function Footer() {
  const currentYear = new Date().getFullYear();
  // "2025–2026"처럼 시작~현재 범위로 표기 (같은 해면 단일 연도)
  const yearLabel =
    currentYear > FOUNDED_YEAR ? `${FOUNDED_YEAR}–${currentYear}` : `${FOUNDED_YEAR}`;

  return (
    <footer className="relative border-t border-light-primary/25 bg-gradient-to-b from-light-primary/[0.08] to-white/70 backdrop-blur-sm dark:border-dark-primary/25 dark:from-dark-primary/[0.06] dark:to-gray-900/80">
      {/* 상단 브랜드 헤어라인 */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-light-accent/50 to-transparent dark:via-dark-primary/50" />

      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {/* 브랜드 섹션 */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-light-accent to-light-purple p-1 dark:from-dark-primary dark:to-dark-secondary">
                <img src="/honeyz.png" alt="HONEYZ Logo" className="h-full w-full object-contain" />
              </div>
              <span className="bg-gradient-to-r from-light-accent to-light-purple bg-clip-text text-lg font-bold text-transparent dark:from-dark-primary dark:to-dark-secondary">
                AyaUke
              </span>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-gray-600 dark:text-gray-400">
              허니즈의 메인보컬 아야의 팬이 만든 비공식 페이지입니다.
              노래책과 최신 방송 정보를 제공합니다.
            </p>
          </div>

          {/* 링크 섹션 */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-900 dark:text-white">
              바로가기
            </h3>
            <div className="space-y-2">
              <Link href="/" className="block text-sm text-gray-600 transition-colors duration-200 hover:text-light-accent dark:text-gray-400 dark:hover:text-dark-primary">
                홈
              </Link>
              <Link href="/songbook" className="block text-sm text-gray-600 transition-colors duration-200 hover:text-light-accent dark:text-gray-400 dark:hover:text-dark-primary">
                노래책
              </Link>
              <a
                href="https://chzzk.naver.com/abe8aa82baf3d3ef54ad8468ee73e7fc"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm text-gray-600 transition-colors duration-200 hover:text-light-accent dark:text-gray-400 dark:hover:text-dark-primary"
              >
                치지직 채널
              </a>
            </div>
          </div>

          {/* 소셜 링크 섹션 */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-900 dark:text-white">
              소셜 미디어
            </h3>
            <div className="flex flex-wrap gap-3">
              {SOCIALS.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  title={s.label}
                  className={`group flex h-11 w-11 items-center justify-center rounded-xl border border-light-primary/25 bg-white/70 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-dark-primary/25 dark:bg-gray-800/60 ${s.hover}`}
                >
                  {s.icon}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* 하단 구분선 및 저작권 */}
        <div className="mt-8 border-t border-light-primary/25 pt-8 dark:border-dark-primary/25">
          <div className="flex flex-col items-center justify-between space-y-4 md:flex-row md:space-y-0">
            <div className="text-center text-sm text-gray-600 dark:text-gray-400 md:text-left">
              <div>© {yearLabel} AyaUke Fan Page • 비공식 팬 페이지</div>
              <div className="mt-1 text-xs">Developed by Wd-70</div>
            </div>
            <div className="flex items-center space-x-4 text-xs text-gray-600 dark:text-gray-500">
              <span>HONEYZ 허니즈</span>
              <span>•</span>
              <span>아야 AyaUke</span>
              <span>•</span>
              <span>팬메이드</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
