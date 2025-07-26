import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import dbConnect from '@/lib/mongodb'
import Playlist from '@/models/Playlist'
import { authOptions } from '@/lib/authOptions'
import mongoose from 'mongoose'


export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.channelId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const includeSongs = searchParams.get('includeSongs') === 'true'
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '10', 10)
    const skip = (page - 1) * limit

    await dbConnect()

    let playlists
    let total
    
    const baseFilter = { channelId: session.user.channelId }

    // 곡 정보 포함 여부에 따라 populate 적용
    if (includeSongs) {
      try {
        // SongDetail 모델 등록 상태 확인 및 강제 등록
        console.log('🔍 SongDetail 모델 등록 상태:', !!mongoose.models.SongDetail)
        if (!mongoose.models.SongDetail) {
          console.log('🔧 SongDetail 모델 강제 등록 중...')
          await import('@/models/SongDetail')
          console.log('✅ SongDetail 모델 등록 완료')
        }
        
        // 새로운 쿼리로 populate 시도
        const [populatedPlaylists, totalCount] = await Promise.all([
          Playlist.find(baseFilter)
            .sort({ updatedAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('songs.songId', 'title artist language imageUrl')
            .exec(),
          Playlist.countDocuments(baseFilter)
        ])
        playlists = populatedPlaylists
        total = totalCount
        console.log('✅ populate 성공')
      } catch (error) {
        console.warn('⚠️ populate 실패, 기본 정보만 반환:', error.message)
        // populate 실패 시 새로운 쿼리로 기본 플레이리스트 정보만 반환
        const [basicPlaylists, totalCount] = await Promise.all([
          Playlist.find(baseFilter)
            .sort({ updatedAt: -1 })
            .skip(skip)
            .limit(limit)
            .exec(),
          Playlist.countDocuments(baseFilter)
        ])
        playlists = basicPlaylists
        total = totalCount
      }
    } else {
      // includeSongs가 false인 경우
      const [basicPlaylists, totalCount] = await Promise.all([
        Playlist.find(baseFilter)
          .sort({ updatedAt: -1 })
          .skip(skip)
          .limit(limit)
          .exec(),
        Playlist.countDocuments(baseFilter)
      ])
      playlists = basicPlaylists
      total = totalCount
    }

    // 곡 수 정보 추가
    const playlistsWithCounts = playlists.map(playlist => {
      const playlistObj = playlist.toObject()
      return {
        ...playlistObj,
        songCount: playlistObj.songs.length
      }
    })

    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      playlists: playlistsWithCounts,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    })
  } catch (error) {
    console.error('사용자 플레이리스트 목록 조회 오류:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}