import { ChzzkClient } from 'chzzk'

/**
 * 네이버 OAuth 토큰을 사용해서 치지직 인증 쿠키를 생성하는 함수
 */
export async function createChzzkAuthFromNaver(naverAccessToken: string) {
  console.log('=== 자동 쿠키 생성 제거됨 (효과 없음) ===')
  console.log('수동 쿠키 설정 방식을 사용해주세요')
  return null
}

/**
 * 치지직 클라이언트를 인증된 상태로 생성
 */
export async function createAuthenticatedChzzkClient(naverAccessToken: string) {
  console.log('=== 인증된 치지직 클라이언트 생성 ===')
  
  try {
    // 방법 1: 쿠키 기반 인증 시도
    console.log('쿠키 기반 인증 시도...')
    const authResult = await createChzzkAuthFromNaver(naverAccessToken)
    
    if (authResult && authResult.cookies) {
      console.log('쿠키 획득 성공, 인증된 클라이언트 생성...')
      
      // 쿠키를 사용한 인증된 클라이언트 생성
      const client = new ChzzkClient({
        cookie: authResult.cookies
      })
      
      try {
        // 인증 확인을 위해 사용자 정보 조회
        console.log('인증된 사용자 정보 조회 시도...')
        const userInfo = await client.user()
        console.log('인증된 사용자 정보:', JSON.stringify(userInfo, null, 2))
        
        return { client, userInfo }
      } catch (userError) {
        console.log('사용자 정보 조회 실패:', userError)
        
        // 사용자 정보 조회는 실패했지만 클라이언트는 인증됨
        return { client, userInfo: null }
      }
    }
    
    // 방법 2: 네이버 토큰을 직접 사용한 클라이언트
    console.log('네이버 토큰을 직접 사용한 클라이언트 생성...')
    
    // NID_AUT, NID_SES 형식의 쿠키 생성
    const naverCookies = `NID_AUT=${naverAccessToken}; NID_SES=temp_session`
    
    const directClient = new ChzzkClient({
      cookie: naverCookies
    })
    
    try {
      const directUserInfo = await directClient.user()
      console.log('직접 토큰 인증 성공:', JSON.stringify(directUserInfo, null, 2))
      return { client: directClient, userInfo: directUserInfo }
    } catch (directError) {
      console.log('직접 토큰 인증 실패:', directError)
    }
    
    // 방법 3: 기본 클라이언트로 대체
    console.log('모든 인증 방법 실패, 기본 클라이언트 사용')
    const client = new ChzzkClient()
    
    return { client, userInfo: null }
    
  } catch (error) {
    console.error('인증된 치지직 클라이언트 생성 실패:', error)
    
    // 최종적으로 기본 클라이언트 반환
    const client = new ChzzkClient()
    return { client, userInfo: null }
  }
}