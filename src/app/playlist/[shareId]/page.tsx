import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import PlaylistDetailView from '@/components/PlaylistDetailView'

interface PlaylistPageProps {
  params: Promise<{ shareId: string }>
}

async function getPlaylistData(shareId: string) {
  try {
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const headersList = await headers()
    const cookie = headersList.get('cookie')
    
    const response = await fetch(`${baseUrl}/api/playlist/${shareId}`, {
      cache: 'no-store', // 항상 최신 데이터
      headers: {
        ...(cookie && { cookie }) // 쿠키 전달
      }
    })

    if (!response.ok) {
      return null
    }

    return await response.json()
  } catch (error) {
    console.error('플레이리스트 데이터 조회 실패:', error)
    return null
  }
}

export async function generateMetadata({ params }: PlaylistPageProps): Promise<Metadata> {
  const { shareId } = await params
  const data = await getPlaylistData(shareId)

  if (!data) {
    return {
      title: '플레이리스트를 찾을 수 없습니다',
      description: '요청하신 플레이리스트가 존재하지 않거나 접근할 수 없습니다.'
    }
  }

  const { playlist } = data
  
  return {
    title: `${playlist.name} - 플레이리스트`,
    description: playlist.description || `${playlist.songCount}곡이 담긴 플레이리스트입니다.`,
    openGraph: {
      title: playlist.name,
      description: playlist.description || `${playlist.songCount}곡이 담긴 플레이리스트`,
      type: 'music.playlist',
      images: playlist.coverImage ? [{ url: playlist.coverImage }] : []
    }
  }
}

export default async function PlaylistPage({ params }: PlaylistPageProps) {
  const { shareId } = await params
  const data = await getPlaylistData(shareId)

  if (!data) {
    notFound()
  }

  return <PlaylistDetailView data={data} shareId={shareId} />
}