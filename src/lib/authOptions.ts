import CredentialsProvider from "next-auth/providers/credentials"
import { createManualChzzkClient } from "@/lib/chzzkCookieManual"
import { isAdminChannel, getAdminInfo, getStaticUserRole } from "@/lib/adminChannels"
import { roleToIsAdmin } from '@/lib/permissions'
import { createOrUpdateUser } from '@/lib/userService'
import dbConnect from '@/lib/mongodb'
import User from '@/models/User'
import ChzzkProvider from '@/lib/chzzkOAuthProvider'

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
          console.log('🔍 세션 콜백 - 조회된 사용자:', user ? {
            _id: user._id,
            channelId: user.channelId,
            channelName: user.channelName,
            displayName: user.displayName,
            hasDisplayName: !!user.displayName,
            allFields: Object.keys(user.toObject())
          } : null)
          
          if (user) {
            session.user.channelName = user.channelName
            session.user.name = user.displayName || user.channelName // displayName이 없으면 channelName 사용
            session.user.image = user.profileImageUrl || token.channelImageUrl as string
            session.user.channelImageUrl = user.profileImageUrl || token.channelImageUrl as string
            session.user.role = user.role // DB에서 가져온 최신 권한 사용
            session.user.isAdmin = roleToIsAdmin(user.role as any) // 하위 호환성
            
            console.log('🔍 세션 콜백 - 최종 세션 정보:', {
              channelId: user.channelId,
              channelName: user.channelName,
              displayName: user.displayName,
              sessionName: session.user.name,
              role: user.role,
              hasDisplayName: !!user.displayName
            })
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
  debug: process.env.NODE_ENV === 'development',
}