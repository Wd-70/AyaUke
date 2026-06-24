import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import ClipShareView from '@/components/clip/ClipShareView';
import { connectDB } from '@/shared/db/mongodb';
import { getPublicClip, getPublicClipsForSong } from '@/domains/archive/clip.service';

interface ClipPageProps {
  params: Promise<{ id: string }>;
}

const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';

// 클립 데이터는 거의 안 바뀜 — ISR 캐시
export const revalidate = 120;

export async function generateMetadata({ params }: ClipPageProps): Promise<Metadata> {
  const { id } = await params;
  await connectDB();
  const clip = await getPublicClip(id);

  if (!clip) {
    return { title: '클립을 찾을 수 없습니다', robots: { index: false, follow: false } };
  }

  const title = `${clip.title} - ${clip.artist}`;
  const description = clip.description
    ? clip.description
    : `${clip.uploaderName}님이 공유한 아야의 라이브 클립${clip.sungDateLabel ? ` (${clip.sungDateLabel})` : ''}`;
  const embedUrl = `${BASE_URL}/embed/clip/${clip.shareId}`;
  const pageUrl = `${BASE_URL}/clip/${clip.shareId}`;
  const oembedUrl = `${BASE_URL}/api/oembed?url=${encodeURIComponent(pageUrl)}&format=json`;
  const images = clip.thumbnailUrl ? [{ url: clip.thumbnailUrl, width: 480, height: 270 }] : [];

  return {
    title: `${title} | 아야 AyaUke 클립`,
    description,
    alternates: {
      canonical: pageUrl,
      types: { 'application/json+oembed': oembedUrl },
    },
    openGraph: {
      title,
      description,
      url: pageUrl,
      type: 'video.other',
      images,
      videos: [{ url: embedUrl, width: 640, height: 360, type: 'text/html' }],
    },
    twitter: {
      card: 'player',
      title,
      description,
      images: clip.thumbnailUrl ? [clip.thumbnailUrl] : [],
    },
    other: {
      'twitter:player': embedUrl,
      'twitter:player:width': '640',
      'twitter:player:height': '360',
    },
  };
}

export default async function ClipPage({ params }: ClipPageProps) {
  const { id } = await params;
  await connectDB();
  const clip = await getPublicClip(id);
  if (!clip) notFound();

  // 레거시 ObjectId URL로 들어오면 불투명 shareId 정규 URL로 영구 리다이렉트(SEO/기존 링크 보존)
  if (/^[0-9a-fA-F]{24}$/.test(id) && clip.shareId && clip.shareId !== id) {
    permanentRedirect(`/clip/${clip.shareId}`);
  }

  const related = await getPublicClipsForSong(clip.songId, clip.id, 8);

  return (
    <div className="min-h-screen bg-light-background text-light-text dark:bg-dark-background dark:text-dark-text">
      <Navigation />
      <ClipShareView clip={clip} related={related} />
      <Footer />
    </div>
  );
}
