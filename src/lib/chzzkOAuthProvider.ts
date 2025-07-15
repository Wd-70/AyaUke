import { OAuthConfig, OAuthUserConfig } from "next-auth/providers/oauth"

export interface ChzzkProfile {
  userIdHash: string
  nickname: string
  profileImageUrl?: string
  channelId?: string
  channelName?: string
  channelImageUrl?: string
  followerCount?: number
}

// 토큰을 저장할 임시 변수
let currentAccessToken: string | null = null

export default function ChzzkProvider(
  options: OAuthUserConfig<ChzzkProfile>
): OAuthConfig<ChzzkProfile> {
  return {
    id: "chzzk",
    name: "치지직",
    type: "oauth",
    authorization: {
      url: "https://chzzk.naver.com/account-interlock",
      params: {
        clientId: options.clientId,
        redirectUri: `${process.env.NEXTAUTH_URL}/api/auth/callback/chzzk`,
        response_type: "code",
      },
    },
    // 디버깅을 위한 로그
    ...(process.env.NODE_ENV === 'development' && {
      debug: true
    }),
    token: {
      url: "https://chzzk.naver.com/auth/v1/token",
      async request(context) {
        const response = await fetch("https://chzzk.naver.com/auth/v1/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            grantType: "authorization_code",
            clientId: options.clientId,
            clientSecret: options.clientSecret,
            code: context.params.code,
            state: context.params.state,
          }),
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error('치지직 토큰 요청 실패:', {
            status: response.status,
            statusText: response.statusText,
            error: errorText,
            clientId: options.clientId,
            redirectUri: `${process.env.NEXTAUTH_URL}/api/auth/callback/chzzk`
          })
          
          // API 승인 관련 오류인지 확인
          if (response.status === 401 || response.status === 403) {
            throw new Error(`치지직 API 승인이 필요합니다. 클라이언트 ID/SECRET을 확인하거나 API 승인 상태를 확인하세요. (${response.status})`)
          }
          
          throw new Error(`Token request failed: ${response.status} - ${errorText}`)
        }

        const tokens = await response.json()
        
        const result = {
          access_token: tokens.content?.accessToken || tokens.accessToken,
          refresh_token: tokens.content?.refreshToken || tokens.refreshToken,
          token_type: tokens.content?.tokenType || tokens.tokenType || "Bearer",
          expires_in: tokens.content?.expiresIn || tokens.expiresIn || 86400,
        }
        
        // 토큰을 임시 변수에 저장
        currentAccessToken = result.access_token
        
        return result
      },
    },
    userinfo: {
      url: "https://chzzk.naver.com/open/v1/users/me",
      async request(context) {
        // context에서 토큰을 가져오거나 임시 저장된 토큰 사용
        const accessToken = context.tokens?.access_token || currentAccessToken
        
        // 액세스 토큰이 없으면 로그인 실패
        if (!accessToken) {
          throw new Error('Access token not found')
        }
        
        // 치지직 공식 사용자 정보 API 호출
        try {
          const response = await fetch("https://openapi.chzzk.naver.com/open/v1/users/me", {
            method: "GET",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
          })
          
          if (response.ok) {
            const userData = await response.json()
            const content = userData.content || userData
            
            if (content.channelId && content.channelName) {
              return {
                userIdHash: content.channelId,
                nickname: content.channelName || content.nickname,
                profileImageUrl: content.profileImageUrl || content.channelImageUrl,
                channelId: content.channelId,
                channelName: content.channelName || content.nickname,
                channelImageUrl: content.channelImageUrl,
                followerCount: content.followerCount || 0,
              }
            }
          } else {
            const errorText = await response.text()
            console.error('치지직 사용자 정보 API 호출 실패:', {
              status: response.status,
              statusText: response.statusText,
              error: errorText,
              accessToken: accessToken ? '토큰 있음' : '토큰 없음'
            })
            
            // API 승인 관련 오류인지 확인
            if (response.status === 401 || response.status === 403) {
              throw new Error(`치지직 API 승인이 필요합니다. 개발자 콘솔에서 API 승인 상태를 확인하세요. (${response.status})`)
            }
          }
          
          // 공식 API 응답이 유효하지 않음
        } catch (error) {
          console.error('치지직 공식 API 호출 실패:', error)
          
          // API 승인 관련 오류라면 더 명확한 메시지 표시
          if (error.message && error.message.includes('승인')) {
            throw error
          }
        }
        
        // Fallback API들 시도
        const fallbackUrls = [
          'https://api.chzzk.naver.com/open/v1/users/me',
          'https://comm-api.game.naver.com/nng_main/v1/user/getUserStatus'
        ]
        
        for (const url of fallbackUrls) {
          try {
            const response = await fetch(url, {
              method: "GET",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
            })
            
            if (response.ok) {
              const responseText = await response.text()
              
              // HTML 응답 건너뛰기
              if (responseText.includes('<!doctype html>')) continue
              
              const userData = JSON.parse(responseText)
              const content = userData.content || userData.response || userData
              
              if (content.channelId && content.channelName) {
                return {
                  userIdHash: content.channelId,
                  nickname: content.channelName,
                  profileImageUrl: content.profileImageUrl || content.channelImageUrl,
                  channelId: content.channelId,
                  channelName: content.channelName,
                  channelImageUrl: content.channelImageUrl,
                  followerCount: content.followerCount || 0,
                }
              }
            }
          } catch (error) {
            // 개별 실패는 무시하고 다음 URL 시도
            continue
          }
        }
        
        // 모든 API 실패
        throw new Error('Chzzk user info API failed')
      },
    },
    profile(profile) {
      return {
        id: profile.userIdHash,
        name: profile.channelName || profile.nickname,
        email: null,
        image: profile.channelImageUrl || profile.profileImageUrl,
        channelId: profile.channelId || profile.userIdHash,
        channelName: profile.channelName || profile.nickname,
        channelImageUrl: profile.channelImageUrl,
        followerCount: profile.followerCount,
      }
    },
    ...options,
  }
}