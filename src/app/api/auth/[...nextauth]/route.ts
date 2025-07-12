import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { resolveChzzkUser } from "@/lib/chzzkUserResolver"
import { isAdminChannel, getAdminInfo, ADMIN_CHANNEL_IDS } from "@/lib/adminChannels"

// 네이버 OAuth 설정 검증
const hasNaverConfig = process.env.NAVER_CLIENT_ID && 
                      process.env.NAVER_CLIENT_SECRET && 
                      process.env.NAVER_CLIENT_ID !== 'temp_for_development'

const providers = []

// 네이버 OAuth 프로바이더 (설정이 완료된 경우만)
if (hasNaverConfig) {
  providers.push({
    id: "naver",
    name: "네이버 (치지직 연동)",
    type: "oauth",
    authorization: {
      url: "https://nid.naver.com/oauth2.0/authorize",
      params: {
        response_type: "code",
        client_id: process.env.NAVER_CLIENT_ID,
        redirect_uri: `${process.env.NEXTAUTH_URL}/api/auth/callback/naver`,
        state: "ayauke-chzzk-auth",
        scope: "name email profile_image nickname",
      },
    },
    token: {
      url: "https://nid.naver.com/oauth2.0/token",
      async request({ params, provider }) {
        const response = await fetch(provider.token.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            client_id: process.env.NAVER_CLIENT_ID!,
            client_secret: process.env.NAVER_CLIENT_SECRET!,
            code: params.code!,
            state: params.state!,
          }),
        })
        
        const tokens = await response.json()
        return { tokens }
      },
    },
    userinfo: {
      url: "https://openapi.naver.com/v1/nid/me",
      async request({ tokens }) {
        console.log('=== 네이버 사용자 정보 API 호출 ===')
        console.log('Access Token:', tokens.access_token)
        
        const response = await fetch("https://openapi.naver.com/v1/nid/me", {
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
          },
        })
        
        const data = await response.json()
        console.log('네이버 API 응답:', JSON.stringify(data, null, 2))
        
        const userInfo = data.response
        
        if (!userInfo) {
          console.error('네이버 사용자 정보를 가져올 수 없습니다:', data)
          return {
            id: tokens.access_token.substring(0, 10),
            name: "네이버 사용자",
            email: null,
            image: null,
            naverId: tokens.access_token.substring(0, 10),
            channelId: null,
            channelName: null,
            isAdmin: false,
          }
        }
        
        // 치지직 채널 정보 해결
        const chzzkInfo = await resolveChzzkUser(userInfo)
        
        // 관리자 여부 확인
        const isAdmin = isAdminChannel(chzzkInfo.channelId)
        const adminInfo = getAdminInfo(chzzkInfo.channelId)
        
        const result = {
          id: userInfo.id,
          name: userInfo.nickname || userInfo.name || "네이버 사용자",
          email: userInfo.email,
          image: userInfo.profile_image,
          naverId: userInfo.id,
          channelId: chzzkInfo.channelId,
          channelName: chzzkInfo.channelName,
          channelImageUrl: chzzkInfo.channelImageUrl,
          followerCount: chzzkInfo.followerCount,
          isAdmin,
          adminRole: adminInfo?.role || null,
        }
        
        console.log('=== 최종 사용자 정보 ===')
        console.log(JSON.stringify(result, null, 2))
        
        return result
      },
    },
    profile(profile) {
      return {
        id: profile.id,
        name: profile.name,
        email: profile.email,
        image: profile.image,
        naverId: profile.naverId,
        channelId: profile.channelId,
        channelName: profile.channelName,
        channelImageUrl: profile.channelImageUrl,
        followerCount: profile.followerCount,
        isAdmin: profile.isAdmin,
        adminRole: profile.adminRole,
      }
    },
    clientId: process.env.NAVER_CLIENT_ID,
    clientSecret: process.env.NAVER_CLIENT_SECRET,
  })
}

// 개발용 임시 프로바이더 (네이버 설정이 없는 경우)
if (!hasNaverConfig) {
  providers.push(
    CredentialsProvider({
      id: "dev-auth",
      name: "개발용 임시 로그인",
      credentials: {
        isAyauke: { 
          label: "아야우케로 로그인하기", 
          type: "checkbox",
        }
      },
      async authorize(credentials) {
        try {
          const isAyauke = credentials?.isAyauke === 'true'
          const channelId = isAyauke ? ADMIN_CHANNEL_IDS[0] : 'dev-user'
          
          return {
            id: channelId,
            name: isAyauke ? "아야우케 (개발용)" : "개발용 사용자",
            email: `${isAyauke ? 'ayauke' : 'dev'}@example.com`,
            image: null,
            naverId: 'dev-naver-id',
            channelId: channelId,
            channelName: isAyauke ? "아야우케" : null,
            channelImageUrl: null,
            followerCount: null,
            isAdmin: isAyauke,
            adminRole: isAyauke ? 'dev-admin' : null,
          }
        } catch (error) {
          console.error('Dev auth error:', error)
          return null
        }
      }
    })
  )
}

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
        session.user.naverId = token.naverId as string
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