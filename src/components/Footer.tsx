import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-gray-50/80 dark:bg-gray-900/80 backdrop-blur-sm border-t border-gray-200/50 dark:border-gray-700/50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* 브랜드 섹션 */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-light-accent to-light-purple dark:from-dark-primary dark:to-dark-secondary rounded-lg flex items-center justify-center p-1">
                <img src="/honeyz.png" alt="HONEYZ Logo" className="w-full h-full object-contain" />
              </div>
              <span className="text-lg font-bold bg-gradient-to-r from-light-accent to-light-purple dark:from-dark-primary dark:to-dark-secondary bg-clip-text text-transparent">
                AyaUke
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 max-w-sm">
              허니즈의 메인보컬 아야의 팬이 만든 비공식 페이지입니다. 
              노래책과 최신 방송 정보를 제공합니다.
            </p>
          </div>

          {/* 링크 섹션 */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
              바로가기
            </h3>
            <div className="space-y-2">
              <Link href="/" className="block text-sm text-gray-600 dark:text-gray-400 hover:text-light-accent dark:hover:text-dark-primary transition-colors duration-200">
                홈
              </Link>
              <Link href="/songbook" className="block text-sm text-gray-600 dark:text-gray-400 hover:text-light-accent dark:hover:text-dark-primary transition-colors duration-200">
                노래책
              </Link>
              <a 
                href="https://chzzk.naver.com/abe8aa82baf3d3ef54ad8468ee73e7fc" 
                target="_blank" 
                rel="noopener noreferrer"
                className="block text-sm text-gray-600 dark:text-gray-400 hover:text-light-accent dark:hover:text-dark-primary transition-colors duration-200"
              >
                치지직 채널
              </a>
            </div>
          </div>

          {/* 소셜 링크 섹션 */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
              소셜 미디어
            </h3>
            <div className="flex space-x-4">
              <a
                href="https://chzzk.naver.com/abe8aa82baf3d3ef54ad8468ee73e7fc"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center hover:bg-light-accent dark:hover:bg-dark-primary transition-colors duration-200 group"
                aria-label="Chzzk"
              >
                <img 
                  src="/chzzk Icon_02.png" 
                  alt="Chzzk" 
                  className="w-4 h-4 object-contain opacity-70 group-hover:opacity-100 transition-opacity duration-200"
                />
              </a>
              <a
                href="https://youtube.com/@AyaUke_Projecti"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center hover:bg-red-500 transition-colors duration-200 group"
                aria-label="YouTube"
              >
                <svg className="w-4 h-4 text-gray-600 dark:text-gray-400 group-hover:text-white transition-colors duration-200" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              </a>
              <a
                href="https://twitter.com/AyaUke_V"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center hover:bg-gray-900 dark:hover:bg-gray-200 transition-colors duration-200 group"
                aria-label="Twitter"
              >
                <svg className="w-4 h-4 text-gray-600 dark:text-gray-400 group-hover:text-white dark:group-hover:text-gray-900 transition-colors duration-200" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
            </div>
          </div>
        </div>

        {/* 하단 구분선 및 저작권 */}
        <div className="mt-8 pt-8 border-t border-gray-200/50 dark:border-gray-700/50">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="text-sm text-gray-500 dark:text-gray-400 text-center md:text-left">
              <div>© 2025 AyaUke Fan Page • 비공식 팬 페이지</div>
              <div className="text-xs mt-1">Developed by Wd-70</div>
            </div>
            <div className="flex items-center space-x-4 text-xs text-gray-400 dark:text-gray-500">
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