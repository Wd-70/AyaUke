/**
 * 네이버 토큰으로 치지직에 직접 로그인을 시도하는 함수들
 */

export async function attemptChzzkLogin(naverAccessToken: string) {
  console.log('=== 직접 API 호출 제거됨 (효과 없음) ===')
  console.log('수동 쿠키 방식만 사용합니다')
  return null
}

/**
 * 네이버 토큰으로 치지직 쿠키를 얻는 시도
 */
export async function getChzzkCookiesFromNaver(naverAccessToken: string) {
  console.log('=== 치지직 쿠키 획득 시도 ===')
  
  try {
    // 치지직 로그인 페이지에서 네이버 토큰으로 인증
    const loginUrl = `https://nid.naver.com/oauth2.0/authorize?response_type=code&client_id=치지직_클라이언트_ID&redirect_uri=https://chzzk.naver.com/auth/callback&state=login`
    
    console.log('치지직 OAuth 콜백 시뮬레이션...')
    
    const response = await fetch('https://chzzk.naver.com/auth/callback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${naverAccessToken}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: JSON.stringify({
        access_token: naverAccessToken
      })
    })
    
    console.log('콜백 응답:', response.status)
    
    if (response.ok) {
      const cookies = response.headers.get('set-cookie')
      console.log('획득한 쿠키:', cookies)
      
      const data = await response.json()
      console.log('콜백 데이터:', JSON.stringify(data, null, 2))
      
      return { cookies, data }
    }
    
  } catch (error) {
    console.error('쿠키 획득 실패:', error)
  }
  
  return null
}