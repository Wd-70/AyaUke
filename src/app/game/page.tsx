'use client';

import Link from 'next/link';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { games } from './games';
import GameView from './_components/GameView';

export default function GameHubPage() {
  // 게임이 하나뿐이면 목록을 거치지 않고 바로 그 게임을 보여준다.
  if (games.length === 1) {
    return <GameView game={games[0]} />;
  }

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

      <Navigation currentPath="/game" />

      <main className="relative z-10 pt-12 sm:pt-16">
        <section className="py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto">
            {/* Header */}
            <div className="text-center mb-12">
              <span className="inline-block mb-4 px-4 py-1.5 rounded-full text-sm font-medium
                               bg-light-primary/20 dark:bg-dark-primary/20
                               text-light-accent dark:text-dark-primary">
                팬메이드 미니게임
              </span>
              <h1 className="text-4xl sm:text-5xl font-bold mb-6">
                <span className="bg-gradient-to-r from-light-accent to-light-purple dark:from-dark-primary dark:to-dark-secondary bg-clip-text text-transparent">
                  프로젝트 아이 팬게임
                </span>
              </h1>
              <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
                허니즈와 아카시아 멤버들로 즐기는 팬메이드 웹게임 모음이에요.
                마음에 드는 게임을 골라 플레이해보세요!
              </p>
            </div>

            {/* Game list */}
            {games.length === 0 ? (
              <p className="text-center text-gray-500 dark:text-gray-400 py-16">
                아직 등록된 게임이 없어요. 곧 채워질 예정이에요!
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {games.map((game) => (
                  <Link key={game.id} href={`/game/${game.id}`} className="group block h-full">
                    <div className="group h-full flex flex-col rounded-3xl p-6
                                    border border-gray-200/40 dark:border-gray-700/40
                                    bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm
                                    transition-all duration-300
                                    group-hover:-translate-y-1 group-hover:shadow-xl">
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl
                                        bg-gradient-to-br from-light-primary/30 to-light-purple/20
                                        dark:from-dark-primary/30 dark:to-dark-secondary/20">
                          {game.emoji}
                        </div>
                        {game.status === 'wip' && (
                          <span className="px-2.5 py-1 rounded-full text-xs font-medium
                                           bg-yellow-100 text-yellow-700
                                           dark:bg-yellow-900/30 dark:text-yellow-400">
                            준비 중
                          </span>
                        )}
                      </div>
                      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                        {game.title}
                      </h2>
                      <p className="text-sm text-gray-600 dark:text-gray-300 flex-1">
                        {game.description}
                      </p>
                      <span className="mt-4 text-sm font-medium text-light-accent dark:text-dark-primary">
                        {game.status === 'ready' ? '플레이하기 →' : '미리보기 →'}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            <p className="text-center text-sm text-gray-400 dark:text-gray-500 mt-10">
              아직 공개 전 페이지예요. 주소를 직접 입력해야만 들어올 수 있어요.
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
