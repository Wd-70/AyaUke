/**
 * 치지직 공식 API OAuth 프로바이더
 * 공식 API 승인 후 사용 예정
 */

export const ChzzkOfficialProvider = {
  id: "chzzk-official",
  name: "치지직 공식 로그인",
  type: "oauth",
  authorization: {
    url: "https://nid.naver.com/oauth2.0/authorize",
    params: {
      response_type: "code",
      client_id: process.env.CHZZK_CLIENT_ID,
      redirect_uri: `${process.env.NEXTAUTH_URL}/api/auth/callback/chzzk-official`,
      scope: "chzzk.read", // 치지직 API 스코프 (정확한 스코프는 문서 확인 필요)
    },
  },
  token: {
    url: "https://comm-api.game.naver.com/nng_main/v1/oauth2/token",
    async request({ params, provider }) {
      const response = await fetch(provider.token.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          grantType: "authorization_code",
          clientId: process.env.CHZZK_CLIENT_ID!,
          clientSecret: process.env.CHZZK_CLIENT_SECRET!,
          code: params.code!,
          state: params.state!,
        }),
      })
      
      const tokens = await response.json()
      
      if (!response.ok) {
        throw new Error(`Token request failed: ${tokens.message || 'Unknown error'}`)
      }
      
      return { tokens }
    },
  },
  userinfo: {
    url: "https://api.chzzk.naver.com/service/v1/user/me", // 추정 URL (문서에서 확인 필요)
    async request({ tokens }) {
      console.log('=== 치지직 공식 API 사용자 정보 조회 ===')
      
      const response = await fetch(this.url, {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(`User info request failed: ${data.message || 'Unknown error'}`)
      }
      
      const userInfo = data.content
      
      return {
        id: userInfo.userIdHash,
        name: userInfo.nickname,
        email: null, // 치지직은 이메일 제공하지 않을 수 있음
        image: userInfo.profileImageUrl,
        channelId: userInfo.channelId,
        channelName: userInfo.channelName,
        followerCount: userInfo.followerCount,
        verified: userInfo.verifiedMark || false,
      }
    },
  },
  profile(profile) {
    return {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      image: profile.image,
      channelId: profile.channelId,
      channelName: profile.channelName,
      followerCount: profile.followerCount,
      verified: profile.verified,
    }
  },
  clientId: process.env.CHZZK_CLIENT_ID,
  clientSecret: process.env.CHZZK_CLIENT_SECRET,
}