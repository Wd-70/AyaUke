import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import { isSuperAdmin, UserRole } from '@/lib/permissions'
import { connectToDatabase } from '@/lib/mongodb'
import User, { IUser } from '@/models/User'
// Simple UUID v4 generator
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

interface RouteParams {
  params: {
    userId: string
  }
}

// 타이틀 부여
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !isSuperAdmin(session.user.role as UserRole)) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }

    const body = await request.json()
    const { name, description, condition, rarity } = body

    if (!name || !description || !condition || !rarity) {
      return NextResponse.json({ error: '필수 필드가 누락되었습니다.' }, { status: 400 })
    }

    if (!['common', 'rare', 'epic', 'legendary'].includes(rarity)) {
      return NextResponse.json({ error: '올바르지 않은 희귀도입니다.' }, { status: 400 })
    }

    await connectToDatabase()

    const user = await User.findById(params.userId)
    
    if (!user) {
      return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 })
    }

    // 중복 타이틀 확인
    const existingTitle = user.titles?.find(title => title.name === name)
    if (existingTitle) {
      return NextResponse.json({ error: '이미 해당 타이틀을 보유하고 있습니다.' }, { status: 400 })
    }

    const newTitle = {
      id: generateUUID(),
      name,
      description,
      condition,
      rarity,
      earnedAt: new Date()
    }

    const updatedUser = await User.findByIdAndUpdate(
      params.userId,
      { $push: { titles: newTitle } },
      { new: true, runValidators: true }
    ).select('-__v').lean()

    return NextResponse.json({ 
      user: updatedUser,
      message: '타이틀이 성공적으로 부여되었습니다.'
    })

  } catch (error) {
    console.error('타이틀 부여 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

// 타이틀 회수
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !isSuperAdmin(session.user.role as UserRole)) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const titleId = searchParams.get('titleId')

    if (!titleId) {
      return NextResponse.json({ error: '타이틀 ID가 필요합니다.' }, { status: 400 })
    }

    await connectToDatabase()

    const user = await User.findById(params.userId)
    
    if (!user) {
      return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 })
    }

    // 타이틀 존재 확인
    const titleExists = user.titles?.some(title => title.id === titleId)
    if (!titleExists) {
      return NextResponse.json({ error: '해당 타이틀을 찾을 수 없습니다.' }, { status: 404 })
    }

    // 선택된 타이틀인 경우 선택 해제
    const updateData: any = { $pull: { titles: { id: titleId } } }
    if (user.selectedTitle === titleId) {
      updateData.selectedTitle = null
    }

    const updatedUser = await User.findByIdAndUpdate(
      params.userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-__v').lean()

    return NextResponse.json({ 
      user: updatedUser,
      message: '타이틀이 성공적으로 회수되었습니다.'
    })

  } catch (error) {
    console.error('타이틀 회수 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}