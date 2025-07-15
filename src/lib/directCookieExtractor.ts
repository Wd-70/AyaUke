/**
 * 직접적인 쿠키 추출 방법들
 */

/**
 * 사용자 동의하에 치지직 페이지로 이동해서 쿠키 추출
 */
export function extractCookiesFromChzzk(): Promise<{ success: boolean, cookies?: string, error?: string }> {
  return new Promise((resolve) => {
    console.log('=== 치지직 페이지에서 직접 쿠키 추출 ===')
    
    const confirmed = confirm(
      '치지직에서 쿠키를 자동으로 추출하시겠습니까?\n\n' +
      '1. 치지직 페이지로 이동합니다\n' +
      '2. 로그인이 되어있다면 쿠키를 자동으로 가져옵니다\n' +
      '3. 완료되면 자동으로 돌아옵니다\n\n' +
      '진행하시겠습니까?'
    )
    
    if (!confirmed) {
      resolve({ success: false, error: '사용자가 취소했습니다' })
      return
    }
    
    // 현재 페이지 정보 저장
    const returnUrl = window.location.href
    const originalTitle = document.title
    
    // 치지직으로 이동하는 JavaScript 코드 생성
    const extractorScript = `
      console.log('치지직 페이지에서 쿠키 추출 시작');
      
      // 3초 후 쿠키 추출 시도
      setTimeout(() => {
        try {
          const cookies = document.cookie;
          console.log('치지직 도메인 쿠키:', cookies);
          
          // 네이버 쿠키 필터링
          const naverCookies = cookies
            .split(';')
            .map(c => c.trim())
            .filter(c => c.startsWith('NID_AUT=') || c.startsWith('NID_SES=') || c.startsWith('NID_JKL='))
            .join('; ');
          
          console.log('추출된 네이버 쿠키:', naverCookies);
          
          if (naverCookies) {
            // localStorage에 저장 (도메인 간 공유를 위해)
            localStorage.setItem('extracted_chzzk_cookies', naverCookies);
            localStorage.setItem('cookie_extraction_success', 'true');
            localStorage.setItem('return_url', '${returnUrl}');
            
            alert('쿠키 추출 성공! 원래 페이지로 돌아갑니다.');
            window.location.href = '${returnUrl}';
          } else {
            alert('네이버 쿠키를 찾을 수 없습니다. 치지직에 로그인하고 다시 시도해주세요.');
            localStorage.setItem('cookie_extraction_success', 'false');
            localStorage.setItem('return_url', '${returnUrl}');
            window.location.href = '${returnUrl}';
          }
        } catch (error) {
          console.error('쿠키 추출 오류:', error);
          alert('쿠키 추출 중 오류가 발생했습니다: ' + error.message);
          localStorage.setItem('cookie_extraction_success', 'false');
          localStorage.setItem('return_url', '${returnUrl}');
          window.location.href = '${returnUrl}';
        }
      }, 3000);
    `
    
    // URL에 스크립트 포함해서 치지직으로 이동
    const chzzkUrl = `https://chzzk.naver.com/?auto_extract=true#${encodeURIComponent(extractorScript)}`
    
    // 페이지 이동
    window.location.href = chzzkUrl
    
    // 타임아웃 (30초 후 실패 처리)
    setTimeout(() => {
      resolve({ success: false, error: '타임아웃: 30초 내에 완료되지 않았습니다' })
    }, 30000)
  })
}

/**
 * 추출된 쿠키 확인 (페이지 돌아온 후)
 */
export function checkExtractedCookies(): { success: boolean, cookies?: string } {
  try {
    const success = localStorage.getItem('cookie_extraction_success')
    const cookies = localStorage.getItem('extracted_chzzk_cookies')
    
    if (success === 'true' && cookies) {
      // 임시 저장소 정리
      localStorage.removeItem('cookie_extraction_success')
      localStorage.removeItem('extracted_chzzk_cookies')
      localStorage.removeItem('return_url')
      
      return { success: true, cookies }
    }
    
    return { success: false }
  } catch (error) {
    console.error('추출된 쿠키 확인 오류:', error)
    return { success: false }
  }
}

/**
 * postMessage를 사용한 도메인 간 쿠키 전송
 */
export function extractCookiesViaPostMessage(): Promise<{ success: boolean, cookies?: string, error?: string }> {
  return new Promise((resolve) => {
    console.log('=== postMessage를 통한 쿠키 추출 ===')
    
    // 새 창 열기
    const chzzkWindow = window.open(
      'https://chzzk.naver.com',
      'chzzk-cookie-extractor',
      'width=800,height=600'
    )
    
    if (!chzzkWindow) {
      resolve({ success: false, error: '팝업이 차단되었습니다' })
      return
    }
    
    // postMessage 리스너
    const messageListener = (event: MessageEvent) => {
      if (event.origin !== 'https://chzzk.naver.com') {
        return
      }
      
      console.log('치지직에서 메시지 수신:', event.data)
      
      if (event.data.type === 'COOKIES_EXTRACTED') {
        window.removeEventListener('message', messageListener)
        chzzkWindow.close()
        
        if (event.data.success && event.data.cookies) {
          resolve({ success: true, cookies: event.data.cookies })
        } else {
          resolve({ success: false, error: event.data.error || '쿠키 추출 실패' })
        }
      }
    }
    
    window.addEventListener('message', messageListener)
    
    // 5초 후 치지직 창에 메시지 전송
    setTimeout(() => {
      try {
        const extractScript = `
          try {
            const cookies = document.cookie;
            const naverCookies = cookies
              .split(';')
              .map(c => c.trim())
              .filter(c => c.startsWith('NID_AUT=') || c.startsWith('NID_SES=') || c.startsWith('NID_JKL='))
              .join('; ');
            
            window.opener.postMessage({
              type: 'COOKIES_EXTRACTED',
              success: !!naverCookies,
              cookies: naverCookies,
              error: !naverCookies ? '네이버 쿠키가 없습니다' : null
            }, '${window.location.origin}');
          } catch (error) {
            window.opener.postMessage({
              type: 'COOKIES_EXTRACTED',
              success: false,
              error: error.message
            }, '${window.location.origin}');
          }
        `
        
        chzzkWindow.postMessage({ type: 'EXTRACT_COOKIES', script: extractScript }, 'https://chzzk.naver.com')
      } catch (error) {
        console.error('메시지 전송 오류:', error)
      }
    }, 5000)
    
    // 30초 타임아웃
    setTimeout(() => {
      window.removeEventListener('message', messageListener)
      if (!chzzkWindow.closed) {
        chzzkWindow.close()
      }
      resolve({ success: false, error: '타임아웃' })
    }, 30000)
  })
}

/**
 * 브라우저 확장기능 스타일 접근 (실험적)
 */
export async function extractCookiesViaAPI(): Promise<{ success: boolean, cookies?: string, error?: string }> {
  try {
    console.log('=== API를 통한 쿠키 추출 시도 ===')
    
    // Permissions API 확인
    if ('permissions' in navigator) {
      const permission = await (navigator as { permissions: { query: (options: { name: string }) => Promise<{ state: string }> } }).permissions.query({ name: 'cookies' })
      console.log('쿠키 권한 상태:', permission.state)
    }
    
    // Service Worker를 통한 쿠키 접근 시도
    if ('serviceWorker' in navigator) {
      console.log('Service Worker를 통한 쿠키 접근 시도...')
      // 실제 구현은 복잡하므로 일단 스킵
    }
    
    return { success: false, error: '브라우저 API 방식은 아직 구현되지 않았습니다' }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}