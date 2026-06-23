import type { Metadata } from 'next';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import ClipsGallery from '@/components/clip/ClipsGallery';

export const metadata: Metadata = {
  title: '라이브 클립 - 아야 AyaUke',
  description: '아야가 부른 라이브 클립을 인기순·최신순으로 모아보고, 곡 제목과 가수로 검색해보세요.',
  openGraph: {
    title: '아야 AyaUke 라이브 클립',
    description: '아야가 부른 라이브 클립 모음 — 인기순·최신순 탐색, 검색.',
    type: 'website',
  },
};

export default function ClipsPage() {
  return (
    <div className="min-h-screen bg-light-background text-light-text dark:bg-dark-background dark:text-dark-text">
      <Navigation />
      <ClipsGallery />
      <Footer />
    </div>
  );
}
