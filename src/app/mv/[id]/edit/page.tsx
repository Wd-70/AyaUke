import type { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import MvTimingEditor from '@/components/mv/MvTimingEditor';
import { hasMv } from '@/components/mv/registry';
import { connectDB } from '@/shared/db/mongodb';
import { getPublicClip } from '@/domains/archive/clip.service';

interface MvEditPageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'MV 타이밍 편집 (로컬)',
  robots: { index: false, follow: false },
};

/** 로컬 전용 가사 타이밍 편집기 — `npm run dev`에서만 열린다(운영 404) */
export default async function MvEditPage({ params }: MvEditPageProps) {
  if (process.env.NODE_ENV !== 'development') notFound();
  const { id } = await params;
  await connectDB();
  const clip = await getPublicClip(id);
  if (!clip || !clip.available || !hasMv(clip)) notFound();

  return (
    <main className="min-h-screen bg-[#0d0b11] px-4 py-6 text-white sm:px-6">
      <h1 className="mx-auto mb-4 max-w-6xl text-sm font-semibold uppercase tracking-[0.2em] text-white/60">
        MV 가사 타이밍 편집 · 로컬 전용
      </h1>
      <Suspense>
        <MvTimingEditor
          clip={{
            id: clip.id,
            shareId: clip.shareId,
            songId: clip.songId,
            platform: clip.platform,
            videoId: clip.videoId,
            startTime: clip.startTime,
            endTime: clip.endTime,
            title: clip.title,
            artist: clip.artist,
            sungDateLabel: clip.sungDateLabel,
            uploaderName: clip.uploaderName,
            thumbnailUrl: clip.thumbnailUrl,
          }}
        />
      </Suspense>
    </main>
  );
}
