import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { ChzzkClient } from 'chzzk'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession()
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('=== 세션 정보 디버깅 ===')
    console.log('Session User:', JSON.stringify(session.user, null, 2))
    console.log('User naverId:', session.user.naverId)
    console.log('User channelId:', session.user.channelId)
    console.log('User channelName:', session.user.channelName)
    console.log('User isAyauke:', session.user.isAyauke)

    let chzzkInfo = null
    
    try {
      const client = new ChzzkClient()
      
      // 채널 ID가 있으면 해당 채널 정보를 가져옴
      if (session.user.channelId) {
        console.log('=== 치지직 채널 정보 조회 ===')
        console.log('Channel ID:', session.user.channelId)
        
        const channelInfo = await client.channel.detail(session.user.channelId)
        chzzkInfo = {
          channelId: channelInfo.channelId,
          channelName: channelInfo.channelName,
          channelImageUrl: channelInfo.channelImageUrl,
          followerCount: channelInfo.followerCount,
          openLive: channelInfo.openLive
        }
        
        console.log('Chzzk Channel Info:', JSON.stringify(chzzkInfo, null, 2))
      } else {
        // 채널 ID가 없으면 검색으로 찾아보기
        console.log('=== 치지직 채널 검색 ===')
        console.log('Searching for:', session.user.name)
        
        const searchResult = await client.search.channels(session.user.name || '')
        console.log('Search Results:', JSON.stringify(searchResult, null, 2))
        
        if (searchResult.channels && searchResult.channels.length > 0) {
          const channel = searchResult.channels[0]
          chzzkInfo = {
            channelId: channel.channelId,
            channelName: channel.channelName,
            channelImageUrl: channel.channelImageUrl,
            followerCount: channel.followerCount,
            openLive: channel.openLive
          }
        }
      }
    } catch (chzzkError) {
      console.error('치지직 API 오류:', chzzkError)
    }

    const result = {
      session: {
        user: session.user,
        naverId: session.user.naverId,
        channelId: session.user.channelId,
        channelName: session.user.channelName,
        isAyauke: session.user.isAyauke
      },
      chzzkInfo
    }

    console.log('=== 최종 결과 ===')
    console.log(JSON.stringify(result, null, 2))

    return NextResponse.json(result)
  } catch (error) {
    console.error('API 오류:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}