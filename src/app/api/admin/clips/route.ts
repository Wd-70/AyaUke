import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import { isSuperAdmin, UserRole } from '@/lib/permissions'
import dbConnect from '@/lib/mongodb'
import SongVideo from '@/models/SongVideo'
import SongDetail from '@/models/SongDetail'

export async function GET(request: Request) {
  try {
    // 권한 체크
    const session = await getServerSession(authOptions)
    if (!session || !isSuperAdmin(session.user.role as UserRole)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    await dbConnect()

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const sortBy = searchParams.get('sortBy') || 'recent' // recent, addedBy, songTitle, verified
    const filterBy = searchParams.get('filterBy') || 'all' // all, verified, unverified
    const search = searchParams.get('search') || ''
    const addedBy = searchParams.get('addedBy') || ''
    const songId = searchParams.get('songId') || ''

    const skip = (page - 1) * limit

    // 필터 조건 구성
    let matchConditions: any = {}
    
    if (filterBy === 'verified') {
      matchConditions.isVerified = true
    } else if (filterBy === 'unverified') {
      matchConditions.isVerified = false
    }

    if (addedBy) {
      matchConditions.addedByName = new RegExp(addedBy, 'i')
    }

    if (songId) {
      matchConditions.songId = songId
    }

    if (search) {
      matchConditions.$or = [
        { title: new RegExp(search, 'i') },
        { artist: new RegExp(search, 'i') },
        { addedByName: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') }
      ]
    }

    // 정렬 조건 구성
    let sortConditions: any = {}
    switch (sortBy) {
      case 'recent':
        sortConditions = { createdAt: -1 }
        break
      case 'addedBy':
        sortConditions = { addedByName: 1, createdAt: -1 }
        break
      case 'songTitle':
        sortConditions = { title: 1, artist: 1 }
        break
      case 'verified':
        sortConditions = { isVerified: -1, createdAt: -1 }
        break
      case 'sungDate':
        sortConditions = { sungDate: -1 }
        break
      default:
        sortConditions = { createdAt: -1 }
    }

    // 클립 데이터 조회
    const [clips, totalCount] = await Promise.all([
      SongVideo.find(matchConditions)
        .sort(sortConditions)
        .skip(skip)
        .limit(limit)
        .lean(),
      SongVideo.countDocuments(matchConditions)
    ])

    // 각 클립의 곡 정보도 함께 조회
    const clipsWithSongInfo = await Promise.all(
      clips.map(async (clip) => {
        const songDetail = await SongDetail.findById(clip.songId).lean()
        return {
          ...clip,
          songDetail: songDetail ? {
            _id: songDetail._id,
            title: songDetail.title,
            artist: songDetail.artist,
            language: songDetail.language,
            sungCount: songDetail.sungCount
          } : null
        }
      })
    )

    // 추가 통계 정보
    const stats = await Promise.all([
      SongVideo.countDocuments({ isVerified: true }),
      SongVideo.countDocuments({ isVerified: false }),
      SongVideo.aggregate([
        { $group: { _id: '$addedByName', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      SongVideo.aggregate([
        { $group: { _id: { songId: '$songId', title: '$title', artist: '$artist' }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ])
    ])

    const [verifiedCount, unverifiedCount, topContributors, topSongs] = stats

    return NextResponse.json({
      clips: clipsWithSongInfo,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit)
      },
      stats: {
        total: totalCount,
        verified: verifiedCount,
        unverified: unverifiedCount,
        topContributors: topContributors.map((c: any) => ({
          name: c._id,
          count: c.count
        })),
        topSongs: topSongs.map((s: any) => ({
          songId: s._id.songId,
          title: s._id.title,
          artist: s._id.artist,
          count: s.count
        }))
      }
    })
    
  } catch (error) {
    console.error('Clips API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch clips' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  try {
    // 권한 체크
    const session = await getServerSession(authOptions)
    if (!session || !isSuperAdmin(session.user.role as UserRole)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    await dbConnect()

    const { clipId, action, data } = await request.json()

    if (!clipId || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    let updateData: any = {}

    switch (action) {
      case 'verify':
        updateData = {
          isVerified: true,
          verifiedBy: session.user.id,
          verifiedAt: new Date()
        }
        break
      case 'unverify':
        updateData = {
          isVerified: false,
          verifiedBy: null,
          verifiedAt: null
        }
        break
      case 'updateTimes':
        if (data.startTime !== undefined) updateData.startTime = data.startTime
        if (data.endTime !== undefined) updateData.endTime = data.endTime
        break
      case 'updateDescription':
        updateData.description = data.description
        break
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const updatedClip = await SongVideo.findByIdAndUpdate(
      clipId,
      updateData,
      { new: true }
    ).lean()

    if (!updatedClip) {
      return NextResponse.json({ error: 'Clip not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, clip: updatedClip })
    
  } catch (error) {
    console.error('Clips update error:', error)
    return NextResponse.json(
      { error: 'Failed to update clip' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    // 권한 체크
    const session = await getServerSession(authOptions)
    if (!session || !isSuperAdmin(session.user.role as UserRole)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    await dbConnect()

    const { searchParams } = new URL(request.url)
    const clipId = searchParams.get('clipId')

    if (!clipId) {
      return NextResponse.json({ error: 'Missing clipId' }, { status: 400 })
    }

    const deletedClip = await SongVideo.findByIdAndDelete(clipId)

    if (!deletedClip) {
      return NextResponse.json({ error: 'Clip not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, message: 'Clip deleted successfully' })
    
  } catch (error) {
    console.error('Clips delete error:', error)
    return NextResponse.json(
      { error: 'Failed to delete clip' },
      { status: 500 }
    )
  }
}