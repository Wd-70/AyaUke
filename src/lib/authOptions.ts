import CredentialsProvider from "next-auth/providers/credentials"
import { createManualChzzkClient } from "@/lib/chzzkCookieManual"
import { isAdminChannel, getAdminInfo } from "@/lib/adminChannels"
import { createOrUpdateUser } from '@/lib/userService'

export const authOptions = {
  providers: [
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