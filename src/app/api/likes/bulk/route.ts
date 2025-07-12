import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import dbConnect from '@/lib/mongodb'
import Like from '@/models/Like'
import mongoose from 'mongoose'
import { authOptions } from '@/lib/authOptions'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.channelId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { songIds } = await request.json()
    
    if (!Array.isArray(songIds) || songIds.length === 0) {
      return NextResponse.json({ error: 'songIds array is required' }, { status: 400 })
    }

    // 최대 100곡까지만 허용 (성능 보호)
    if (songIds.length > 100) {
      return NextResponse.json({ error: 'Maximum 100 songs allowed per request' }, { status: 400 })
    }

    await dbConnect()

    // 유효한 ObjectId만 필터링
    const validSongIds = songIds.filter(id => {
      try {
        return mongoose.Types.ObjectId.isValid(id)
      } catch {
        return false
      }
    })

    if (validSongIds.length === 0) {
      return NextResponse.json({ likes: {} })
    }

    // 한 번의 쿼리로 모든 좋아요 정보 조회
    const likes = await Like.find({
      channelId: session.user.channelId,
      songId: { $in: validSongIds.map(id => new mongoose.Types.ObjectId(id)) }
    }).select('songId').lean()

    // songId -> liked 매핑 생성
    const likeMap: Record<string, boolean> = {}
    
    // 모든 요청된 곡을 false로 초기화
    validSongIds.forEach(songId => {
      likeMap[songId] = false
    })
    
    // 실제 좋아요한 곡들을 true로 설정
    likes.forEach(like => {
      likeMap[like.songId.toString()] = true
    })

    return NextResponse.json({ 
      likes: likeMap,
      total: likes.length,
      requested: validSongIds.length
    })

  } catch (error) {
    console.error('대량 좋아요 조회 오류:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}