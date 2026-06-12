'use client';

import Link from 'next/link';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import type { GameMeta } from '../games';

interface GameViewProps {
  game: GameMeta;
  /** 목록으로 돌아가는 링크를 보여줄지 (게임이 2개 이상일 때만 의미 있음) */
  showBack?: boolean;
}

/**
 * 단일 게임 플레이 화면.
 * 게임이 하나뿐일 때의 /game 허브와, /game/[gameId] 개별 라우트가 함께 사용합니다.
 */
export default function GameView({ game, showBack = false }: GameViewProps) {
  const GameComponent = game.component;

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
        <section className="py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto">
            {showBack && (
              <Link
                href="/game"
                className="inline-flex items-center gap-1.5 mb-6 text-sm font-medium
                           text-gray-500 dark:text-gray-400
                           hover:text-light-accent dark:hover:text-dark-primary transition-colors"
              >
                <span aria-hidden>←</span> 게임 목록으로
              </Link>
            )}

            {/* Title */}
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl
                              bg-gradient-to-br from-light-primary/30 to-light-purple/20
                              dark:from-dark-primary/30 dark:to-dark-secondary/20">
                {game.emoji}
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                  {game.title}
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">{game.description}</p>
              </div>
            </div>

            {/* Game stage */}
            <div className="rounded-3xl border border-gray-200/40 dark:border-gray-700/40
                            bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm shadow-lg
                            min-h-[420px] sm:min-h-[520px] p-6 sm:p-10
                            flex items-center justify-center">
              <GameComponent />
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
