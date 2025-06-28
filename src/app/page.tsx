import Navigation from '@/components/Navigation';
import HeroSection from '@/components/HeroSection';

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

      <Navigation currentPath="/" />
      
      <main className="relative z-10">
        <HeroSection />
        
        {/* About Section */}
        <section className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl sm:text-5xl font-bold mb-6">
                <span className="bg-gradient-to-r from-light-accent to-light-purple dark:from-dark-primary dark:to-dark-secondary bg-clip-text text-transparent">
                  아야에 대해
                </span>
              </h2>
              <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
                HONEYZ 소속의 따뜻한 목소리를 가진 버튜버 아야입니다. 
                게임과 노래를 사랑하며, 시청자분들과 함께하는 즐거운 방송을 만들어가고 있어요.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center p-8 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-200/20 dark:border-gray-700/20">
                <div className="w-16 h-16 bg-gradient-to-br from-light-accent to-light-purple dark:from-dark-primary dark:to-dark-secondary rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                  </svg>
                </div>
                <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">노래방송</h3>
                <p className="text-gray-600 dark:text-gray-300">
                  다양한 장르의 노래를 부르며 시청자들과 함께 즐기는 노래방송
                </p>
              </div>
              
              <div className="text-center p-8 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-200/20 dark:border-gray-700/20">
                <div className="w-16 h-16 bg-gradient-to-br from-light-accent to-light-purple dark:from-dark-primary dark:to-dark-secondary rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M15.5 12c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5.67 1.5 1.5 1.5 1.5-.67 1.5-1.5zm4-3c0-.83-.67-1.5-1.5-1.5S16.5 8.17 16.5 9s.67 1.5 1.5 1.5S19.5 9.83 19.5 9zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8 0-1.12.23-2.18.65-3.15L8 10.4v.6c0 .55.45 1 1 1h1v1c0 .55.45 1 1 1h1v1h2c.55 0 1-.45 1-1v-1.59l2.35-2.35C17.77 9.82 18 10.88 18 12c0 3.31-2.69 6-6 6z"/>
                  </svg>
                </div>
                <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">게임방송</h3>
                <p className="text-gray-600 dark:text-gray-300">
                  재미있는 게임들을 플레이하며 웃음이 끊이지 않는 게임방송
                </p>
              </div>
              
              <div className="text-center p-8 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-200/20 dark:border-gray-700/20">
                <div className="w-16 h-16 bg-gradient-to-br from-light-accent to-light-purple dark:from-dark-primary dark:to-dark-secondary rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4l4 4 4-4h4c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
                  </svg>
                </div>
                <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">저스트채팅</h3>
                <p className="text-gray-600 dark:text-gray-300">
                  시청자들과 소통하며 편안한 분위기의 수다 방송
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Recent Streams Section */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50/50 dark:bg-gray-900/50">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl sm:text-5xl font-bold mb-6">
                <span className="bg-gradient-to-r from-light-accent to-light-purple dark:from-dark-primary dark:to-dark-secondary bg-clip-text text-transparent">
                  최근 방송
                </span>
              </h2>
              <p className="text-xl text-gray-600 dark:text-gray-300">
                아야의 최근 방송 하이라이트를 확인해보세요
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <div className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2">
                <div className="aspect-video bg-gradient-to-br from-light-accent/20 to-light-purple/20 dark:from-dark-primary/20 dark:to-dark-secondary/20 flex items-center justify-center">
                  <svg className="w-16 h-16 text-light-accent dark:text-dark-primary" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                  </svg>
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">노래방송 하이라이트</h3>
                  <p className="text-gray-600 dark:text-gray-300 mb-4">감성적인 발라드부터 신나는 댄스곡까지</p>
                  <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                    <span>2일 전</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2">
                <div className="aspect-video bg-gradient-to-br from-light-accent/20 to-light-purple/20 dark:from-dark-primary/20 dark:to-dark-secondary/20 flex items-center justify-center">
                  <svg className="w-16 h-16 text-light-accent dark:text-dark-primary" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M15.5 12c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5.67 1.5 1.5 1.5 1.5-.67 1.5-1.5zm4-3c0-.83-.67-1.5-1.5-1.5S16.5 8.17 16.5 9s.67 1.5 1.5 1.5S19.5 9.83 19.5 9zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8 0-1.12.23-2.18.65-3.15L8 10.4v.6c0 .55.45 1 1 1h1v1c0 .55.45 1 1 1h1v1h2c.55 0 1-.45 1-1v-1.59l2.35-2.35C17.77 9.82 18 10.88 18 12c0 3.31-2.69 6-6 6z"/>
                  </svg>
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">게임방송 모음</h3>
                  <p className="text-gray-600 dark:text-gray-300 mb-4">재미있는 게임 플레이 모음집</p>
                  <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                    <span>4일 전</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2">
                <div className="aspect-video bg-gradient-to-br from-light-accent/20 to-light-purple/20 dark:from-dark-primary/20 dark:to-dark-secondary/20 flex items-center justify-center">
                  <svg className="w-16 h-16 text-light-accent dark:text-dark-primary" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4l4 4 4-4h4c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
                  </svg>
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">저스트채팅</h3>
                  <p className="text-gray-600 dark:text-gray-300 mb-4">시청자들과의 즐거운 수다시간</p>
                  <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                    <span>1주 전</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Community Section */}
        <section className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl sm:text-5xl font-bold mb-8">
              <span className="bg-gradient-to-r from-light-accent to-light-purple dark:from-dark-primary dark:to-dark-secondary bg-clip-text text-transparent">
                함께해요!
              </span>
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-12">
              아야와 함께 즐거운 방송을 만들어가요. 
              언제든지 방송에 놀러와주세요!
            </p>
            
            <div className="flex flex-col sm:flex-row gap-6 justify-center">
              <a
                href="https://chzzk.naver.com/abe8aa82baf3d3ef54ad8468ee73e7fc"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-light-accent to-light-purple dark:from-dark-primary dark:to-dark-secondary text-white font-bold text-lg rounded-2xl shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all duration-300"
              >
                <img 
                  src="/chzzk Icon_02.png" 
                  alt="Chzzk" 
                  className="w-6 h-6 object-contain"
                />
                <span>치지직에서 만나요</span>
              </a>
              
              <a
                href="https://youtube.com/@AyaUke_Projecti"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 px-8 py-4 bg-white/10 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/30 dark:border-gray-700/30 text-gray-700 dark:text-gray-300 font-bold text-lg rounded-2xl hover:bg-white/20 dark:hover:bg-gray-800/70 hover:-translate-y-1 transition-all duration-300"
              >
                <svg className="w-6 h-6 text-red-500" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
                <span>유튜브 구독하기</span>
              </a>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}