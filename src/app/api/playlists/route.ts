import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import dbConnect from '@/lib/mongodb'
import Playlist from '@/models/Playlist'
import User from '@/models/User'
import mongoose from 'mongoose'

const authOptions = {
  secret: process.env.NEXTAUTH_SECRET,
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.channelId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await dbConnect()

    // 사용자의 모든 플레이리스트 조회
    const playlists = await Playlist.find({ channelId: session.user.channelId })
      .populate('songs.songId', 'title artist language')
      .sort({ updatedAt: -1 })

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

    // 새 플레이리스트 생성
    const playlist = new Playlist({
      userId: user._id,
      channelId: session.user.channelId,
      name: name.trim(),
      description: description?.trim() || '',
      coverImage: coverImage || null,
      tags: Array.isArray(tags) ? tags.filter(tag => tag?.trim()).map(tag => tag.trim()) : [],
      songs: []
    })

    await playlist.save()

    return NextResponse.json({ success: true, playlist }, { status: 201 })
  } catch (error) {
    console.error('플레이리스트 생성 오류:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}