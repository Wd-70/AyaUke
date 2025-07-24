import UserActivity from '@/models/UserActivity'
import mongoose from 'mongoose'

/**
 * 오래된 UserActivity 데이터 정리
 * 기본적으로 1년(365일) 이전 데이터를 삭제
 */
export async function cleanupOldActivityData(daysToKeep: number = 365) {
  try {
    // MongoDB 연결 확인
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGODB_URI!)
    }

    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0]

    const result = await UserActivity.deleteMany({
      date: { $lt: cutoffDateStr }
    })

    console.log(`오래된 활동 데이터 정리 완료: ${result.deletedCount}개 삭제 (${cutoffDateStr} 이전)`)
    
    return {
      success: true,
      deletedCount: result.deletedCount,
      cutoffDate: cutoffDateStr
    }
  } catch (error) {
    console.error('활동 데이터 정리 오류:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    }
  }
}

/**
 * 특정 사용자의 최근 N일 활동 통계 조회
 */
export async function getUserRecentActivity(userId: string, days: number = 30) {
  try {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const startDateStr = startDate.toISOString().split('T')[0]

    const activities = await UserActivity.find({
      userId: new mongoose.Types.ObjectId(userId),
      date: { $gte: startDateStr }
    }).sort({ date: 1 })

    return activities
  } catch (error) {
    console.error('사용자 활동 조회 오류:', error)
    return []
  }
}