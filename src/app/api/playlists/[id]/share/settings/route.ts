import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import dbConnect from '@/shared/db/mongodb'
import Playlist from '@/domains/engagement/playlist.schema'
import mongoose from 'mongoose'
import { authOptions } from '@/lib/authOptions'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log('🔧 플레이리스트 공유 설정 업데이트 API 호출됨')
    
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

    const { isPublic, shareSettings } = await request.json()
    console.log('🔧 업데이트할 설정:', { isPublic, shareSettings })

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

    // 설정 업데이트
    const updateData: Record<string, unknown> = {}
    
    if (typeof isPublic === 'boolean') {
      updateData.isPublic = isPublic
    }

    if (shareSettings) {
      updateData.shareSettings = {
        allowCopy: shareSettings.allowCopy !== undefined ? shareSettings.allowCopy : playlist.shareSettings.allowCopy,
        requireLogin: shareSettings.requireLogin !== undefined ? shareSettings.requireLogin : playlist.shareSettings.requireLogin,
        expiresAt: shareSettings.expiresAt ? new Date(shareSettings.expiresAt) : null
      }
    }

    console.log('💾 플레이리스트 설정 업데이트 중...', updateData)

    const updatedPlaylist = await Playlist.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    )

    console.log('✅ 플레이리스트 설정 업데이트 완료')

    return NextResponse.json({
      success: true,
      playlist: {
        _id: updatedPlaylist._id,
        isPublic: updatedPlaylist.isPublic,
        shareSettings: updatedPlaylist.shareSettings
      }
    })

  } catch (error) {
    console.error('❌ 플레이리스트 공유 설정 업데이트 오류:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}