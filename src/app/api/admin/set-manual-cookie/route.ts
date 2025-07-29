import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import { isSuperAdmin, UserRole } from '@/lib/permissions'
import { addManualChzzkCookie, createManualChzzkClient } from '@/lib/chzzkCookieManual'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    // 최고관리자만 수동 쿠키 설정 가능
    if (!session || !isSuperAdmin(session.user.role as UserRole)) {
      return NextResponse.json({ error: '최고관리자 권한이 필요합니다.' }, { status: 403 })
    }

    const { naverId, cookies } = await request.json()
    
    if (!naverId || !cookies) {
      return NextResponse.json({ 
        error: 'naverId and cookies are required' 
      }, { status: 400 })
    }

    console.log('=== 수동 쿠키 설정 요청 ===')
    console.log('요청자:', session.user.name)
    console.log('네이버 ID:', naverId)
    console.log('쿠키 길이:', cookies.length)

    // 쿠키 추가
    addManualChzzkCookie(naverId, cookies)
    
    // 즉시 테스트
    const { client, userInfo } = await createManualChzzkClient(naverId)
    
    if (userInfo) {
      console.log('수동 쿠키 인증 성공!')
      
      return NextResponse.json({
        success: true,
        message: '쿠키가 성공적으로 설정되었습니다',
        userInfo: {
          channelId: userInfo.channelId,
          channelName: userInfo.channelName,
          verified: true
        }
      })
    } else {
      return NextResponse.json({
        success: false,
        message: '쿠키가 설정되었지만 인증에 실패했습니다. 쿠키 값을 확인해주세요.'
      })
    }
    
  } catch (error) {
    console.error('수동 쿠키 설정 오류:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}