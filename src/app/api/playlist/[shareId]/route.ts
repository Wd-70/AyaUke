import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import dbConnect from '@/lib/mongodb'
import Playlist from '@/models/Playlist'
import { authOptions } from '@/lib/authOptions'
import mongoose from 'mongoose'

// SongDetail 모델 강제 등록
try {
  if (!mongoose.models.SongDetail) {
    await import('@/models/SongDetail')
  }
} catch (error) {
  console.warn('SongDetail 모델 등록 확인 중 에러:', error)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shareId: string }> }
) {
  try {
    console.log('📋 플레이리스트 상세 조회 API 호출됨')
    
    const { shareId } = await params
    console.log('🔗 Share ID:', shareId)

    if (!shareId) {
      return NextResponse.json({ error: 'Share ID is required' }, { status: 400 })
    }

    await dbConnect()
    console.log('🗄️ MongoDB 연결 완료')

    // 플레이리스트 조회 (공개된 것만 또는 소유자인 경우)
    const playlist = await Playlist.findOne({ shareId })
      .populate('songs.songId') // 모든 필드 포함
      .exec()

    if (!playlist) {
      console.log('❌ 플레이리스트를 찾을 수 없음')
      return NextResponse.json({ error: 'Playlist not found' }, { status: 404 })
    }

    console.log('✅ 플레이리스트 조회 성공:', playlist.name)

    // 세션 확인 (선택적)
    const session = await getServerSession(authOptions)
    const isOwner = session?.user?.channelId === playlist.channelId

    console.log('🔍 권한 확인:', {
      sessionExists: !!session,
      userChannelId: session?.user?.channelId,
      playlistChannelId: playlist.channelId,
      isOwner,
      isPublic: playlist.isPublic
    })

    // 공개되지 않은 플레이리스트는 소유자만 접근 가능
    if (!playlist.isPublic && !isOwner) {
      console.log('❌ 비공개 플레이리스트 - 접근 권한 없음')
      return NextResponse.json({ error: 'This playlist is private' }, { status: 403 })
    }

    // 만료된 플레이리스트 확인
    if (playlist.shareSettings.expiresAt && new Date() > playlist.shareSettings.expiresAt) {
      console.log('❌ 만료된 플레이리스트')
      return NextResponse.json({ error: 'This playlist has expired' }, { status: 410 })
    }

    // 로그인 필수 설정 확인
    if (playlist.shareSettings.requireLogin && !session?.user?.channelId) {
      console.log('❌ 로그인 필요')
      return NextResponse.json({ error: 'Login required to view this playlist' }, { status: 401 })
    }

    // 응답 데이터 구성 (곡 객체에 id 필드 추가)
    const responseData = {
      playlist: {
        _id: playlist._id,
        name: playlist.name,
        description: playlist.description,
        coverImage: playlist.coverImage,
        tags: playlist.tags,
        songs: playlist.songs.map(item => ({
          ...item.toObject(),
          songId: {
            ...item.songId.toObject(),
            id: item.songId._id.toString() // id 필드 추가
          }
        })),
        songCount: playlist.songs.length,
        createdAt: playlist.createdAt,
        updatedAt: playlist.updatedAt,
        // 공유 설정 (소유자만)
        ...(isOwner && {
          shareId: playlist.shareId,
          isPublic: playlist.isPublic,
          shareSettings: playlist.shareSettings,
          shareHistory: playlist.shareHistory
        })
      },
      isOwner,
      permissions: {
        canEdit: isOwner,
        canDelete: isOwner,
        canShare: isOwner,
        canCopy: playlist.shareSettings.allowCopy || isOwner
      }
    }

    console.log('✅ 플레이리스트 상세 정보 응답 완료')
    return NextResponse.json(responseData)

  } catch (error) {
    console.error('❌ 플레이리스트 상세 조회 오류:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}