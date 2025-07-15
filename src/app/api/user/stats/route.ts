import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import dbConnect from '@/lib/mongodb'
import Like from '@/models/Like'
import Playlist from '@/models/Playlist'
import User from '@/models/User'
import SongDetail from '@/models/SongDetail'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.channelId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await dbConnect()

    // 사용자 정보 조회
    const user = await User.findOne({ channelId: session.user.channelId })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // 통계 데이터 조회
    const [
      totalLikes,
      totalPlaylists,
      totalSongsInPlaylists,
      recentLikes,
      recentPlaylists
    ] = await Promise.all([
      // 총 좋아요 수
      Like.countDocuments({ channelId: session.user.channelId }),
      
      // 총 플레이리스트 수
      Playlist.countDocuments({ channelId: session.user.channelId }),
      
      // 플레이리스트에 있는 총 곡 수
      Playlist.aggregate([
        { $match: { channelId: session.user.channelId } },
        { $unwind: '$songs' },
        { $count: 'total' }
      ]).then(result => result[0]?.total || 0),
      
      // 최근 좋아요 (5개)
      Like.find({ channelId: session.user.channelId })
        .populate({
          path: 'songId',
          model: SongDetail,
          select: 'title artist'
        })
        .sort({ createdAt: -1 })
        .limit(5),
      
      // 최근 플레이리스트 (3개)
      Playlist.find({ channelId: session.user.channelId })
        .sort({ updatedAt: -1 })
        .limit(3)
        .select('name description songs updatedAt')
    ])

    // 언어별 좋아요 통계
    const likesByLanguage = await Like.aggregate([
      { $match: { channelId: session.user.channelId } },
      {
        $lookup: {
          from: 'songdetails',
          localField: 'songId',
          foreignField: '_id',
          as: 'song'
        }
      },
      { $unwind: '$song' },
      {
        $group: {
          _id: '$song.language',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ])

    const stats = {
      user: {
        channelName: user.channelName,
        joinedAt: user.createdAt,
        lastLoginAt: user.lastLoginAt
      },
      totals: {
        likes: totalLikes,
        playlists: totalPlaylists,
        songsInPlaylists: totalSongsInPlaylists
      },
      breakdown: {
        likesByLanguage: likesByLanguage.map(item => ({
          language: item._id || 'Unknown',
          count: item.count
        }))
      },
      recent: {
        likes: recentLikes,
        playlists: recentPlaylists.map(playlist => {
          const playlistObj = playlist.toObject()
          return {
            ...playlistObj,
            songCount: Array.isArray(playlistObj.songs) ? playlistObj.songs.length : 0
          }
        })
      }
    }

    return NextResponse.json({ stats })
  } catch (error) {
    console.error('사용자 통계 조회 오류:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}