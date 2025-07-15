/**
 * 치지직 비공식 API 테스트 함수들
 */

import { ChzzkClient } from 'chzzk'

export async function testChzzkMethods(cookies?: string) {
  console.log('=== 치지직 API 메서드 테스트 ===')
  
  const client = cookies ? new ChzzkClient({ cookie: cookies }) : new ChzzkClient()
  
  console.log('ChzzkClient 생성 완료')
  console.log('클라이언트 타입:', typeof client)
  console.log('클라이언트 프로퍼티들:', Object.keys(client))
  
  // 사용 가능한 메서드들 확인
  const methods = [
    'user',
    'me',
    'channel',
    'search',
    'live',
    'video'
  ]
  
  for (const method of methods) {
    try {
      console.log(`\n--- ${method} 메서드 테스트 ---`)
      
      if (method in client) {
        const methodObj = (client as Record<string, unknown>)[method]
        console.log(`${method} 타입:`, typeof methodObj)
        
        if (typeof methodObj === 'object' && methodObj !== null) {
          console.log(`${method} 하위 메서드들:`, Object.keys(methodObj))
        }
        
        if (typeof methodObj === 'function') {
          console.log(`${method}은 함수입니다`)
        }
      } else {
        console.log(`${method} 메서드가 존재하지 않습니다`)
      }
    } catch (error) {
      console.log(`${method} 메서드 확인 중 오류:`, error)
    }
  }
  
  // 실제 API 호출 테스트
  console.log('\n=== 실제 API 호출 테스트 ===')
  
  try {
    if (typeof client.user === 'function') {
      console.log('client.user() 호출 시도...')
      const userResult = await client.user()
      console.log('client.user() 결과:', userResult)
    }
  } catch (error) {
    console.log('client.user() 실패:', error)
  }
  
  try {
    if (client.me && typeof client.me.user === 'function') {
      console.log('client.me.user() 호출 시도...')
      const meUserResult = await client.me.user()
      console.log('client.me.user() 결과:', meUserResult)
    }
  } catch (error) {
    console.log('client.me.user() 실패:', error)
  }
  
  // 검색 테스트
  try {
    if (client.search && typeof client.search.channels === 'function') {
      console.log('client.search.channels() 호출 시도...')
      const searchResult = await client.search.channels('아야우케')
      console.log('client.search.channels() 결과:', searchResult)
    }
  } catch (error) {
    console.log('client.search.channels() 실패:', error)
  }
  
  return client
}