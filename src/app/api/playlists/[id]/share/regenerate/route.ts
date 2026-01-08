import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import dbConnect from '@/lib/mongodb'
import Playlist from '@/models/Playlist'
import mongoose from 'mongoose'
import { authOptions } from '@/lib/authOptions'
import { randomUUID } from 'crypto'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log('🔄 플레이리스트 공유 링크 재생성 API 호출됨')
    
    const session = await getServerSession(authOptions)
    if (!session?.user?.channelId) {
      console.log('❌ 인증 실패: 세션 없음')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    console.log('📋 플레이리스트 ID:', id)
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.log('❌ 유효하지 않은 플레이리스트 ID:', id)
      return NextResponse.json({ error: 'Invalid playlist ID' }, { status: 400 })
    }

    await dbConnect()
    console.log('🗄️ MongoDB 연결 완료')

    // 플레이리스트 조회 및 소유권 확인
    const playlist = await Playlist.findOne({
      _id: id,
      channelId: session.user.channelId
    })

    if (!playlist) {
      console.log('❌ 플레이리스트를 찾을 수 없음')
      return NextResponse.json({ error: 'Playlist not found' }, { status: 404 })
    }

    console.log('✅ 플레이리스트 조회 성공:', playlist.name)

    // 이전 공유 ID를 히스토리에 추가
    const oldShareId = playlist.shareId
    const newShareId = randomUUID()

    console.log('🔄 공유 링크 재생성:', { oldShareId, newShareId })

    // 공유 히스토리에 이전 링크 추가
    const shareHistory = playlist.shareHistory || []
    shareHistory.push({
      shareId: oldShareId,
      createdAt: playlist.createdAt,
      revokedAt: new Date()
    })

    // 새로운 공유 ID로 업데이트
    const updatedPlaylist = await Playlist.findByIdAndUpdate(
      id,
      {
        shareId: newShareId,
        shareHistory: shareHistory
      },
      { new: true }
    )

    console.log('✅ 공유 링크 재생성 완료')

    return NextResponse.json({
      success: true,
      playlist: {
        _id: updatedPlaylist._id,
        shareId: updatedPlaylist.shareId,
        shareHistory: updatedPlaylist.shareHistory
      },
      newShareUrl: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/playlist/${newShareId}`
    })

  } catch (error) {
    console.error('❌ 플레이리스트 공유 링크 재생성 오류:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}