import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import dbConnect from '@/lib/mongodb'
import Like from '@/models/Like'

const authOptions = {
  secret: process.env.NEXTAUTH_SECRET,
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.channelId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const skip = (page - 1) * limit

    await dbConnect()

    // 사용자의 좋아요 목록 조회 (페이지네이션 적용)
    const [likes, total] = await Promise.all([
      Like.find({ channelId: session.user.channelId })
        .populate('songId', 'title artist language lyrics imageUrl')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Like.countDocuments({ channelId: session.user.channelId })
    ])

    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      likes,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    })
  } catch (error) {
    console.error('사용자 좋아요 목록 조회 오류:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}