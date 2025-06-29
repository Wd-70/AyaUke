'use client';

import Link from 'next/link';

export default function HeroSection() {
  // 이미지 조절을 위한 상태 (개발용) - 완료되어 고정값 사용
  const imageSettings = {
    scale: 111, // 확대 (%)
    x: -6, // 가로 이동 (px)
    y: 1, // 세로 이동 (px)
  };
  return (
    <section className="relative h-[900px] flex items-center justify-center overflow-hidden pt-24 pb-16">
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        
        {/* 캐릭터 아바타 */}
        <div className="mb-12">
          <div className="relative mx-auto w-64 h-64 sm:w-80 sm:h-80 mb-8">
            <div className="absolute inset-0 bg-gradient-to-br from-light-accent to-light-purple dark:from-dark-primary dark:to-dark-secondary rounded-full opacity-30 blur-2xl animate-pulse"></div>
            <div className="relative w-full h-full rounded-full overflow-hidden shadow-2xl border-4 border-white/30 dark:border-gray-800/30 backdrop-blur-sm">
              {/* Light mode image */}
              <img 
                src="/profile1.png" 
                alt="아야 AyaUke 프로필" 
                className="w-full h-full object-cover dark:hidden"
              />
              {/* Dark mode image */}
              <img 
                src="/profile2-large.png" 
                alt="아야 AyaUke 프로필" 
                className="w-full h-full object-cover hidden dark:block"
                style={{
                  transform: `scale(${imageSettings.scale / 100}) translate(${imageSettings.x}px, ${imageSettings.y}px)`,
                  transformOrigin: 'center center'
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent"></div>
            </div>
          </div>
        </div>

        {/* 타이틀 */}
        <div className="mb-8">
          <h1 className="text-5xl sm:text-7xl font-bold mb-4">
            <span className="bg-gradient-to-r from-light-accent to-light-purple dark:from-dark-primary dark:to-dark-secondary bg-clip-text text-transparent">아야</span>
            <span className="text-gray-900 dark:text-white"> AyaUke</span>
          </h1>
          <p className="text-xl sm:text-2xl text-gray-600 dark:text-gray-300 mb-6 font-medium">
            허니즈의 메인보컬, 생활애교가 흘러넘치는 치지직의 분내담당
          </p>
          <div className="flex flex-wrap justify-center gap-2 text-sm text-gray-600 dark:text-gray-300">
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
              <img 
                src="/chzzk Icon_02.png" 
                alt="Chzzk" 
                className="w-5 h-5 object-contain"
              />
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
              <svg className="w-5 h-5 text-red-500" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
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
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              <span>(Twitter)</span>
            </div>
          </a>
          
          <a
            href="https://cafe.naver.com/projectiofficial"
            target="_blank"
            rel="noopener noreferrer"
            className="group relative overflow-hidden px-6 py-3 bg-white/10 dark:bg-gray-800/50 backdrop-blur-sm border border-white/20 dark:border-gray-700/50 rounded-xl text-gray-700 dark:text-gray-300 font-medium hover:text-white hover:border-light-accent dark:hover:border-dark-primary transition-all duration-300 hover:shadow-purple-glow dark:hover:shadow-pink-glow"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-light-accent to-light-purple dark:from-dark-primary dark:to-dark-secondary opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative flex items-center gap-2">
              <img 
                src="/navercafe2.png" 
                alt="네이버 카페" 
                className="w-5 h-5 object-contain rounded"
              />
              <span>팬카페</span>
            </div>
          </a>
        </div>

        {/* 메인 CTA - 더 임팩트 있는 디자인 */}
        <div className="flex justify-center">
          <Link
            href="/songbook"
            className="group relative inline-flex items-center gap-4 px-10 py-5 bg-gradient-to-r from-light-accent to-light-purple dark:from-dark-primary dark:to-dark-secondary text-white font-bold text-lg rounded-2xl shadow-2xl hover:shadow-purple-glow dark:hover:shadow-pink-glow hover:-translate-y-2 hover:scale-105 transition-all duration-500"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 rounded-2xl transition-opacity duration-300"></div>
            <div className="relative flex items-center gap-4">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center group-hover:rotate-12 transition-transform duration-300">
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                </svg>
              </div>
              <span>노래책 둘러보기</span>
              <div className="w-2 h-2 bg-white rounded-full opacity-60 group-hover:opacity-100 group-hover:scale-150 transition-all duration-300"></div>
            </div>
          </Link>
        </div>

        {/* 개발 환경 전용 이미지 조절 패널 - 완료되어 주석처리 */}
        {/* {isDevelopment && (
          <div className="fixed bottom-4 right-4 bg-black/80 text-white p-4 rounded-lg z-50 backdrop-blur">
            <h3 className="text-sm font-bold mb-3">🎨 다크모드 이미지 조절</h3>
            
            <div className="space-y-3 text-xs">
              <div>
                <label className="block mb-1">확대 ({imageSettings.scale}%)</label>
                <input
                  type="range"
                  min="100"
                  max="200"
                  value={imageSettings.scale}
                  onChange={(e) => setImageSettings(prev => ({ ...prev, scale: Number(e.target.value) }))}
                  className="w-full"
                />
              </div>
              
              <div>
                <label className="block mb-1">가로 이동 ({imageSettings.x}px)</label>
                <input
                  type="range"
                  min="-50"
                  max="50"
                  value={imageSettings.x}
                  onChange={(e) => setImageSettings(prev => ({ ...prev, x: Number(e.target.value) }))}
                  className="w-full"
                />
              </div>
              
              <div>
                <label className="block mb-1">세로 이동 ({imageSettings.y}px)</label>
                <input
                  type="range"
                  min="-50"
                  max="50"
                  value={imageSettings.y}
                  onChange={(e) => setImageSettings(prev => ({ ...prev, y: Number(e.target.value) }))}
                  className="w-full"
                />
              </div>
              
              <button
                onClick={() => setImageSettings({ scale: 111, x: -6, y: 1 })}
                className="w-full bg-purple-600 hover:bg-purple-700 py-1 px-2 rounded text-xs"
              >
                초기화
              </button>
              
              <div className="bg-gray-800 p-2 rounded text-xs font-mono">
                <div>scale: {imageSettings.scale}</div>
                <div>x: {imageSettings.x}</div>
                <div>y: {imageSettings.y}</div>
              </div>
            </div>
          </div>
        )} */}

      </div>
    </section>
  );
}