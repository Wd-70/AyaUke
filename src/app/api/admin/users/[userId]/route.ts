import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import { isSuperAdmin, UserRole } from '@/lib/permissions'
import { connectToDatabase } from '@/lib/mongodb'
import User, { IUser } from '@/models/User'

interface RouteParams {
  params: {
    userId: string
  }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !isSuperAdmin(session.user.role as UserRole)) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }

    await connectToDatabase()

    const user = await User.findById(params.userId).select('-__v').lean()
    
    if (!user) {
      return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 })
    }

    return NextResponse.json({ user })

  } catch (error) {
    console.error('사용자 상세 조회 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !isSuperAdmin(session.user.role as UserRole)) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }

    const body = await request.json()
    const { role, displayName, profileImageUrl } = body

    await connectToDatabase()

    const user = await User.findById(params.userId)
    
    if (!user) {
      return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 })
    }

    // 권한 변경 시 기록
    const updateData: any = {}
    
    if (role && role !== user.role) {
      updateData.role = role
      updateData.grantedBy = session.user.channelId
      updateData.grantedAt = new Date()
    }

    if (displayName !== undefined) {
      updateData.displayName = displayName
    }

    if (profileImageUrl !== undefined) {
      updateData.profileImageUrl = profileImageUrl
    }

    const updatedUser = await User.findByIdAndUpdate(
      params.userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-__v').lean()

    return NextResponse.json({ 
      user: updatedUser,
      message: '사용자 정보가 성공적으로 업데이트되었습니다.'
    })

  } catch (error) {
    console.error('사용자 정보 업데이트 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}