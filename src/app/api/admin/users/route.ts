import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import { isSuperAdmin, UserRole } from '@/lib/permissions'
import dbConnect from '@/lib/mongodb'
import User, { IUser } from '@/models/User'
import Like from '@/models/Like'
import Playlist from '@/models/Playlist'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !isSuperAdmin(session.user.role as UserRole)) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const role = searchParams.get('role') || ''
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    await dbConnect()

    // 검색 조건 생성
    const searchQuery: any = {}
    
    if (search) {
      searchQuery.$or = [
        { channelName: { $regex: search, $options: 'i' } },
        { displayName: { $regex: search, $options: 'i' } },
        { channelId: { $regex: search, $options: 'i' } }
      ]
    }

    if (role && role !== 'all') {
      searchQuery.role = role
    }

    // 정렬 조건
    const sortOptions: any = {}
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1

    // 페이지네이션
    const skip = (page - 1) * limit

    // 전체 개수
    const totalUsers = await User.countDocuments(searchQuery)

    // 사용자 목록 조회
    const users = await User.find(searchQuery)
      .sort(sortOptions)
      .skip(skip)
      .limit(limit)
      .select('-__v')
      .lean()

    // 각 사용자의 좋아요 수와 플레이리스트 수 조회
    const usersWithCounts = await Promise.all(
      users.map(async (user) => {
        const [likesCount, playlistsCount] = await Promise.all([
          Like.countDocuments({ channelId: user.channelId }),
          Playlist.countDocuments({ channelId: user.channelId })
        ]);

        return {
          ...user,
          likesCount,
          playlistsCount
        };
      })
    );

    // 페이지네이션 정보
    const totalPages = Math.ceil(totalUsers / limit)
    const hasNextPage = page < totalPages
    const hasPreviousPage = page > 1

    return NextResponse.json({
      users: usersWithCounts,
      pagination: {
        currentPage: page,
        totalPages,
        totalUsers,
        hasNextPage,
        hasPreviousPage,
        limit
      }
    })

  } catch (error) {
    console.error('사용자 목록 조회 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}