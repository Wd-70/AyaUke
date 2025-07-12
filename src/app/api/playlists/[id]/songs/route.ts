import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import dbConnect from '@/lib/mongodb'
import Playlist from '@/models/Playlist'
import SongDetail from '@/models/SongDetail'
import mongoose from 'mongoose'

const authOptions = {
  secret: process.env.NEXTAUTH_SECRET,
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.channelId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid playlist ID' }, { status: 400 })
    }

    const { songId } = await request.json()
    if (!songId || !mongoose.Types.ObjectId.isValid(songId)) {
      return NextResponse.json({ error: 'Valid songId is required' }, { status: 400 })
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

    // 곡 존재 확인
    const song = await SongDetail.findById(songId)
    if (!song) {
      return NextResponse.json({ error: 'Song not found' }, { status: 404 })
    }

    // 이미 플레이리스트에 있는 곡인지 확인
    const existingSong = playlist.songs.find(s => s.songId.toString() === songId)
    if (existingSong) {
      return NextResponse.json({ error: 'Song already in playlist' }, { status: 409 })
    }

    // 새 곡을 플레이리스트에 추가 (맨 끝에)
    const newOrder = playlist.songs.length > 0 
      ? Math.max(...playlist.songs.map(s => s.order)) + 1 
      : 1

    playlist.songs.push({
      songId: new mongoose.Types.ObjectId(songId),
      addedAt: new Date(),
      order: newOrder
    })

    await playlist.save()

    // 추가된 곡 정보와 함께 응답
    const updatedPlaylist = await Playlist.findById(id)
      .populate('songs.songId', 'title artist language')

    return NextResponse.json({ 
      success: true, 
      playlist: updatedPlaylist,
      addedSong: song
    })
  } catch (error) {
    console.error('플레이리스트 곡 추가 오류:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.channelId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid playlist ID' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const songId = searchParams.get('songId')
    
    if (!songId || !mongoose.Types.ObjectId.isValid(songId)) {
      return NextResponse.json({ error: 'Valid songId is required' }, { status: 400 })
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

    // 곡이 플레이리스트에 있는지 확인
    const songIndex = playlist.songs.findIndex(s => s.songId.toString() === songId)
    if (songIndex === -1) {
      return NextResponse.json({ error: 'Song not found in playlist' }, { status: 404 })
    }

    // 곡 제거
    playlist.songs.splice(songIndex, 1)

    // order 재정렬
    playlist.songs.forEach((song, index) => {
      song.order = index + 1
    })

    await playlist.save()

    const updatedPlaylist = await Playlist.findById(id)
      .populate('songs.songId', 'title artist language')

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
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.channelId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
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