import Link from 'next/link';

export default function HeroSection() {
  return (
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
            <span className="bg-gradient-to-r from-light-accent to-light-purple dark:from-dark-primary dark:to-dark-secondary bg-clip-text text-transparent">아야</span>
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
          <Link
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
          </Link>
        </div>

      </div>
    </section>
  );
}