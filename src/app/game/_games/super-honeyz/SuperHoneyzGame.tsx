'use client';

import { useEffect, useRef } from 'react';
import { Game } from './game/Game';

export default function SuperHoneyzGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const game = new Game(canvas);
    game.start();
    // 표시 크기에 맞춰 내부 해상도 동기화 (텍스트 선명도)
    const ro = new ResizeObserver(() => game.setSize(canvas.clientWidth));
    ro.observe(canvas);
    game.setSize(canvas.clientWidth);
    return () => {
      ro.disconnect();
      game.destroy();
    };
  }, []);

  return (
    <div className="w-full flex flex-col items-center gap-4">
      <canvas
        ref={canvasRef}
        width={320}
        height={240}
        className="w-full max-w-[800px] h-auto rounded-xl border border-gray-300/40 dark:border-gray-600/40 shadow-md bg-[#5c94fc]"
      />
      <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
        ← → 이동 · <kbd className="px-1 rounded bg-gray-100 dark:bg-gray-700">Z</kbd>/
        <kbd className="px-1 rounded bg-gray-100 dark:bg-gray-700">스페이스</kbd> 점프(길게 누르면 높이) ·{' '}
        <kbd className="px-1 rounded bg-gray-100 dark:bg-gray-700">X</kbd>/
        <kbd className="px-1 rounded bg-gray-100 dark:bg-gray-700">Shift</kbd> 달리기
        <br />
        아야 스프라이트 적용 (적·아이템은 임시 그래픽)
      </p>
    </div>
  );
}
