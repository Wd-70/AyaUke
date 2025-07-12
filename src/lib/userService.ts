import mongoose from 'mongoose'
import User, { IUser } from '@/models/User'
import { isAdminChannel } from '@/lib/adminChannels'

/**
 * 사용자 생성 또는 업데이트 (로그인 시 호출)
 */
export async function createOrUpdateUser(userData: {
  channelId: string
  channelName: string
  profileImageUrl?: string
}): Promise<IUser> {
  try {
    const isAdmin = isAdminChannel(userData.channelId)
    
    // 기존 사용자 찾기
    let user = await User.findOne({ channelId: userData.channelId })
    
    if (user) {
      // 기존 사용자 업데이트
      user.channelName = userData.channelName
      user.profileImageUrl = userData.profileImageUrl || user.profileImageUrl
      user.isAdmin = isAdmin
      user.lastLoginAt = new Date()
      
      await user.save()
      console.log(`기존 사용자 업데이트: ${userData.channelName} (${userData.channelId})`)
    } else {
      // 새 사용자 생성
      user = new User({
        channelId: userData.channelId,
        channelName: userData.channelName,
        profileImageUrl: userData.profileImageUrl,
        isAdmin,
        lastLoginAt: new Date(),
        preferences: {
          theme: 'system',
          defaultPlaylistView: 'grid'
        }
      })
      
      await user.save()
      console.log(`새 사용자 생성: ${userData.channelName} (${userData.channelId})`)
    }
    
    return user
  } catch (error) {
    console.error('사용자 생성/업데이트 오류:', error)
    throw error
  }
}

/**
 * 사용자 정보 조회
 */
export async function getUserByChannelId(channelId: string): Promise<IUser | null> {
  try {
    return await User.findOne({ channelId })
  } catch (error) {
    console.error('사용자 조회 오류:', error)
    return null
  }
}


/**
 * 사용자 환경설정 업데이트
 */
export async function updateUserPreferences(channelId: string, preferences: Partial<IUser['preferences']>) {
  try {
    const user = await User.findOne({ channelId })
    if (!user) return null
    
    user.preferences = { ...user.preferences, ...preferences }
    await user.save()
    
    return user
  } catch (error) {
    console.error('사용자 환경설정 업데이트 오류:', error)
    return null
  }
}

/**
 * 관리자 목록 조회
 */
export async function getAdminUsers(): Promise<IUser[]> {
  try {
    return await User.find({ isAdmin: true }).sort({ lastLoginAt: -1 })
  } catch (error) {
    console.error('관리자 목록 조회 오류:', error)
    return []
  }
}

/**
 * 활성 사용자 통계
 */
export async function getUserStats() {
  try {
    const totalUsers = await User.countDocuments()
    const activeUsers = await User.countDocuments({
      lastLoginAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // 30일 내
    })
    const adminUsers = await User.countDocuments({ isAdmin: true })
    
    return {
      totalUsers,
      activeUsers,
      adminUsers
    }
  } catch (error) {
    console.error('사용자 통계 조회 오류:', error)
    return {
      totalUsers: 0,
      activeUsers: 0,
      adminUsers: 0
    }
  }
}