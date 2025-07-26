'use client'

import Navigation from '@/components/Navigation';
import HeroSection from '@/components/HeroSection';
import RecentVideos from '@/components/RecentVideos';
import Footer from '@/components/Footer';
import { useActivity } from '@/hooks/useActivity';

export default function Home() {
  // 메인 페이지 활동 추적
  useActivity()
  
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
                시청자와의 소통을 소중히 여기는 허니즈의 막내! 
                생활애교가 자연스럽게 흘러나오는 치지직의 분내담당! 
                노래할 때는 완전히 다른 모습을 보여주는 허니즈의 메인보컬!
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
                  J-pop을 즐겨 부르며 폭발적인 가창력을 느낄 수 있어요. 
                  노래를 좋아한다면 지나칠 수 없죠!
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
                  로지컬은 좀 부족해도 피지컬은 최상! 
                  (등장인물을 자주 죽이는 건 비밀)
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
                  시청자와의 소통을 소중히 여기는 아야와 함께 
                  재미있는 대화를 나눠보세요.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Recent Videos Section */}
        <RecentVideos />

        {/* Community Section */}
        <section className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl sm:text-5xl font-bold mb-8">
              <span className="bg-gradient-to-r from-light-accent to-light-purple dark:from-dark-primary dark:to-dark-secondary bg-clip-text text-transparent">
                방송 시청하기
              </span>
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-12">
              아야는 당신을 기다리고 있어요.
              방송에서 만나요!
            </p>
            
            <div className="flex flex-col sm:flex-row gap-6 justify-center">
              <a
                href="https://chzzk.naver.com/live/abe8aa82baf3d3ef54ad8468ee73e7fc"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-light-accent to-light-purple dark:from-dark-primary dark:to-dark-secondary text-white font-bold text-lg rounded-2xl shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all duration-300"
              >
                <img 
                  src="/chzzk Icon_02.png" 
                  alt="Chzzk" 
                  className="w-6 h-6 object-contain"
                />
                <span>치지직에서 시청하기</span>
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
                <span>유튜브 영상 보기</span>
              </a>
            </div>
          </div>
        </section>
      </main>
      
      <Footer />
    </div>
  );
}