import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import ActivityTracker from '@/components/ActivityTracker';
import HeroV2 from '@/components/landing/HeroV2';
import NumbersSection from '@/components/landing/NumbersSection';
import AboutSection from '@/components/landing/AboutSection';
import SongbookPreview from '@/components/landing/SongbookPreview';
import RecentVideosV2 from '@/components/landing/RecentVideosV2';

export default function Home() {
  return (
    <div className="min-h-screen bg-light-background text-light-text dark:bg-dark-background dark:text-dark-text">
      <ActivityTracker />
      <Navigation />
      <main className="relative">
        <HeroV2 />
        <NumbersSection />
        <AboutSection />
        <SongbookPreview />
        <RecentVideosV2 />
      </main>
      <Footer />
    </div>
  );
}
