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
      console.log('❌ 인증 실패')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { songIds } = await request.json()
    
    if (!Array.isArray(songIds) || songIds.length === 0) {
      return NextResponse.json({ error: 'songIds array is required' }, { status: 400 })
    }

    // 배치 처리: 100곡씩 나누어서 처리
    const batchSize = 100;
    const allLikes: Record<string, boolean> = {};

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

    // 배치별로 처리
    let totalLikesFound = 0;
    for (let i = 0; i < validSongIds.length; i += batchSize) {
      const batch = validSongIds.slice(i, i + batchSize);
      
      // 배치별 좋아요 조회
      const batchLikes = await Like.find({
        channelId: session.user.channelId,
        songId: { $in: batch.map(id => new mongoose.Types.ObjectId(id)) }
      }).select('songId').lean();

      // 배치 결과를 전체 결과에 병합
      batch.forEach(songId => {
        allLikes[songId] = false; // 기본값
      });
      
      batchLikes.forEach(like => {
        allLikes[like.songId.toString()] = true;
        totalLikesFound++;
      });
    }

    if (totalLikesFound > 0) {
      console.log(`💖 좋아요 ${totalLikesFound}개 로드`);
    }

    return NextResponse.json({ 
      likes: allLikes,
      total: totalLikesFound,
      requested: validSongIds.length,
      batches: Math.ceil(validSongIds.length / batchSize)
    })

  } catch (error) {
    console.error('❌ 대량 좋아요 조회 오류:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}