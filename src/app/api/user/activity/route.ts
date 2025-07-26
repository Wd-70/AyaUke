import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { connectToDatabase } from '@/lib/mongodb'
import { UserActivity } from '@/models/UserActivity'

// 메모리 캐시 - 중복 요청 방지
const activityCache = new Map<string, number>()

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    await connectToDatabase()
    
    const body = await request.json().catch(() => ({}))
    const isFirstVisit = body.isFirstVisit || false

    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
    const now = new Date()
    const oneHourAgo = now.getTime() - (60 * 60 * 1000)

    // 중복 요청 방지 - 캐시 확인
    const cacheKey = `${session.user.id}:${today}`
    const lastUpdate = activityCache.get(cacheKey)
    
    if (lastUpdate && lastUpdate > oneHourAgo) {
      // 1시간 이내에 이미 업데이트했으면 무시
      return NextResponse.json({ 
        success: true, 
        message: '최근에 업데이트됨',
        skipped: true 
      })
    }

    // 오늘 활동 기록 조회
    let todayActivity = await UserActivity.findOne({
      userId: session.user.id,
      date: today
    })

    // 첫 방문인 경우 - 새로운 활동 기록 생성 (authOptions의 performDailyCheckin 로직 통합)
    if (isFirstVisit && !todayActivity) {
      const User = (await import('@/models/User')).default
      const user = await User.findById(session.user.id)
      
      if (user) {
        // 기존 사용자의 activityStats가 없으면 초기화
        if (!user.activityStats) {
          user.activityStats = {
            totalLoginDays: 0,
            currentStreak: 0,
            longestStreak: 0,
            lastVisitDate: null,
          }
        }

        // 오늘 첫 방문 - 새로운 활동 기록 생성
        todayActivity = new UserActivity({
          userId: user._id,
          date: today,
          visitCount: 1,
          firstVisitAt: now,
          lastVisitAt: now
        })

        // 연속 접속일 계산
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        const yesterdayStr = yesterday.toISOString().split('T')[0]

        if (user.activityStats.lastVisitDate === yesterdayStr) {
          // 어제 방문했으면 연속 접속일 증가
          user.activityStats.currentStreak += 1
        } else if (user.activityStats.lastVisitDate !== today) {
          // 어제 방문 안했으면 연속 접속일 초기화 (오늘부터 1일)
          user.activityStats.currentStreak = 1
        }

        // 최장 연속 접속일 기록 업데이트
        if (user.activityStats.currentStreak > user.activityStats.longestStreak) {
          user.activityStats.longestStreak = user.activityStats.currentStreak
        }

        // 총 로그인 날 수 증가
        user.activityStats.totalLoginDays += 1
        user.activityStats.lastVisitDate = today

        await todayActivity.save()
        await user.save()

        console.log(`🎯 첫 방문 기록 생성: ${session.user.channelName} - 연속 ${user.activityStats.currentStreak}일`)
        
        return NextResponse.json({
          success: true,
          message: '첫 방문이 기록되었습니다',
          visitCount: todayActivity.visitCount,
          lastVisitAt: todayActivity.lastVisitAt,
          isFirstVisit: true
        })
      }
    }

    if (!todayActivity) {
      return NextResponse.json({ 
        error: '오늘 활동 기록이 없습니다. 페이지를 새로고침해주세요.' 
      }, { status: 400 })
    }

    // DB 기반 중복 방지 - lastVisitAt 확인
    const lastVisit = new Date(todayActivity.lastVisitAt).getTime()
    
    if (lastVisit > oneHourAgo) {
      // 1시간 이내에 이미 방문했으면 무시하되 캐시는 복원
      activityCache.set(cacheKey, lastVisit)
      return NextResponse.json({ 
        success: true, 
        message: '1시간 이내 중복 방문',
        skipped: true 
      })
    }

    // 방문 카운트 증가 및 시간 업데이트
    todayActivity.visitCount += 1
    todayActivity.lastVisitAt = now
    await todayActivity.save()

    // 캐시 업데이트
    activityCache.set(cacheKey, now.getTime())

    // 캐시 정리: 24시간 이상 된 항목들 제거
    const oneDayAgo = now.getTime() - (24 * 60 * 60 * 1000)
    for (const [key, timestamp] of activityCache.entries()) {
      if (timestamp < oneDayAgo) {
        activityCache.delete(key)
      }
    }

    console.log(`🔄 활동 업데이트: ${session.user.channelName} - 오늘 ${todayActivity.visitCount}회 방문`)

    return NextResponse.json({
      success: true,
      message: '활동이 업데이트되었습니다',
      visitCount: todayActivity.visitCount,
      lastVisitAt: todayActivity.lastVisitAt
    })

  } catch (error) {
    console.error('활동 업데이트 오류:', error)
    return NextResponse.json({ 
      error: '활동 업데이트 중 오류가 발생했습니다' 
    }, { status: 500 })
  }
}