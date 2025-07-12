import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import dbConnect from '@/lib/mongodb'
import Playlist from '@/models/Playlist'
import User from '@/models/User'
import mongoose from 'mongoose'

const authOptions = {
  secret: process.env.NEXTAUTH_SECRET,
}

export async function GET(
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

    await dbConnect()

    // 플레이리스트 조회 (본인 소유인지 확인)
    const playlist = await Playlist.findOne({
      _id: id,
      channelId: session.user.channelId
    }).populate('songs.songId', 'title artist language')

    if (!playlist) {
      return NextResponse.json({ error: 'Playlist not found' }, { status: 404 })
    }

    return NextResponse.json({ playlist })
  } catch (error) {
    console.error('플레이리스트 조회 오류:', error)
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

    const { name, description, coverImage, tags } = await request.json()
    
    if (!name?.trim()) {
      return NextResponse.json({ error: 'Playlist name is required' }, { status: 400 })
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

    // 같은 이름의 다른 플레이리스트가 있는지 확인 (현재 플레이리스트 제외)
    const existingPlaylist = await Playlist.findOne({
      _id: { $ne: id },
      channelId: session.user.channelId,
      name: name.trim()
    })

    if (existingPlaylist) {
      return NextResponse.json({ error: 'Playlist with this name already exists' }, { status: 409 })
    }

    // 플레이리스트 업데이트
    playlist.name = name.trim()
    playlist.description = description?.trim() || ''
    playlist.coverImage = coverImage || null
    playlist.tags = Array.isArray(tags) ? tags.filter(tag => tag?.trim()).map(tag => tag.trim()) : []

    await playlist.save()

    return NextResponse.json({ success: true, playlist })
  } catch (error) {
    console.error('플레이리스트 수정 오류:', error)
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

    await dbConnect()

    // 플레이리스트 삭제 (본인 소유인지 확인)
    const result = await Playlist.findOneAndDelete({
      _id: id,
      channelId: session.user.channelId
    })

    if (!result) {
      return NextResponse.json({ error: 'Playlist not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('플레이리스트 삭제 오류:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}