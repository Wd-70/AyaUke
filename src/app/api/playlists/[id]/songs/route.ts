import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import dbConnect from '@/lib/mongodb'
import Playlist from '@/models/Playlist'
import SongDetail from '@/models/SongDetail'
import mongoose from 'mongoose'
import { authOptions } from '@/lib/authOptions'

// SongDetail 모델 강제 등록 (스키마 에러 방지)
try {
  if (!mongoose.models.SongDetail) {
    console.log('🔧 SongDetail 모델 재등록 시도')
    // 모델이 등록되지 않은 경우에만 강제 등록
    await import('@/models/SongDetail')
  }
} catch (error) {
  console.warn('SongDetail 모델 등록 확인 중 에러:', error)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log('🎵 플레이리스트 곡 추가 API 호출됨')
    
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

    const { songId } = await request.json()
    console.log('🎶 곡 ID:', songId)
    
    if (!songId || !mongoose.Types.ObjectId.isValid(songId)) {
      console.log('❌ 유효하지 않은 곡 ID:', songId)
      return NextResponse.json({ error: 'Valid songId is required' }, { status: 400 })
    }

    await dbConnect()
    console.log('🗄️ MongoDB 연결 완료')

    // 플레이리스트 조회 및 소유권 확인
    console.log('🔍 플레이리스트 조회 중...', { playlistId: id, channelId: session.user.channelId })
    const playlist = await Playlist.findOne({
      _id: id,
      channelId: session.user.channelId
    })

    if (!playlist) {
      console.log('❌ 플레이리스트를 찾을 수 없음')
      return NextResponse.json({ error: 'Playlist not found' }, { status: 404 })
    }
    
    console.log('✅ 플레이리스트 조회 성공:', playlist.name, '현재 곡 수:', playlist.songs.length)

    // 곡 존재 확인 (SongDetail에 없어도 Google Sheets에 있을 수 있으므로 허용)
    // MongoDB에 없는 경우 자동으로 SongDetail 생성
    console.log('🔍 SongDetail 조회 중...', songId)
    let song = await SongDetail.findById(songId)
    if (!song) {
      // 곡이 MongoDB에 없는 경우 기본 정보로 생성
      console.log(`📝 새 SongDetail 생성: ${songId}`)
      song = new SongDetail({
        _id: new mongoose.Types.ObjectId(songId),
        title: 'Unknown Title',
        artist: 'Unknown Artist',
        language: 'Unknown',
        // 추가 필드들은 나중에 Google Sheets 데이터로 업데이트됨
      })
      await song.save()
      console.log('✅ 새 SongDetail 생성 완료')
    } else {
      console.log('✅ 기존 SongDetail 발견:', song.title)
    }

    // 이미 플레이리스트에 있는 곡인지 확인
    const existingSong = playlist.songs.find(s => s.songId.toString() === songId)
    console.log('🔍 중복 곡 체크:', { 
      existingSong: !!existingSong,
      playlistSongs: playlist.songs.map(s => s.songId.toString())
    })
    
    if (existingSong) {
      console.log('⚠️ 곡이 이미 플레이리스트에 있음')
      return NextResponse.json({ error: 'Song already in playlist' }, { status: 409 })
    }

    // 새 곡을 플레이리스트에 추가 (맨 끝에)
    const newOrder = playlist.songs.length > 0 
      ? Math.max(...playlist.songs.map(s => s.order)) + 1 
      : 1
    
    console.log('➕ 곡 추가 중...', { songId, newOrder })

    playlist.songs.push({
      songId: new mongoose.Types.ObjectId(songId),
      addedAt: new Date(),
      order: newOrder
    })

    console.log('💾 플레이리스트 저장 중...')
    await playlist.save()
    console.log('✅ 플레이리스트 저장 완료')

    // 추가된 곡 정보와 함께 응답 (populate 제거하여 에러 방지)
    console.log('🔍 업데이트된 플레이리스트 조회 중...')
    const updatedPlaylist = await Playlist.findById(id)
    
    console.log('✅ 곡 추가 완료, 응답 전송')
    return NextResponse.json({ 
      success: true, 
      playlist: updatedPlaylist,
      addedSong: song
    })
  } catch (error) {
    console.error('❌ 플레이리스트 곡 추가 오류:', error)
    console.error('오류 상세:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    })
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log('🗑️ 플레이리스트 곡 삭제 API 호출됨')
    
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

    const { searchParams } = new URL(request.url)
    const songId = searchParams.get('songId')
    console.log('🎶 곡 ID:', songId)
    
    if (!songId || !mongoose.Types.ObjectId.isValid(songId)) {
      console.log('❌ 유효하지 않은 곡 ID:', songId)
      return NextResponse.json({ error: 'Valid songId is required' }, { status: 400 })
    }

    await dbConnect()
    console.log('🗄️ MongoDB 연결 완료')

    // 플레이리스트 조회 및 소유권 확인
    console.log('🔍 플레이리스트 조회 중...', { playlistId: id, channelId: session.user.channelId })
    const playlist = await Playlist.findOne({
      _id: id,
      channelId: session.user.channelId
    })

    if (!playlist) {
      console.log('❌ 플레이리스트를 찾을 수 없음')
      return NextResponse.json({ error: 'Playlist not found' }, { status: 404 })
    }
    
    console.log('✅ 플레이리스트 조회 성공:', playlist.name, '현재 곡 수:', playlist.songs.length)

    // 곡이 플레이리스트에 있는지 확인
    const songIndex = playlist.songs.findIndex(s => s.songId.toString() === songId)
    console.log('🔍 곡 삭제 확인:', { 
      songIndex,
      playlistSongs: playlist.songs.map(s => s.songId.toString())
    })
    
    if (songIndex === -1) {
      console.log('❌ 곡이 플레이리스트에 없음')
      return NextResponse.json({ error: 'Song not found in playlist' }, { status: 404 })
    }

    // 곡 제거
    console.log('🗑️ 곡 제거 중...')
    playlist.songs.splice(songIndex, 1)

    // order 재정렬
    playlist.songs.forEach((song, index) => {
      song.order = index + 1
    })

    console.log('💾 플레이리스트 저장 중...')
    await playlist.save()
    console.log('✅ 플레이리스트 저장 완료')

    const updatedPlaylist = await Playlist.findById(id)
      .populate('songs.songId', 'title artist language')

    console.log('✅ 곡 삭제 완료, 응답 전송')
    return NextResponse.json({ 
      success: true, 
      playlist: updatedPlaylist 
    })
  } catch (error) {
    console.error('플레이리스트 곡 삭제 오류:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.channelId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid playlist ID' }, { status: 400 })
    }

    const { songs } = await request.json()
    
    if (!Array.isArray(songs)) {
      return NextResponse.json({ error: 'songs array is required' }, { status: 400 })
    }

    await dbConnect()

    // 플레이리스트 조회 및 소유권 확인
    const playlist = await Playlist.findOne({
      _id: id,
      channelId: session.user.channelId
    })

    if (!playlist) {
      return NextResponse.json({ error: 'Playlist not found' }, { status: 404 })
    }

    // 곡 순서 업데이트
    const updatedSongs = songs.map((songData, index) => {
      const existingSong = playlist.songs.find(s => s.songId.toString() === songData.songId)
      return {
        songId: new mongoose.Types.ObjectId(songData.songId),
        addedAt: existingSong?.addedAt || new Date(),
        order: index + 1
      }
    })

    playlist.songs = updatedSongs
    await playlist.save()

    const updatedPlaylist = await Playlist.findById(id)
      .populate('songs.songId', 'title artist language')

    return NextResponse.json({ 
      success: true, 
      playlist: updatedPlaylist 
    })
  } catch (error) {
    console.error('플레이리스트 곡 순서 변경 오류:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}