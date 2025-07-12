import { ChzzkClient } from 'chzzk'

export interface ChzzkUserInfo {
  channelId: string | null
  channelName: string | null
  channelImageUrl: string | null
  followerCount: number | null
  verified: boolean
}

export interface NaverUserInfo {
  id: string
  nickname?: string
  name?: string
  email?: string
  profile_image?: string
}

/**
 * 네이버 사용자 정보를 바탕으로 치지직 채널 정보를 찾습니다
 */
export async function resolveChzzkUser(naverUser: NaverUserInfo): Promise<ChzzkUserInfo> {
  console.log('=== 치지직 사용자 해결 시작 ===')
  console.log('네이버 사용자 정보:', JSON.stringify(naverUser, null, 2))
  
  const client = new ChzzkClient()
  let bestMatch: ChzzkUserInfo = {
    channelId: null,
    channelName: null,
    channelImageUrl: null,
    followerCount: null,
    verified: false
  }

  try {
    // 1. 네이버 닉네임/이름으로 검색
    const searchTerms = [
      naverUser.nickname,
      naverUser.name,
    ].filter(Boolean)

    console.log('검색어 목록:', searchTerms)

    for (const searchTerm of searchTerms) {
      console.log(`"${searchTerm}"로 치지직 채널 검색 중...`)
      
      try {
        const searchResult = await client.search.channels(searchTerm)
        console.log(`"${searchTerm}" 검색 결과:`, JSON.stringify(searchResult, null, 2))

        if (searchResult.channels && searchResult.channels.length > 0) {
          // 가장 관련성이 높은 채널 찾기
          const exactMatch = searchResult.channels.find(channel => 
            channel.channelName === searchTerm ||
            channel.channelName?.toLowerCase() === searchTerm.toLowerCase()
          )

          const channel = exactMatch || searchResult.channels[0]
          
          console.log('선택된 채널:', JSON.stringify(channel, null, 2))

          // 채널 상세 정보 가져오기
          try {
            const channelDetail = await client.channel.detail(channel.channelId)
            console.log('채널 상세 정보:', JSON.stringify(channelDetail, null, 2))
            
            bestMatch = {
              channelId: channelDetail.channelId,
              channelName: channelDetail.channelName,
              channelImageUrl: channelDetail.channelImageUrl,
              followerCount: channelDetail.followerCount,
              verified: true
            }
            
            console.log('매칭 성공! 채널 정보 확정:', JSON.stringify(bestMatch, null, 2))
            break // 정확한 매칭을 찾았으므로 중단
            
          } catch (detailError) {
            console.log('채널 상세 정보 가져오기 실패:', detailError)
            
            // 상세 정보는 실패했지만 검색 결과는 사용
            bestMatch = {
              channelId: channel.channelId,
              channelName: channel.channelName,
              channelImageUrl: channel.channelImageUrl,
              followerCount: channel.followerCount,
              verified: false
            }
          }
        }
      } catch (searchError) {
        console.log(`"${searchTerm}" 검색 실패:`, searchError)
      }
    }

    // 2. 만약 검색으로 채널을 찾지 못했다면, 네이버 ID를 치지직 채널 ID로 시도해보기
    if (!bestMatch.channelId && naverUser.id) {
      console.log('네이버 ID를 치지직 채널 ID로 시도:', naverUser.id)
      
      try {
        const channelDetail = await client.channel.detail(naverUser.id)
        console.log('네이버 ID로 찾은 채널:', JSON.stringify(channelDetail, null, 2))
        
        bestMatch = {
          channelId: channelDetail.channelId,
          channelName: channelDetail.channelName,
          channelImageUrl: channelDetail.channelImageUrl,
          followerCount: channelDetail.followerCount,
          verified: true
        }
      } catch (directError) {
        console.log('네이버 ID로 채널 조회 실패:', directError)
      }
    }

  } catch (error) {
    console.error('치지직 사용자 해결 전체 실패:', error)
  }

  console.log('=== 최종 치지직 사용자 정보 ===')
  console.log(JSON.stringify(bestMatch, null, 2))
  
  return bestMatch
}