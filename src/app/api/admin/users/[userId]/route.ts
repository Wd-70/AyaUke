import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import { isSuperAdmin, UserRole } from '@/lib/permissions'
import dbConnect from '@/lib/mongodb'
import User, { IUser } from '@/models/User'
import Like from '@/models/Like'
import Playlist from '@/models/Playlist'
import SongDetail from '@/models/SongDetail'

interface RouteParams {
  params: {
    userId: string
  }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !isSuperAdmin(session.user.role as UserRole)) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }

    await dbConnect()

    const { userId } = await params
    const user = await User.findById(userId).select('-__v').lean()
    
    if (!user) {
      return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 })
    }

    // 사용자의 좋아요한 곡들 조회
    const likes = await Like.find({ channelId: user.channelId }).lean()
    const likedSongIds = likes.map(like => like.songId)
    
    // 좋아요한 곡들의 상세 정보 조회
    const likedSongs = await SongDetail.find({
      _id: { $in: likedSongIds }
    }).select('title artist titleAlias artistAlias').lean()

    // 사용자의 플레이리스트들 조회
    const playlists = await Playlist.find({ channelId: user.channelId })
      .select('name description isPublic songIds shareId createdAt updatedAt')
      .lean()

    // 플레이리스트별 곡 수 추가
    const playlistsWithSongCount = playlists.map(playlist => ({
      ...playlist,
      songCount: playlist.songIds?.length || 0
    }))

    return NextResponse.json({ 
      user: {
        ...user,
        likesCount: likes.length,
        playlistsCount: playlists.length
      },
      likedSongs,
      playlists: playlistsWithSongCount
    })

  } catch (error) {
    console.error('사용자 상세 조회 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !isSuperAdmin(session.user.role as UserRole)) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }

    const body = await request.json()
    const { role, displayName, profileImageUrl } = body

    await dbConnect()

    const { userId } = await params
    const user = await User.findById(userId)
    
    if (!user) {
      return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 })
    }

    // 권한 변경 시 기록
    const updateData: any = {}
    
    if (role && role !== user.role) {
      updateData.role = role
      updateData.grantedBy = session.user.channelId
      updateData.grantedAt = new Date()
    }

    if (displayName !== undefined) {
      updateData.displayName = displayName
    }

    if (profileImageUrl !== undefined) {
      updateData.profileImageUrl = profileImageUrl
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-__v').lean()

    return NextResponse.json({ 
      user: updatedUser,
      message: '사용자 정보가 성공적으로 업데이트되었습니다.'
    })

  } catch (error) {
    console.error('사용자 정보 업데이트 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}