import CredentialsProvider from "next-auth/providers/credentials"
import { createManualChzzkClient } from "@/lib/chzzkCookieManual"
import { isAdminChannel, getAdminInfo, getStaticUserRole } from "@/lib/adminChannels"
import { roleToIsAdmin } from '@/lib/permissions'
import { createOrUpdateUser } from '@/lib/userService'
import dbConnect from '@/lib/mongodb'
import User from '@/models/User'
import UserActivity from '@/models/UserActivity'
import ChzzkProvider from '@/lib/chzzkOAuthProvider'
import { getSelectedTitleInfo } from '@/lib/titleSystem'

export const authOptions = {
  providers: [
    ChzzkProvider({
      clientId: process.env.CHZZK_CLIENT_ID!,
      clientSecret: process.env.CHZZK_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      id: "chzzk-cookie",
      name: "치지직 쿠키 로그인",
      credentials: {
        cookies: { 
          label: "치지직 쿠키", 
          type: "text",
          placeholder: "NID_AUT=...; NID_SES=..."
        }
      },
      async authorize(credentials) {
        try {
          if (!credentials?.cookies) return null
          
          const { client, userInfo } = await createManualChzzkClient('cookie-user', credentials.cookies)
          
          if (!userInfo || !userInfo.loggedIn) return null
          
          let channelInfo = null
          try {
            if (client.channel && typeof client.channel.info === 'function') {
              channelInfo = await client.channel.info(userInfo.userIdHash)
            }
          } catch (error) {
            console.log('채널 정보 가져오기 실패:', error)
          }
          
          const channelId = channelInfo?.channelId || userInfo.userIdHash
          const channelName = channelInfo?.channelName || userInfo.nickname || '치지직 사용자'
          
          const isAdmin = isAdminChannel(channelId)
          const adminInfo = getAdminInfo(channelId)
          
          const result = {
            id: userInfo.userIdHash,
            name: channelName,
            email: null,
            image: channelInfo?.channelImageUrl || null,
            naverId: null,
            channelId: channelId,
            channelName: channelName,
            channelImageUrl: channelInfo?.channelImageUrl || null,
            followerCount: channelInfo?.followerCount || null,
            isAdmin,
            adminRole: adminInfo?.role || null,
          }
          
          try {
            await createOrUpdateUser({
              channelId: channelId,
              channelName: channelName,
              profileImageUrl: channelInfo?.channelImageUrl
            })
          } catch (dbError) {
            console.error('사용자 DB 저장 오류:', dbError)
          }
          
          return result
        } catch (error) {
          console.error('치지직 쿠키 로그인 오류:', error)
          return null
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        // OAuth 방식 (치지직 공식 API)
        if (account?.provider === 'chzzk') {
          const channelId = user.channelId || user.id
          const channelName = user.channelName || user.name
          const role = getStaticUserRole(channelId)
          const adminInfo = getAdminInfo(channelId)
          
          token.naverId = null
          token.channelId = channelId
          token.channelName = channelName
          token.channelImageUrl = user.channelImageUrl || user.image
          token.followerCount = user.followerCount
          token.role = role
          token.isAdmin = roleToIsAdmin(role) // 하위 호환성
          token.adminRole = adminInfo?.role || null
          
          // 사용자 정보 DB에 저장
          try {
            const dbUser = await createOrUpdateUser({
              channelId: channelId,
              channelName: channelName,
              profileImageUrl: user.channelImageUrl || user.image
            })
            token.userId = dbUser._id.toString() // MongoDB ObjectId를 토큰에 저장
          } catch (dbError) {
            console.error('OAuth 사용자 DB 저장 오류:', dbError)
          }
        }
        // 쿠키 방식 (기존 로직)
        else {
          const role = getStaticUserRole(user.channelId)
          const adminInfo = getAdminInfo(user.channelId)
          
          token.naverId = user.naverId
          token.channelId = user.channelId
          token.channelName = user.channelName
          token.channelImageUrl = user.channelImageUrl
          token.followerCount = user.followerCount
          token.role = role
          token.isAdmin = roleToIsAdmin(role) // 하위 호환성
          token.adminRole = adminInfo?.role || null
          
          // 쿠키 방식에서도 DB에 사용자 정보 저장하고 ObjectId 가져오기
          try {
            const dbUser = await createOrUpdateUser({
              channelId: user.channelId,
              channelName: user.channelName,
              profileImageUrl: user.channelImageUrl
            })
            token.userId = dbUser._id.toString() // MongoDB ObjectId를 토큰에 저장
          } catch (dbError) {
            console.error('쿠키 방식 사용자 DB 저장 오류:', dbError)
          }
        }
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        // 기본 토큰 정보 설정
        session.user.naverId = token.naverId as string || null
        session.user.channelId = token.channelId as string
        session.user.userId = token.userId as string // MongoDB ObjectId 추가
        session.user.followerCount = token.followerCount as number
        session.user.role = token.role as string
        session.user.isAdmin = token.isAdmin as boolean
        session.user.adminRole = token.adminRole as string
        
        // 데이터베이스에서 최신 사용자 정보 가져오기
        try {
          await dbConnect()
          console.log('🔍 세션 콜백 - 사용자 검색:', { channelId: token.channelId })
          const user = await User.findOne({ channelId: token.channelId })
          console.log('🔍 세션 콜백 - 조회된 사용자 칭호:', { 
            found: !!user,
            titlesCount: user?.titles?.length || 0,
            selectedTitle: user?.selectedTitle || 'none',
            hasTitlesField: user?.titles !== undefined
          })
          
          if (user) {
            session.user.channelName = user.channelName
            session.user.name = user.displayName || user.channelName // displayName이 없으면 channelName 사용
            session.user.image = user.profileImageUrl || token.channelImageUrl as string
            session.user.channelImageUrl = user.profileImageUrl || token.channelImageUrl as string
            session.user.role = user.role // DB에서 가져온 최신 권한 사용
            session.user.isAdmin = roleToIsAdmin(user.role as any) // 하위 호환성
            
            // 선택된 칭호 정보 추가
            const selectedTitle = getSelectedTitleInfo(user)
            session.user.selectedTitle = selectedTitle
            console.log('🏆 세션 콜백 - 칭호 정보:', { 
              userId: user._id, 
              titlesCount: user.titles?.length || 0,
              selectedTitle: selectedTitle?.name || 'none'
            })
            
            // 자동 일일 체크인 처리
            await performDailyCheckin(user)
            
            // console.log('🔍 세션 콜백 - 최종 세션 정보:', { ... })
          } else {
            // DB에 사용자가 없으면 토큰 정보 사용
            session.user.channelName = token.channelName as string
            session.user.name = token.channelName as string
            session.user.channelImageUrl = token.channelImageUrl as string
          }
        } catch (error) {
          console.error('세션 콜백에서 사용자 정보 조회 오류:', error)
          // 오류 시 토큰 정보 사용
          session.user.channelName = token.channelName as string
          session.user.name = token.channelName as string
          session.user.channelImageUrl = token.channelImageUrl as string
        }
      }
      return session
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  session: {
    strategy: "jwt" as const,
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: false, // 디버그 모드 비활성화
}

// 중복 체크인 방지를 위한 메모리 캐시 (userId:date -> timestamp)
const checkinCache = new Map<string, number>()

/**
 * 세션 콜백에서 자동으로 일일 체크인 처리
 */
async function performDailyCheckin(user: any) {
  try {
    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
    const now = new Date()
    
    // 오늘 활동 기록이 있는지 확인 (세션에서는 첫 방문 생성만)
    let todayActivity = await UserActivity.findOne({
      userId: user._id,
      date: today
    })

    // 오늘 활동 기록이 이미 있으면 아무것도 하지 않음
    if (todayActivity) {
      return
    }

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

    console.log(`🎯 첫 방문 기록 생성: ${user.channelName} - 연속 ${user.activityStats.currentStreak}일`)
  } catch (error) {
    console.error('자동 체크인 처리 오류:', error)
    // 에러가 발생해도 세션 처리는 계속 진행
  }
}