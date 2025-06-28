export default function Home() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-96 h-96 bg-purple-300/20 dark:bg-purple-500/10 
                        rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000"></div>
        <div className="absolute top-40 right-20 w-96 h-96 bg-pink-300/20 dark:bg-pink-500/10 
                        rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000"></div>
        <div className="absolute -bottom-8 left-1/2 w-96 h-96 bg-indigo-300/20 dark:bg-indigo-500/10 
                        rounded-full mix-blend-multiply filter blur-3xl animate-blob"></div>
      </div>

      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-light-primary/20 dark:border-dark-primary/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center space-x-2 group cursor-pointer">
              <div className="w-8 h-8 bg-gradient-to-br from-light-accent to-light-purple dark:from-dark-primary dark:to-dark-secondary rounded-lg flex items-center justify-center text-white font-bold group-hover:scale-105 transition-transform duration-200">
                A
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-light-accent to-light-purple dark:from-dark-primary dark:to-dark-secondary bg-clip-text text-transparent">AyaUke</span>
            </div>
            
            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              <a 
                href="/" 
                className="px-3 py-2 text-sm font-medium text-light-accent dark:text-dark-primary hover:-translate-y-0.5 transition-all duration-200"
              >
                홈
              </a>
              <a 
                href="/songbook" 
                className="px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-light-accent dark:hover:text-dark-primary hover:-translate-y-0.5 transition-all duration-200"
              >
                노래책
              </a>
              <a 
                href="#" 
                className="px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-light-accent dark:hover:text-dark-primary hover:-translate-y-0.5 transition-all duration-200"
              >
                스케줄
              </a>
              <a 
                href="#" 
                className="px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-light-accent dark:hover:text-dark-primary hover:-translate-y-0.5 transition-all duration-200"
              >
                다시보기
              </a>
              <a 
                href="#" 
                className="px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-light-accent dark:hover:text-dark-primary hover:-translate-y-0.5 transition-all duration-200"
              >
                게임
              </a>
            </div>

            {/* Controls */}
            <div className="flex items-center space-x-4">
              <div 
                className="relative p-2 rounded-full bg-light-primary/20 dark:bg-dark-primary/20 hover:bg-light-primary/30 dark:hover:bg-dark-primary/30 transition-all duration-300 group cursor-pointer"
                data-theme-toggle
                aria-label="Toggle theme"
              >
                <div className="relative w-6 h-6">
                  {/* Sun Icon */}
                  <svg 
                    className="absolute inset-0 w-6 h-6 text-light-purple dark:text-dark-text transition-all duration-300 transform dark:opacity-0 dark:rotate-90 dark:scale-75 opacity-100 rotate-0 scale-100"
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor" 
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  
                  {/* Moon Icon */}
                  <svg 
                    className="absolute inset-0 w-6 h-6 text-light-purple dark:text-dark-text transition-all duration-300 transform opacity-0 -rotate-90 scale-75 dark:opacity-100 dark:rotate-0 dark:scale-100"
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor" 
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                </div>
                
                {/* Hover gradient overlay */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-light-accent/0 to-light-accent/20 dark:from-dark-accent/0 dark:to-dark-accent/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </div>
            </div>
          </div>
        </div>
      </nav>
      
      <main className="relative z-10">
        {/* Hero Section - 기존 디자인 참고해서 새로 제작 */}
        <section className="relative h-[900px] flex items-center justify-center overflow-hidden pt-24 pb-16">
          <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            
            {/* 캐릭터 아바타 */}
            <div className="mb-12">
              <div className="relative mx-auto w-64 h-64 sm:w-80 sm:h-80 mb-8">
                <div className="absolute inset-0 bg-gradient-to-br from-light-accent to-light-purple dark:from-dark-primary dark:to-dark-secondary rounded-full opacity-30 blur-2xl animate-pulse"></div>
                <div className="relative w-full h-full rounded-full overflow-hidden shadow-2xl border-4 border-white/30 dark:border-gray-800/30 backdrop-blur-sm">
                  <img 
                    src="/image.png" 
                    alt="아야 AyaUke 프로필" 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent"></div>
                </div>
              </div>
            </div>

            {/* 타이틀 */}
            <div className="mb-8">
              <h1 className="text-5xl sm:text-7xl font-bold mb-4">
                <span className="bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">아야</span>
                <span className="text-gray-900 dark:text-white"> AyaUke</span>
              </h1>
              <p className="text-xl sm:text-2xl text-gray-600 dark:text-gray-300 mb-6 font-medium">
                HONEYZ의 따뜻한 목소리, 게임과 노래를 사랑하는 버튜버
              </p>
              <div className="flex flex-wrap justify-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900 rounded-full">노래방송</span>
                <span className="px-3 py-1 bg-pink-100 dark:bg-pink-900 rounded-full">게임방송</span>
                <span className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900 rounded-full">저스트채팅</span>
                <span className="px-3 py-1 bg-violet-100 dark:bg-violet-900 rounded-full">ISFP</span>
              </div>
            </div>

            {/* 소셜 링크 - 더 세련된 디자인 */}
            <div className="flex flex-wrap justify-center gap-3 mb-12">
              <a
                href="https://chzzk.naver.com/abe8aa82baf3d3ef54ad8468ee73e7fc"
                target="_blank"
                rel="noopener noreferrer"
                className="group relative overflow-hidden px-6 py-3 bg-white/10 dark:bg-gray-800/50 backdrop-blur-sm border border-white/20 dark:border-gray-700/50 rounded-xl text-gray-700 dark:text-gray-300 font-medium hover:text-white hover:border-light-accent dark:hover:border-dark-primary transition-all duration-300 hover:shadow-purple-glow dark:hover:shadow-pink-glow"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-light-accent to-light-purple dark:from-dark-primary dark:to-dark-secondary opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="relative flex items-center gap-2">
                  <span className="text-lg">🎮</span>
                  <span>Chzzk</span>
                </div>
              </a>
              
              <a
                href="https://youtube.com/@AyaUke_Projecti"
                target="_blank"
                rel="noopener noreferrer"
                className="group relative overflow-hidden px-6 py-3 bg-white/10 dark:bg-gray-800/50 backdrop-blur-sm border border-white/20 dark:border-gray-700/50 rounded-xl text-gray-700 dark:text-gray-300 font-medium hover:text-white hover:border-light-accent dark:hover:border-dark-primary transition-all duration-300 hover:shadow-purple-glow dark:hover:shadow-pink-glow"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-light-accent to-light-purple dark:from-dark-primary dark:to-dark-secondary opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="relative flex items-center gap-2">
                  <span className="text-lg">📺</span>
                  <span>YouTube</span>
                </div>
              </a>
              
              <a
                href="https://twitter.com/AyaUke_V"
                target="_blank"
                rel="noopener noreferrer"
                className="group relative overflow-hidden px-6 py-3 bg-white/10 dark:bg-gray-800/50 backdrop-blur-sm border border-white/20 dark:border-gray-700/50 rounded-xl text-gray-700 dark:text-gray-300 font-medium hover:text-white hover:border-light-accent dark:hover:border-dark-primary transition-all duration-300 hover:shadow-purple-glow dark:hover:shadow-pink-glow"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-light-accent to-light-purple dark:from-dark-primary dark:to-dark-secondary opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="relative flex items-center gap-2">
                  <span className="text-lg">🐦</span>
                  <span>X (Twitter)</span>
                </div>
              </a>
            </div>

            {/* 메인 CTA - 더 임팩트 있는 디자인 */}
            <div className="flex justify-center">
              <a
                href="/songbook"
                className="group relative inline-flex items-center gap-4 px-10 py-5 bg-gradient-to-r from-light-accent to-light-purple dark:from-dark-primary dark:to-dark-secondary text-white font-bold text-lg rounded-2xl shadow-2xl hover:shadow-purple-glow dark:hover:shadow-pink-glow hover:-translate-y-2 hover:scale-105 transition-all duration-500"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 rounded-2xl transition-opacity duration-300"></div>
                <div className="relative flex items-center gap-4">
                  <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center group-hover:rotate-12 transition-transform duration-300">
                    <span className="text-xl">🎵</span>
                  </div>
                  <span>노래책 둘러보기</span>
                  <div className="w-2 h-2 bg-white rounded-full opacity-60 group-hover:opacity-100 group-hover:scale-150 transition-all duration-300"></div>
                </div>
              </a>
            </div>

          </div>
        </section>
      </main>
    </div>
  );
}