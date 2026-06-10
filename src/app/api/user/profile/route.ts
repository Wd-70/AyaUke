import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import dbConnect from '@/shared/db/mongodb'
import User from '@/models/User'

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.channelId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { displayName, profileImageUrl } = body

    // displayName 검증
    if (!displayName || typeof displayName !== 'string') {
      return NextResponse.json({ error: '닉네임은 필수입니다.' }, { status: 400 })
    }

    const trimmedDisplayName = displayName.trim()
    if (trimmedDisplayName.length === 0) {
      return NextResponse.json({ error: '닉네임을 입력해주세요.' }, { status: 400 })
    }

    if (trimmedDisplayName.length < 2) {
      return NextResponse.json({ error: '닉네임은 2자 이상이어야 합니다.' }, { status: 400 })
    }

    if (trimmedDisplayName.length > 20) {
      return NextResponse.json({ error: '닉네임은 20자 이하여야 합니다.' }, { status: 400 })
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

    // 다른 사용자가 이미 같은 displayName을 사용하고 있는지 확인
    const existingUser = await User.findOne({ 
      displayName: trimmedDisplayName,
      channelId: { $ne: session.user.channelId }
    })
    
    if (existingUser) {
      return NextResponse.json({ error: '이미 사용 중인 닉네임입니다.' }, { status: 409 })
    }

    // 사용자 정보 업데이트
    const updateData: Record<string, unknown> = {
      displayName: trimmedDisplayName,
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

    console.log(`사용자 닉네임 변경: ${session.user.channelName} -> ${trimmedDisplayName}`)

    // 응답 데이터 구성
    const responseData = {
      success: true,
      message: '닉네임이 성공적으로 변경되었습니다.',
      user: {
        channelId: updatedUser.channelId,
        channelName: updatedUser.channelName,
        displayName: updatedUser.displayName,
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

    console.log('🔍 GET /api/user/profile - 사용자 정보:', {
      channelId: user.channelId,
      channelName: user.channelName,
      displayName: user.displayName,
      hasDisplayName: !!user.displayName
    })

    const responseData = {
      user: {
        channelId: user.channelId,
        channelName: user.channelName,
        displayName: user.displayName,
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