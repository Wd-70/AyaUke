import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import dbConnect from '@/lib/mongodb'
import Playlist from '@/models/Playlist'
import User from '@/models/User'
import { authOptions } from '@/lib/authOptions'
import { randomUUID } from 'crypto'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.channelId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await dbConnect()

    // 사용자의 모든 플레이리스트 조회 (소유자이므로 shareId 포함)
    const playlists = await Playlist.find({ channelId: session.user.channelId })
      .populate('songs.songId', 'title artist language')
      .sort({ updatedAt: -1 })
      .select('+shareId +isPublic +shareSettings') // shareId와 공유 관련 정보 포함

    return NextResponse.json({ playlists })
  } catch (error) {
    console.error('플레이리스트 조회 오류:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.channelId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { name, description, coverImage, tags } = await request.json()
    
    if (!name?.trim()) {
      return NextResponse.json({ error: 'Playlist name is required' }, { status: 400 })
    }

    await dbConnect()

    // 사용자 정보 조회
    const user = await User.findOne({ channelId: session.user.channelId })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // 같은 이름의 플레이리스트가 있는지 확인
    const existingPlaylist = await Playlist.findOne({
      channelId: session.user.channelId,
      name: name.trim()
    })

    if (existingPlaylist) {
      return NextResponse.json({ error: 'Playlist with this name already exists' }, { status: 409 })
    }

    // shareId 생성 확인
    const generatedShareId = randomUUID()
    console.log('🔗 생성된 shareId:', generatedShareId)

    // 새 플레이리스트 생성 (shareId 자동 생성)
    const playlist = new Playlist({
      userId: user._id,
      channelId: session.user.channelId,
      name: name.trim(),
      description: description?.trim() || '',
      coverImage: coverImage || null,
      tags: Array.isArray(tags) ? tags.filter(tag => tag?.trim()).map(tag => tag.trim()) : [],
      songs: [],
      shareId: generatedShareId, // shareId 명시적 생성
      isPublic: false, // 기본값을 비공개로 설정
      shareSettings: {
        allowCopy: true,
        requireLogin: false,
        expiresAt: null
      }
    })

    console.log('📋 생성할 플레이리스트 객체:', {
      name: playlist.name,
      shareId: playlist.shareId,
      isPublic: playlist.isPublic
    })

    // 강제로 shareId 설정 확인
    if (!playlist.shareId) {
      console.log('⚠️ shareId가 설정되지 않음, 강제 설정 시도')
      playlist.shareId = generatedShareId
      playlist.isPublic = false
      playlist.shareSettings = {
        allowCopy: true,
        requireLogin: false,
        expiresAt: null
      }
    }

    await playlist.save()
    console.log('💾 플레이리스트 저장 완료, shareId:', playlist.shareId)
    
    // 저장 후 다시 조회해서 실제 DB에 저장된 값 확인
    const savedPlaylist = await Playlist.findById(playlist._id).lean()
    console.log('🔍 DB에 실제 저장된 값:', {
      shareId: savedPlaylist.shareId,
      isPublic: savedPlaylist.isPublic
    })

    // 응답에 shareId 포함하여 반환
    const responsePlaylist = await Playlist.findById(playlist._id)
      .populate('songs.songId', 'title artist language')
      .select('+shareId +isPublic +shareSettings')

    console.log('📤 응답할 플레이리스트 데이터:', {
      _id: responsePlaylist._id,
      name: responsePlaylist.name,
      shareId: responsePlaylist.shareId,
      isPublic: responsePlaylist.isPublic,
      shareSettings: responsePlaylist.shareSettings
    })

    return NextResponse.json({ success: true, playlist: responsePlaylist }, { status: 201 })
  } catch (error) {
    console.error('플레이리스트 생성 오류:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}