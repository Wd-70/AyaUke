import type { Metadata } from 'next';
import PlayerClient from './PlayerClient';

export const metadata: Metadata = {
  title: '플레이어 · 아야 AyaUke',
  description: '내 클립 플레이리스트를 앱처럼 이어서 감상하세요.',
};

export default function PlayerPage() {
  return <PlayerClient />;
}
