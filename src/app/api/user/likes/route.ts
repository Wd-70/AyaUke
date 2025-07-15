import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import dbConnect from '@/lib/mongodb'
import Like from '@/models/Like'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.channelId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '12', 10), 50) // 최대 50개로 제한
    const search = searchParams.get('search') || ''
    const sortBy = searchParams.get('sortBy') || 'date'
    const sortOrder = searchParams.get('sortOrder') || 'desc'
    const skip = (page - 1) * limit

    await dbConnect()

    // 검색 조건 구성
    const matchStage = { channelId: session.user.channelId }

    // 정렬 조건 구성
    let sortStage: Record<string, number> = {}
    switch (sortBy) {
      case 'title':
        sortStage = { 'songId.title': sortOrder === 'asc' ? 1 : -1 }
        break
      case 'artist':
        sortStage = { 'songId.artist': sortOrder === 'asc' ? 1 : -1 }
        break
      case 'date':
      default:
        sortStage = { createdAt: sortOrder === 'asc' ? 1 : -1 }
        break
    }

    // 집계 파이프라인 구성
    const pipeline: Record<string, unknown>[] = [
      { $match: matchStage },
      {
        $lookup: {
          from: 'songdetails',
          localField: 'songId',
          foreignField: '_id',
          as: 'songId'
        }
      },
      { $unwind: '$songId' }
    ]

    // 검색 필터 추가
    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { 'songId.title': { $regex: search, $options: 'i' } },
            { 'songId.artist': { $regex: search, $options: 'i' } },
            { 'songId.titleAlias': { $regex: search, $options: 'i' } },
            { 'songId.artistAlias': { $regex: search, $options: 'i' } }
          ]
        }
      })
    }

    // 정렬 및 페이지네이션
    pipeline.push(
      { $sort: sortStage },
      { $skip: skip },
      { $limit: limit }
    )

    // 전체 개수를 위한 별도 파이프라인
    const countPipeline: Record<string, unknown>[] = [
      { $match: matchStage },
      {
        $lookup: {
          from: 'songdetails',
          localField: 'songId',
          foreignField: '_id',
          as: 'songId'
        }
      },
      { $unwind: '$songId' }
    ]

    if (search) {
      countPipeline.push({
        $match: {
          $or: [
            { 'songId.title': { $regex: search, $options: 'i' } },
            { 'songId.artist': { $regex: search, $options: 'i' } },
            { 'songId.titleAlias': { $regex: search, $options: 'i' } },
            { 'songId.artistAlias': { $regex: search, $options: 'i' } }
          ]
        }
      })
    }

    countPipeline.push({ $count: 'total' })

    // 두 쿼리를 병렬로 실행
    const [likes, countResult] = await Promise.all([
      Like.aggregate(pipeline),
      Like.aggregate(countPipeline)
    ])

    const total = countResult.length > 0 ? countResult[0].total : 0
    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      likes,
      total,
      page,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    })
  } catch (error) {
    console.error('사용자 좋아요 목록 조회 오류:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}