import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import dbConnect from '@/lib/mongodb'
import User from '@/models/User'

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.channelId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { channelName, profileImageUrl } = body

    // 입력 검증
    if (!channelName || typeof channelName !== 'string') {
      return NextResponse.json({ error: '닉네임은 필수입니다.' }, { status: 400 })
    }

    if (channelName.trim().length === 0) {
      return NextResponse.json({ error: '닉네임을 입력해주세요.' }, { status: 400 })
    }

    if (channelName.length > 50) {
      return NextResponse.json({ error: '닉네임은 50자 이하로 입력해주세요.' }, { status: 400 })
    }

    // 프로필 이미지 URL 검증 (선택사항)
    if (profileImageUrl && typeof profileImageUrl !== 'string') {
      return NextResponse.json({ error: '잘못된 이미지 URL입니다.' }, { status: 400 })
    }

    // URL 형식 간단 검증 (http:// 또는 https:// 또는 data: 스키마)
    if (profileImageUrl && profileImageUrl.trim() && 
        !profileImageUrl.match(/^(https?:\/\/|data:image\/)/)) {
      return NextResponse.json({ error: '올바른 이미지 URL을 입력해주세요.' }, { status: 400 })
    }

    await dbConnect()

    // 사용자 정보 업데이트
    const updateData: Record<string, unknown> = {
      channelName: channelName.trim(),
      lastLoginAt: new Date()
    }

    // 프로필 이미지가 제공된 경우에만 업데이트
    if (profileImageUrl !== undefined) {
      updateData.profileImageUrl = profileImageUrl.trim() || null
    }

    const updatedUser = await User.findOneAndUpdate(
      { channelId: session.user.channelId },
      updateData,
      { 
        new: true,
        runValidators: true,
        upsert: false // 사용자가 존재하지 않으면 에러
      }
    )

    if (!updatedUser) {
      return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 })
    }

    // 응답 데이터 구성
    const responseData = {
      success: true,
      user: {
        channelId: updatedUser.channelId,
        channelName: updatedUser.channelName,
        profileImageUrl: updatedUser.profileImageUrl,
        isAdmin: updatedUser.isAdmin,
        lastLoginAt: updatedUser.lastLoginAt,
        preferences: updatedUser.preferences
      }
    }

    return NextResponse.json(responseData)

  } catch (error) {
    console.error('프로필 업데이트 오류:', error)
    
    // MongoDB 유효성 검사 오류 처리
    if (error instanceof Error && error.name === 'ValidationError') {
      return NextResponse.json({ 
        error: '입력 데이터가 올바르지 않습니다.' 
      }, { status: 400 })
    }

    // 중복 키 오류 처리 (만약 channelName이 unique라면)
    if (error instanceof Error && 'code' in error && (error as { code: number }).code === 11000) {
      return NextResponse.json({ 
        error: '이미 사용 중인 닉네임입니다.' 
      }, { status: 409 })
    }

    return NextResponse.json({ 
      error: 'Internal Server Error' 
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.channelId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await dbConnect()

    const user = await User.findOne({ channelId: session.user.channelId })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const responseData = {
      user: {
        channelId: user.channelId,
        channelName: user.channelName,
        profileImageUrl: user.profileImageUrl,
        isAdmin: user.isAdmin,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
        preferences: user.preferences
      }
    }

    return NextResponse.json(responseData)

  } catch (error) {
    console.error('프로필 조회 오류:', error)
    return NextResponse.json({ 
      error: 'Internal Server Error' 
    }, { status: 500 })
  }
}