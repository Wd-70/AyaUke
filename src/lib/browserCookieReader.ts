/**
 * 브라우저에서 직접 쿠키를 읽어서 치지직 인증에 사용하는 함수들
 */

/**
 * 브라우저에서 특정 도메인의 쿠키를 읽는 함수
 */
export function readCookiesFromDomain(domain: string): Record<string, string> {
  if (typeof document === 'undefined') {
    return {}
  }

  const cookies: Record<string, string> = {}
  
  try {
    // 현재 도메인의 모든 쿠키 읽기
    const cookieString = document.cookie
    
    if (!cookieString) {
      return cookies
    }

    // 쿠키 파싱
    cookieString.split(';').forEach(cookie => {
      const [name, value] = cookie.trim().split('=')
      if (name && value) {
        cookies[name] = decodeURIComponent(value)
      }
    })

    console.log(`${domain} 도메인 쿠키:`, cookies)
    
  } catch (error) {
    console.error('쿠키 읽기 실패:', error)
  }

  return cookies
}

/**
 * 직접 JavaScript 실행으로 치지직 쿠키 추출
 */
export async function executeJavaScriptForCookies(): Promise<{ success: boolean, cookies?: string, error?: string }> {
  console.log('=== JavaScript 실행으로 쿠키 추출 ===')
  
  try {
    // 방법 1: 현재 도메인에서 직접 실행
    const cookieCode = `
      // 모든 쿠키 가져오기
      const allCookies = document.cookie;
      console.log('현재 도메인 모든 쿠키:', allCookies);
      
      // 네이버 쿠키만 필터링
      const naverCookies = allCookies
        .split(';')
        .map(c => c.trim())
        .filter(c => c.startsWith('NID_AUT=') || c.startsWith('NID_SES=') || c.startsWith('NID_JKL='))
        .join('; ');
      
      console.log('네이버 쿠키:', naverCookies);
      
      // localStorage에 임시 저장
      if (naverCookies) {
        localStorage.setItem('temp_naver_cookies', naverCookies);
        console.log('localStorage에 쿠키 저장 완료');
      }
      
      naverCookies;
    `
    
    // eval을 사용해서 직접 실행
    const result = eval(cookieCode)
    console.log('JavaScript 실행 결과:', result)
    
    if (result && result.length > 10) {
      return { success: true, cookies: result }
    }
    
    // 방법 2: localStorage에서 확인
    const storedCookies = localStorage.getItem('temp_naver_cookies')
    if (storedCookies) {
      console.log('localStorage에서 쿠키 발견:', storedCookies)
      return { success: true, cookies: storedCookies }
    }
    
    return { success: false, error: '쿠키를 찾을 수 없습니다' }
    
  } catch (error) {
    console.error('JavaScript 실행 오류:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * 네이버/치지직 쿠키를 추출하는 함수
 */
export function extractChzzkCookies(): { naverCookies: string | null, hasValidCookies: boolean } {
  console.log('=== 브라우저에서 치지직 쿠키 추출 시도 ===')
  
  // 현재 도메인의 쿠키 읽기
  const currentCookies = readCookiesFromDomain('current')
  
  // 네이버 관련 쿠키 찾기
  const naverCookieNames = ['NID_AUT', 'NID_SES', 'NID_JKL', 'NIPD']
  const foundNaverCookies: Record<string, string> = {}
  
  naverCookieNames.forEach(cookieName => {
    if (currentCookies[cookieName] && currentCookies[cookieName] !== 'expired') {
      foundNaverCookies[cookieName] = currentCookies[cookieName]
    }
  })
  
  console.log('발견된 네이버 쿠키:', foundNaverCookies)
  
  // localStorage에서도 확인
  try {
    const storedCookies = localStorage.getItem('temp_naver_cookies')
    if (storedCookies) {
      console.log('localStorage에서 추가 쿠키 발견:', storedCookies)
      return {
        naverCookies: storedCookies,
        hasValidCookies: true
      }
    }
  } catch (error) {
    console.log('localStorage 확인 실패:', error)
  }
  
  // 유효한 쿠키가 있는지 확인
  const hasValidCookies = Object.keys(foundNaverCookies).length > 0
  
  let cookieString = null
  if (hasValidCookies) {
    cookieString = Object.entries(foundNaverCookies)
      .map(([name, value]) => `${name}=${value}`)
      .join('; ')
  }
  
  return {
    naverCookies: cookieString,
    hasValidCookies
  }
}

/**
 * 사용자에게 치지직 로그인을 요청하는 함수
 */
export function requestChzzkLogin(): Promise<{ success: boolean, cookies?: string }> {
  return new Promise((resolve) => {
    console.log('=== 사용자 치지직 로그인 요청 ===')
    
    // 새 창에서 치지직 열기
    const chzzkWindow = window.open(
      'https://chzzk.naver.com',
      'chzzk-login',
      'width=800,height=600,scrollbars=yes,resizable=yes'
    )
    
    if (!chzzkWindow) {
      alert('팝업이 차단되었습니다. 팝업을 허용하고 다시 시도해주세요.')
      resolve({ success: false })
      return
    }
    
    // 사용자에게 안내 메시지 (수동 쿠키 추출 안내)
    const confirmed = confirm(
      '치지직 로그인을 위해 새 창이 열렸습니다.\n\n' +
      '1. 새 창에서 치지직에 로그인해주세요\n' +
      '2. F12 → Application → Cookies → chzzk.naver.com\n' +
      '3. NID_AUT, NID_SES 쿠키를 복사해주세요\n' +
      '4. 이 창을 닫고 수동으로 쿠키를 입력해주세요\n\n' +
      '쿠키를 복사하셨나요?'
    )
    
    if (confirmed) {
      // 쿠키 수동 입력 안내
      const cookieInput = prompt(
        '복사한 쿠키를 입력해주세요:\n' +
        '(예: NID_AUT=값1; NID_SES=값2)'
      )
      
      if (cookieInput && cookieInput.includes('NID_')) {
        console.log('수동 쿠키 입력 성공!')
        resolve({ success: true, cookies: cookieInput })
      } else {
        alert('올바른 쿠키 형식이 아닙니다.')
        resolve({ success: false })
      }
    } else {
      resolve({ success: false })
    }
    
    // 창 닫기
    if (chzzkWindow && !chzzkWindow.closed) {
      chzzkWindow.close()
    }
  })
}

/**
 * iframe을 사용해서 치지직 쿠키에 접근하는 함수 (CORS 제한이 있을 수 있음)
 */
export function tryAccessChzzkCookiesViaIframe(): Promise<{ success: boolean, cookies?: string }> {
  return new Promise((resolve) => {
    console.log('=== iframe으로 치지직 쿠키 접근 시도 ===')
    
    // iframe 생성
    const iframe = document.createElement('iframe')
    iframe.src = 'https://chzzk.naver.com'
    iframe.style.display = 'none'
    
    iframe.onload = () => {
      try {
        // iframe의 쿠키에 접근 시도 (CORS 제한으로 실패할 가능성 높음)
        const iframeDocument = iframe.contentDocument || iframe.contentWindow?.document
        
        if (iframeDocument) {
          const iframeCookies = iframeDocument.cookie
          console.log('iframe 쿠키:', iframeCookies)
          
          if (iframeCookies && iframeCookies.includes('NID_')) {
            resolve({ success: true, cookies: iframeCookies })
          } else {
            resolve({ success: false })
          }
        } else {
          console.log('iframe 문서 접근 실패 (CORS 제한)')
          resolve({ success: false })
        }
      } catch (error) {
        console.log('iframe 쿠키 접근 실패:', error)
        resolve({ success: false })
      } finally {
        // iframe 제거
        document.body.removeChild(iframe)
      }
    }
    
    iframe.onerror = () => {
      console.log('iframe 로드 실패')
      document.body.removeChild(iframe)
      resolve({ success: false })
    }
    
    // iframe을 DOM에 추가
    document.body.appendChild(iframe)
    
    // 5초 후 타임아웃
    setTimeout(() => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe)
        resolve({ success: false })
      }
    }, 5000)
  })
}