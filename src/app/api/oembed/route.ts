import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/shared/db/mongodb';
import { getPublicClip } from '@/domains/archive/clip.service';

/**
 * oEmbed 엔드포인트 (https://oembed.com).
 * `/clip/[id]` 페이지가 <link rel="alternate" type="application/json+oembed">로 디스커버리.
 * 지원 플랫폼(WordPress 등)은 이 응답의 html(iframe)을 그대로 임베드한다.
 */
export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl;
  const url = searchParams.get('url');
  const format = searchParams.get('format') ?? 'json';

  if (format !== 'json') {
    return NextResponse.json({ error: 'Only json format supported' }, { status: 501 });
  }
  if (!url) {
    return NextResponse.json({ error: 'url is required' }, { status: 400 });
  }

  // url에서 클립 식별자 추출 (/clip/<shareId> 또는 레거시 /clip/<ObjectId>)
  const m = url.match(/\/clip\/([0-9a-zA-Z-]{8,64})/);
  if (!m) {
    return NextResponse.json({ error: 'Not a clip url' }, { status: 404 });
  }

  await connectDB();
  const clip = await getPublicClip(m[1]);
  if (!clip) {
    return NextResponse.json({ error: 'Clip not found' }, { status: 404 });
  }

  const maxWidth = Number(searchParams.get('maxwidth')) || 640;
  const maxHeight = Math.round((maxWidth * 9) / 16);
  const embedUrl = `${origin}/embed/clip/${clip.shareId}`;
  const title = `${clip.title} - ${clip.artist} | 아야 AyaUke`;

  return NextResponse.json(
    {
      version: '1.0',
      type: 'video',
      provider_name: '아야 AyaUke 노래책',
      provider_url: origin,
      title,
      author_name: clip.uploaderName,
      thumbnail_url: clip.thumbnailUrl ?? undefined,
      thumbnail_width: clip.thumbnailUrl ? 480 : undefined,
      thumbnail_height: clip.thumbnailUrl ? 270 : undefined,
      width: maxWidth,
      height: maxHeight,
      html: `<iframe src="${embedUrl}" width="${maxWidth}" height="${maxHeight}" frameborder="0" allow="autoplay; fullscreen; encrypted-media" allowfullscreen title="${title.replace(/"/g, '&quot;')}"></iframe>`,
    },
    { headers: { 'Cache-Control': 'public, max-age=300' } },
  );
}
