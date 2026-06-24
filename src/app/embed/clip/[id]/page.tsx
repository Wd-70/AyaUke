import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { connectDB } from '@/shared/db/mongodb';
import { getPublicClip } from '@/domains/archive/clip.service';
import ClipPlayer from '@/components/clip/ClipPlayer';

interface EmbedPageProps {
  params: Promise<{ id: string }>;
}

// 임베드(iframe) 전용 — 검색 비노출
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function ClipEmbedPage({ params }: EmbedPageProps) {
  const { id } = await params;
  await connectDB();
  const clip = await getPublicClip(id);
  if (!clip) notFound();

  if (/^[0-9a-fA-F]{24}$/.test(id) && clip.shareId && clip.shareId !== id) {
    permanentRedirect(`/embed/clip/${clip.shareId}`);
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-black">
      <div className="aspect-video w-full max-h-screen">
        <ClipPlayer
          platform={clip.platform}
          videoId={clip.videoId}
          startTime={clip.startTime}
          endTime={clip.endTime}
          posterDate={clip.sungDateLabel ?? undefined}
          posterAddedBy={clip.uploaderName}
          posterThumbnail={clip.thumbnailUrl ?? undefined}
          posterDescription={clip.description ?? undefined}
          trackPlayClipId={clip.id}
          className="h-full w-full"
        />
      </div>
    </div>
  );
}
