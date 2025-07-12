import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { createManualChzzkClient } from "@/lib/chzzkCookieManual"
import { isAdminChannel, getAdminInfo, ADMIN_CHANNEL_IDS } from "@/lib/adminChannels"

// 치지직 쿠키 기반 로그인 프로바이더
const providers = [
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
        console.log('=== 치지직 쿠키 로그인 시도 ===')
        
        if (!credentials?.cookies) {
          console.log('쿠키가 제공되지 않음')
          return null
        }
        
        // 치지직 클라이언트로 사용자 정보 확인
        const { client, userInfo } = await createManualChzzkClient('cookie-user', credentials.cookies)
        
        if (!userInfo || !userInfo.loggedIn) {
          console.log('치지직 사용자 정보를 가져올 수 없거나 로그인되지 않음')
          console.log('쿠키가 만료되었거나 유효하지 않을 수 있습니다.')
          return null
        }
        
        // 채널 정보 가져오기
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
        
        // 관리자 여부 확인
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
        
        console.log('=== 치지직 로그인 성공 ===')
        console.log(JSON.stringify(result, null, 2))
        
        // 데이터베이스에 사용자 생성/업데이트
        try {
          const { createOrUpdateUser } = await import('@/lib/userService')
          await createOrUpdateUser({
            channelId: channelId,
            channelName: channelName,
            profileImageUrl: channelInfo?.channelImageUrl
          })
        } catch (dbError) {
          console.error('사용자 DB 저장 오류:', dbError)
          // DB 오류가 있어도 로그인은 계속 진행
        }
        
        return result
      } catch (error) {
        console.error('치지직 쿠키 로그인 오류:', error)
        return null
      }
    }
  })
]

const authOptions = {
  providers,
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.naverId = user.naverId
        token.channelId = user.channelId
        token.channelName = user.channelName
        token.channelImageUrl = user.channelImageUrl
        token.followerCount = user.followerCount
        token.isAdmin = user.isAdmin
        token.adminRole = user.adminRole
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.naverId = token.naverId as string || null
        session.user.channelId = token.channelId as string
        session.user.channelName = token.channelName as string
        session.user.channelImageUrl = token.channelImageUrl as string
        session.user.followerCount = token.followerCount as number
        session.user.isAdmin = token.isAdmin as boolean
        session.user.adminRole = token.adminRole as string
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

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }