import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import dbConnect from '@/lib/mongodb'
import Like from '@/models/Like'
import User from '@/models/User'
import SongDetail from '@/models/SongDetail'
import mongoose from 'mongoose'
import { authOptions } from '@/lib/authOptions'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.channelId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await dbConnect()

    const { searchParams } = new URL(request.url)
    const songId = searchParams.get('songId')

    if (songId) {
      // 특정 곡의 좋아요 상태 확인
      const like = await Like.findOne({
        channelId: session.user.channelId,
        songId: new mongoose.Types.ObjectId(songId)
      })
      
      return NextResponse.json({ liked: !!like })
    } else {
      // 사용자의 모든 좋아요 목록 조회
      const likes = await Like.find({ channelId: session.user.channelId })
        .populate('songId', 'title artist language')
        .sort({ createdAt: -1 })
      
      return NextResponse.json({ likes })
    }
  } catch (error) {
    console.error('좋아요 조회 오류:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.channelId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { songId } = await request.json()
    if (!songId) {
      return NextResponse.json({ error: 'songId is required' }, { status: 400 })
    }

    await dbConnect()

    // 사용자 정보 조회
    const user = await User.findOne({ channelId: session.user.channelId })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // 곡 정보 확인
    const song = await SongDetail.findById(songId)
    if (!song) {
      return NextResponse.json({ error: 'Song not found' }, { status: 404 })
    }

    // 이미 좋아요가 있는지 확인
    const existingLike = await Like.findOne({
      userId: user._id,
      songId: new mongoose.Types.ObjectId(songId)
    })

    if (existingLike) {
      return NextResponse.json({ error: 'Already liked' }, { status: 409 })
    }

    // 새 좋아요 생성
    const like = new Like({
      userId: user._id,
      channelId: session.user.channelId,
      songId: new mongoose.Types.ObjectId(songId)
    })

    await like.save()

    // SongDetail의 likeCount 증가
    await SongDetail.findByIdAndUpdate(
      songId,
      { $inc: { likeCount: 1 } },
      { new: true }
    )

    return NextResponse.json({ success: true, like }, { status: 201 })
  } catch (error) {
    console.error('좋아요 추가 오류:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.channelId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const songId = searchParams.get('songId')
    
    if (!songId) {
      return NextResponse.json({ error: 'songId is required' }, { status: 400 })
    }

    await dbConnect()

    // 사용자 정보 조회
    const user = await User.findOne({ channelId: session.user.channelId })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // 좋아요 삭제
    const result = await Like.findOneAndDelete({
      userId: user._id,
      songId: new mongoose.Types.ObjectId(songId)
    })

    if (!result) {
      return NextResponse.json({ error: 'Like not found' }, { status: 404 })
    }

    // SongDetail의 likeCount 감소
    await SongDetail.findByIdAndUpdate(
      songId,
      { $inc: { likeCount: -1 } },
      { new: true }
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('좋아요 삭제 오류:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}