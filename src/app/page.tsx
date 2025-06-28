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

      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center text-white font-bold">
                A
              </div>
              <span className="text-xl font-bold text-gray-900 dark:text-white">AyaUke</span>
            </div>
            <div className="flex items-center space-x-8">
              <a href="/" className="text-gray-900 dark:text-white hover:text-purple-600">홈</a>
              <a href="/songbook" className="text-gray-900 dark:text-white hover:text-purple-600">노래책</a>
              <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-900 cursor-pointer hover:bg-purple-200 dark:hover:bg-purple-800" data-theme-toggle>
                🌙
              </div>
            </div>
          </div>
        </div>
      </nav>
      
      <main className="relative z-10 pt-24">
        <div className="p-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
            아야 AyaUke
          </h1>
          <p className="text-gray-600 dark:text-gray-300 text-xl mt-4">
            HONEYZ의 따뜻한 목소리, 게임과 노래를 사랑하는 버튜버
          </p>
          <div className="mt-8">
            <a 
              href="/songbook" 
              className="inline-block px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium rounded-lg hover:shadow-lg transition-all duration-200"
            >
              노래책 둘러보기
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}