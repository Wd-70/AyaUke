import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import dbConnect from '@/lib/mongodb'
import Playlist from '@/models/Playlist'

const authOptions = {
  secret: process.env.NEXTAUTH_SECRET,
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.channelId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const includeSongs = searchParams.get('includeSongs') === 'true'
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '10', 10)
    const skip = (page - 1) * limit

    await dbConnect()

    let query = Playlist.find({ channelId: session.user.channelId })
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)

    // 곡 정보 포함 여부에 따라 populate 적용
    if (includeSongs) {
      query = query.populate('songs.songId', 'title artist language imageUrl')
    }

    const [playlists, total] = await Promise.all([
      query.exec(),
      Playlist.countDocuments({ channelId: session.user.channelId })
    ])

    // 곡 수 정보 추가
    const playlistsWithCounts = playlists.map(playlist => ({
      ...playlist.toObject(),
      songCount: playlist.songs.length
    }))

    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      playlists: playlistsWithCounts,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    })
  } catch (error) {
    console.error('사용자 플레이리스트 목록 조회 오류:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}