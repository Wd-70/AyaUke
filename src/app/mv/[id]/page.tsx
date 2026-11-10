import type { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import MvStage from '@/components/mv/MvStage';
import { hasMv } from '@/components/mv/registry';
import { connectDB } from '@/shared/db/mongodb';
import { getPublicClip } from '@/domains/archive/clip.service';

interface MvPageProps {
  params: Promise<{ id: string }>;
}

export const revalidate = 120;

// 시범 제작 단계 — 검색 비노출
export const metadata: Metadata = {
  title: 'Clip MV | 아야 AyaUke',
  robots: { index: false, follow: false },
};

export default async function MvPage({ params }: MvPageProps) {
  const { id } = await params;
  if (!hasMv(id)) notFound();
  await connectDB();
  const clip = await getPublicClip(id);
  if (!clip) notFound();

  return (
    <div className="min-h-screen bg-light-background text-light-text dark:bg-dark-background dark:text-dark-text">
      <Navigation />
      <main className="px-4 pb-16 pt-24 sm:px-6">
        <Suspense>
          <MvStage
            shareId={clip.shareId}
            clip={{
              id: clip.id,
              platform: clip.platform,
              videoId: clip.videoId,
              title: clip.title,
              artist: clip.artist,
              sungDateLabel: clip.sungDateLabel,
              uploaderName: clip.uploaderName,
              thumbnailUrl: clip.thumbnailUrl,
            }}
          />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
