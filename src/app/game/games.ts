import type { ComponentType } from 'react';
import dynamic from 'next/dynamic';

/**
 * 팬게임 레지스트리.
 *
 * 새 게임을 추가하려면:
 *  1. `src/app/game/_games/<폴더>/` 에 게임 컴포넌트를 만들고
 *  2. 아래 배열에 항목을 한 줄 추가하면 끝.
 * 허브 페이지(/game)와 개별 게임 라우트(/game/[gameId])가 이 배열을 읽어 자동으로 동작합니다.
 */
export interface GameMeta {
  /** URL 슬러그. /game/<id> 로 접근 (영문/숫자/하이픈 권장) */
  id: string;
  /** 게임 제목 */
  title: string;
  /** 허브 카드에 보여줄 한 줄 소개 */
  description: string;
  /** 카드에 표시할 이모지 (간단한 썸네일 대용) */
  emoji: string;
  /** 'ready' = 플레이 가능, 'wip' = 개발 중(허브에서 '준비 중' 표시) */
  status: 'ready' | 'wip';
  /** 실제 게임 화면 컴포넌트. 코드 스플리팅을 위해 dynamic import 사용 */
  component: ComponentType;
}

export const games: GameMeta[] = [
  {
    id: 'super-honeyz',
    title: '슈퍼 허니즈',
    description: '마리오 1 스타일 횡스크롤 액션! 아야와 함께 월드 1-1을 달려보세요. (개발 중 · 임시 그래픽)',
    emoji: '🍯',
    status: 'wip',
    component: dynamic(() => import('./_games/super-honeyz/SuperHoneyzGame'), {
      loading: () => null,
    }),
  },
];

export function getGame(id: string): GameMeta | undefined {
  return games.find((g) => g.id === id);
}
