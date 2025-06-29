import Link from 'next/link';

export default function SimpleNavigation() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center text-white font-bold">
              A
            </div>
            <span className="text-xl font-bold text-gray-800">AyaUke</span>
          </div>

          {/* Navigation */}
          <div className="flex items-center space-x-8">
            <Link href="/" className="text-gray-700 hover:text-purple-600">
              홈
            </Link>
            <Link href="/songbook" className="text-gray-700 hover:text-purple-600">
              노래책
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}