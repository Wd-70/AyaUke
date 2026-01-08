import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import dbConnect from '@/lib/mongodb'
import Like from '@/models/Like'
import SongDetail from '@/models/SongDetail'
import { authOptions } from '@/lib/authOptions'
import { isSuperAdmin, UserRole } from '@/lib/permissions'

export async function POST(request: NextRequest) {
  try {
    // 관리자 권한 확인
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    // 슈퍼 관리자 권한 확인
    if (!isSuperAdmin(session.user.role as UserRole)) {
      return NextResponse.json(
        { error: '슈퍼 관리자 권한이 필요합니다.' },
        { status: 403 }
      )
    }

    await dbConnect()

    console.log('🔄 좋아요 카운트 재계산 시작...')

    // 모든 곡의 실제 좋아요 수 집계
    const likeCountsAggregation = await Like.aggregate([
      {
        $group: {
          _id: '$songId',
          count: { $sum: 1 }
        }
      }
    ])

    console.log(`📊 집계된 좋아요 데이터: ${likeCountsAggregation.length}곡`)

    // 좋아요 카운트를 Map으로 변환
    const likeCountsMap = new Map<string, number>()
    likeCountsAggregation.forEach(item => {
      likeCountsMap.set(item._id.toString(), item.count)
    })

    // 모든 SongDetail 문서 조회
    const allSongs = await SongDetail.find({}, { _id: 1, likeCount: 1 }).lean()
    console.log(`🎵 처리할 곡: ${allSongs.length}곡`)

    let processedCount = 0
    let errorCount = 0
    let unchangedCount = 0
    let updatedCount = 0

    // 배치 처리 (100곡씩)
    const batchSize = 100
    for (let i = 0; i < allSongs.length; i += batchSize) {
      const batch = allSongs.slice(i, i + batchSize)
      
      const updates = batch.map(song => {
        const songId = song._id.toString()
        const actualLikeCount = likeCountsMap.get(songId) || 0
        const currentLikeCount = song.likeCount || 0

        if (actualLikeCount !== currentLikeCount) {
          updatedCount++
          return {
            updateOne: {
              filter: { _id: song._id },
              update: { $set: { likeCount: actualLikeCount } }
            }
          }
        } else {
          unchangedCount++
          return null
        }
      }).filter(Boolean) // null 제거

      if (updates.length > 0) {
        try {
          await SongDetail.bulkWrite(updates)
          console.log(`✅ 배치 ${Math.floor(i / batchSize) + 1} 완료: ${updates.length}곡 업데이트`)
        } catch (error) {
          console.error(`❌ 배치 ${Math.floor(i / batchSize) + 1} 오류:`, error)
          errorCount += updates.length
        }
      }

      processedCount += batch.length
    }

    console.log('✅ 좋아요 카운트 재계산 완료')
    console.log(`📈 통계: 처리 ${processedCount}곡, 업데이트 ${updatedCount}곡, 변경없음 ${unchangedCount}곡, 오류 ${errorCount}곡`)

    return NextResponse.json({
      success: true,
      processedCount,
      updatedCount,
      unchangedCount,
      errorCount,
      message: `좋아요 카운트 재계산 완료: ${processedCount}곡 처리, ${updatedCount}곡 업데이트`
    })

  } catch (error) {
    console.error('❌ 좋아요 카운트 재계산 오류:', error)
    return NextResponse.json({ 
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}