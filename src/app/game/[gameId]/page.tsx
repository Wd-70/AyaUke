'use client';

import { use } from 'react';
import { notFound } from 'next/navigation';
import { games, getGame } from '../games';
import GameView from '../_components/GameView';

interface GamePageProps {
  params: Promise<{ gameId: string }>;
}

export default function GamePage({ params }: GamePageProps) {
  const { gameId } = use(params);
  const game = getGame(gameId);

  if (!game) {
    notFound();
  }

  // 게임이 여러 개일 때만 '목록으로' 링크를 노출한다.
  return <GameView game={game} showBack={games.length > 1} />;
}
