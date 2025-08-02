import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import { isSuperAdmin, UserRole } from '@/lib/permissions'
import dbConnect from '@/lib/mongodb'
import SongVideo from '@/models/SongVideo'
import User from '@/models/User'
import Playlist from '@/models/Playlist'
import SongDetail from '@/models/SongDetail'

export async function GET() {
  try {
    // 권한 체크
    const session = await getServerSession(authOptions)
    if (!session || !isSuperAdmin(session.user.role as UserRole)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    await dbConnect()

    // 병렬로 모든 통계 데이터 수집
    const [
      // 핵심 지표
      totalUsers,
      totalSongs,
      totalClips,
      totalPlaylists,
      
      // 라이브 클립 통계
      verifiedClips,
      recentClips,
      topContributors,
      clipsPerSong,
      
      // 사용자 통계
      activeUsers,
      usersByRole,
      recentUsers,
      
      // 플레이리스트 통계
      publicPlaylists,
      averagePlaylistSize,
      topTags,
      
      // 곡 통계
      songsByLanguage,
      topSungSongs,
      songsWithMR,
      songsByStatus,
      
      // 시간별 추이
      monthlyClips,
      monthlyUsers,
      monthlyPlaylists
    ] = await Promise.all([
      // 핵심 지표
      User.countDocuments(),
      SongDetail.countDocuments({ status: 'active' }),
      SongVideo.countDocuments(),
      Playlist.countDocuments(),
      
      // 라이브 클립 통계
      SongVideo.countDocuments({ isVerified: true }),
      SongVideo.countDocuments({ 
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } 
      }),
      SongVideo.aggregate([
        { $group: { _id: '$addedByName', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      SongVideo.aggregate([
        { $group: { _id: { songId: '$songId', title: '$title', artist: '$artist' }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      
      // 사용자 통계
      User.countDocuments({ 
        lastLoginAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } 
      }),
      User.aggregate([
        { $group: { _id: '$role', count: { $sum: 1 } } }
      ]),
      User.countDocuments({ 
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } 
      }),
      
      // 플레이리스트 통계
      Playlist.countDocuments({ isPublic: true }),
      Playlist.aggregate([
        { $group: { _id: null, avgSize: { $avg: { $size: '$songs' } } } }
      ]),
      Playlist.aggregate([
        { $unwind: '$tags' },
        { $group: { _id: '$tags', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      
      // 곡 통계
      SongDetail.aggregate([
        { $match: { status: 'active' } },
        { $group: { _id: '$language', count: { $sum: 1 } } }
      ]),
      SongDetail.find({ 
        $or: [
          { status: 'active' },
          { status: { $exists: false } }, // status 필드가 없는 경우
          { status: null }, // status가 null인 경우
          { status: undefined } // status가 undefined인 경우
        ]
      })
        .sort({ sungCount: -1, _id: 1 })
        .limit(10)
        .select('title artist sungCount')
        .lean(),
      SongDetail.countDocuments({ 
        status: 'active',
        mrLinks: { $exists: true, $ne: [] }
      }),
      SongDetail.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      
      // 월별 추이 (최근 6개월)
      SongVideo.aggregate([
        {
          $match: {
            createdAt: { $gte: new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000) }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]),
      User.aggregate([
        {
          $match: {
            createdAt: { $gte: new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000) }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]),
      Playlist.aggregate([
        {
          $match: {
            createdAt: { $gte: new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000) }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ])
    ])

    // 디버그: topSungSongs 데이터 확인 (status 수정 후)
    console.log('=== TOP SUNG SONGS DEBUG (status 수정 후) ===');
    console.log('Top 10 songs from sungCount query:');
    topSungSongs.forEach((song, index) => {
      console.log(`${index + 1}. ${song.title} - ${song.artist}: sungCount=${song.sungCount || 'null'}`);
    });
    console.log('=== END DEBUG ===\n');

    // 데이터 정리 및 반환
    const stats = {
      // 핵심 지표
      overview: {
        totalUsers,
        totalSongs,
        totalClips,
        totalPlaylists,
        verificationRate: totalClips > 0 ? Math.round((verifiedClips / totalClips) * 100) : 0,
        recentClipsWeek: recentClips
      },
      
      // 라이브 클립 통계
      clips: {
        total: totalClips,
        verified: verifiedClips,
        unverified: totalClips - verifiedClips,
        recentWeek: recentClips,
        topContributors: topContributors.map(c => ({
          name: c._id,
          count: c.count
        })),
        clipsPerSong: clipsPerSong.map(c => ({
          songId: c._id.songId,
          title: c._id.title,
          artist: c._id.artist,
          count: c.count
        }))
      },
      
      // 사용자 통계
      users: {
        total: totalUsers,
        active: activeUsers,
        recent: recentUsers,
        byRole: usersByRole.reduce((acc, u) => {
          acc[u._id || 'user'] = u.count
          return acc
        }, {} as Record<string, number>)
      },
      
      // 플레이리스트 통계
      playlists: {
        total: totalPlaylists,
        public: publicPlaylists,
        private: totalPlaylists - publicPlaylists,
        averageSize: Math.round(averagePlaylistSize[0]?.avgSize || 0),
        topTags: topTags.map(t => ({
          tag: t._id,
          count: t.count
        }))
      },
      
      // 곡 통계
      songs: {
        total: totalSongs,
        byLanguage: songsByLanguage.reduce((acc, s) => {
          acc[s._id || 'Unknown'] = s.count
          return acc
        }, {} as Record<string, number>),
        topSung: topSungSongs.map(s => ({
          title: s.title,
          artist: s.artist,
          sungCount: s.sungCount || 0
        })),
        withMR: songsWithMR,
        byStatus: songsByStatus.reduce((acc, s) => {
          acc[s._id] = s.count
          return acc
        }, {} as Record<string, number>)
      },
      
      // 월별 추이
      trends: {
        clips: monthlyClips.map(m => ({
          month: `${m._id.year}-${String(m._id.month).padStart(2, '0')}`,
          count: m.count
        })),
        users: monthlyUsers.map(m => ({
          month: `${m._id.year}-${String(m._id.month).padStart(2, '0')}`,
          count: m.count
        })),
        playlists: monthlyPlaylists.map(m => ({
          month: `${m._id.year}-${String(m._id.month).padStart(2, '0')}`,
          count: m.count
        }))
      }
    }

    return NextResponse.json(stats)
    
  } catch (error) {
    console.error('Dashboard stats error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard statistics' },
      { status: 500 }
    )
  }
}