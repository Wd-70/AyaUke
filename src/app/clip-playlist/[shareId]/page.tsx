import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import ClipPlaylistDetailView from '@/components/clip/ClipPlaylistDetailView'

interface ClipPlaylistPageProps {
  params: Promise<{ shareId: string }>
}

async function getClipPlaylistData(shareId: string) {
  try {
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const headersList = await headers()
    const cookie = headersList.get('cookie')

    const response = await fetch(`${baseUrl}/api/clip-playlist/${shareId}`, {
      cache: 'no-store',
      headers: {
        ...(cookie && { cookie }),
      },
    })

    if (!response.ok) return null
    return await response.json()
  } catch (error) {
    console.error('클립 플레이리스트 데이터 조회 실패:', error)
    return null
  }
}

export async function generateMetadata({ params }: ClipPlaylistPageProps): Promise<Metadata> {
  const { shareId } = await params
  const data = await getClipPlaylistData(shareId)

  if (!data) {
    return {
      title: '클립 플레이리스트를 찾을 수 없습니다',
      description: '요청하신 클립 플레이리스트가 존재하지 않거나 접근할 수 없습니다.',
    }
  }

  const { playlist } = data
  return {
    title: `${playlist.name} - 클립 플레이리스트`,
    description: playlist.description || `${playlist.clipCount}개의 라이브 클립을 모은 플레이리스트입니다.`,
    openGraph: {
      title: playlist.name,
      description: playlist.description || `${playlist.clipCount}개의 라이브 클립`,
      type: 'music.playlist',
      images: playlist.coverImage ? [{ url: playlist.coverImage }] : [],
    },
  }
}

export default async function ClipPlaylistPage({ params }: ClipPlaylistPageProps) {
  const { shareId } = await params
  const data = await getClipPlaylistData(shareId)

  if (!data) notFound()

  return <ClipPlaylistDetailView data={data} shareId={shareId} />
}
