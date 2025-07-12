/**
 * 수동 쿠키 입력 및 관리 시스템
 * 자동 인증이 실패할 경우를 대비한 수동 방법
 */

import { ChzzkClient } from 'chzzk'

// 수동으로 설정할 수 있는 치지직 쿠키 저장소
const MANUAL_CHZZK_COOKIES: Record<string, string> = {
  // 네이버 ID: 치지직 쿠키 매핑
  // 예: 'Me5p7_FwFW0whxSNwetYBSkgRCBhTkuVwi-77nFieCI': 'NID_AUT=...; NID_SES=...'
}

/**
 * 수동 쿠키를 추가하는 함수 (개발자 도구용)
 */
export function addManualChzzkCookie(naverId: string, cookies: string) {
  MANUAL_CHZZK_COOKIES[naverId] = cookies
  console.log(`수동 쿠키 추가됨: ${naverId}`)
}

/**
 * 수동 쿠키를 사용해서 치지직 클라이언트 생성
 */
export async function createManualChzzkClient(naverId: string, providedCookies?: string) {
  console.log('=== 수동 쿠키로 치지직 클라이언트 생성 ===')
  
  // 직접 제공된 쿠키가 있으면 우선 사용
  const cookies = providedCookies || MANUAL_CHZZK_COOKIES[naverId]
  
  if (!cookies) {
    console.log(`네이버 ID ${naverId}에 대한 수동 쿠키가 없습니다`)
    return { client: new ChzzkClient(), userInfo: null }
  }
  
  try {
    console.log('수동 쿠키로 클라이언트 생성:', cookies.substring(0, 50) + '...')
    console.log('전체 쿠키 길이:', cookies.length)
    
    // 쿠키에서 NID_AUT와 NID_SES 추출
    const nidAuth = cookies.match(/NID_AUT=([^;]+)/)?.[1]
    const nidSession = cookies.match(/NID_SES=([^;]+)/)?.[1]
    
    console.log('추출된 NID_AUT:', nidAuth ? nidAuth.substring(0, 20) + '...' : 'null')
    console.log('추출된 NID_SES:', nidSession ? nidSession.substring(0, 20) + '...' : 'null')
    
    if (!nidAuth || !nidSession) {
      console.log('필수 쿠키 (NID_AUT 또는 NID_SES)가 없습니다')
      return { client: new ChzzkClient(), userInfo: null }
    }
    
    // 치지직 비공식 API 클라이언트 생성 (올바른 방식)
    const client = new ChzzkClient({
      nidAuth: nidAuth,
      nidSession: nidSession
    })
    
    console.log('ChzzkClient 생성 완료, 사용자 정보 조회 시도...')
    
    // 다양한 API 메서드 시도
    let userInfo = null
    
    try {
      console.log('client.user() 메서드 시도...')
      userInfo = await client.user()
      console.log('client.user() 결과:', JSON.stringify(userInfo, null, 2))
    } catch (userError) {
      console.log('client.user() 실패:', userError)
      
      try {
        console.log('client.me.user() 메서드 시도...')
        userInfo = await client.me.user()
        console.log('client.me.user() 결과:', JSON.stringify(userInfo, null, 2))
      } catch (meError) {
        console.log('client.me.user() 실패:', meError)
        
        try {
          console.log('client.me 프로퍼티 확인...')
          console.log('client.me:', client.me)
          
          if (client.me && typeof client.me.user === 'function') {
            userInfo = await client.me.user()
            console.log('client.me.user() 재시도 결과:', JSON.stringify(userInfo, null, 2))
          }
        } catch (me2Error) {
          console.log('client.me 재시도 실패:', me2Error)
        }
      }
    }
    
    if (userInfo && userInfo.loggedIn) {
      console.log('수동 쿠키 인증 성공!')
      return { client, userInfo }
    } else {
      console.log('사용자 정보 조회 실패, 하지만 클라이언트는 생성됨')
      return { client, userInfo: null }
    }
    
  } catch (error) {
    console.log('수동 쿠키 클라이언트 생성 실패:', error)
    console.log('error.message:', error instanceof Error ? error.message : 'Unknown error')
    return { client: new ChzzkClient(), userInfo: null }
  }
}

/**
 * 쿠키 설정 가이드 출력
 */
export function printCookieGuide(naverId: string) {
  console.log('=== 치지직 쿠키 수동 설정 가이드 ===')
  console.log('1. 브라우저에서 https://chzzk.naver.com 에 로그인')
  console.log('2. 개발자 도구 (F12) → Application/Storage → Cookies')
  console.log('3. NID_AUT와 NID_SES 쿠키 값을 복사')
  console.log('4. 다음 코드를 브라우저 콘솔에서 실행:')
  console.log(``)
  console.log(`   // 쿠키 값을 여기에 입력`)
  console.log(`   const cookies = "NID_AUT=당신의_NID_AUT_값; NID_SES=당신의_NID_SES_값"`)
  console.log(`   `)
  console.log(`   // API 호출`)
  console.log(`   fetch('/api/admin/set-manual-cookie', {`)
  console.log(`     method: 'POST',`)
  console.log(`     headers: { 'Content-Type': 'application/json' },`)
  console.log(`     body: JSON.stringify({`)
  console.log(`       naverId: '${naverId}',`)
  console.log(`       cookies: cookies`)
  console.log(`     })`)
  console.log(`   })`)
  console.log('')
  console.log('5. 로그아웃 후 다시 로그인하여 테스트')
}

/**
 * 현재 등록된 수동 쿠키 목록 조회
 */
export function getManualCookies() {
  return { ...MANUAL_CHZZK_COOKIES }
}

/**
 * 수동 쿠키 삭제
 */
export function removeManualCookie(naverId: string) {
  delete MANUAL_CHZZK_COOKIES[naverId]
  console.log(`수동 쿠키 삭제됨: ${naverId}`)
}