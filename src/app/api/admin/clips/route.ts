import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import { isSuperAdmin, UserRole } from '@/lib/permissions'
import { connectToDatabase } from '@/lib/mongodb'
import SongVideo from '@/models/SongVideo'
import SongDetail from '@/models/SongDetail'
import { updateVideoData, validateYouTubeUrl } from '@/lib/youtube'

export async function GET(request: Request) {
  try {
    // 권한 체크
    const session = await getServerSession(authOptions)
    if (!session || !isSuperAdmin(session.user.role as UserRole)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    await connectToDatabase()

    const { searchParams } = new URL(request.url)
    
    // 전체 클립 데이터 조회 요청인지 확인 (중복검사용)
    const getAllForDuplicateCheck = searchParams.get('getAllForDuplicateCheck') === 'true'
    
    if (getAllForDuplicateCheck) {
      // 중복검사용 전체 클립 데이터 (최소한의 필드만)
      const clips = await SongVideo.find({}, {
        songId: 1,
        videoId: 1, 
        startTime: 1,
        endTime: 1,
        sungDate: 1,
        createdAt: 1
      }).lean().sort({ createdAt: -1 })

      const totalCount = clips.length
      const dataSize = JSON.stringify(clips).length

      console.log(`📊 중복검사용 전체 라이브클립 조회: ${totalCount}개, 데이터 크기: ${(dataSize / 1024 / 1024).toFixed(2)}MB`)

      return NextResponse.json({
        success: true,
        clips: clips.map(clip => ({
          songId: clip.songId,
          videoId: clip.videoId,
          startTime: clip.startTime || 0,
          endTime: clip.endTime,
          sungDate: clip.sungDate
        })),
        meta: {
          totalCount,
          dataSizeMB: Math.round(dataSize / 1024 / 1024 * 100) / 100
        }
      })
    }

    // 기존 페이지네이션 기반 조회 로직
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const sortBy = searchParams.get('sortBy') || 'recent' // recent, addedBy, songTitle, verified
    const filterBy = searchParams.get('filterBy') || 'all' // all, verified, unverified
    const search = searchParams.get('search') || ''
    const addedBy = searchParams.get('addedBy') || ''
    const songId = searchParams.get('songId') || ''

    const skip = (page - 1) * limit

    // 디버깅을 위한 로그
    console.log('🔍 Clips API params:', { page, limit, sortBy, filterBy, search, addedBy, songId })

    // 필터 조건 구성
    let matchConditions: any = {}
    
    if (filterBy === 'verified') {
      matchConditions.isVerified = true
    } else if (filterBy === 'unverified') {
      matchConditions.isVerified = false
    }

    if (addedBy) {
      // 정확한 매칭을 위해 escape 처리
      const escapedAddedBy = addedBy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      matchConditions.addedByName = new RegExp(`^${escapedAddedBy}$`, 'i')
    }

    if (songId) {
      matchConditions.songId = songId
    }

    console.log('🎯 Match conditions:', matchConditions)

    // 검색의 경우 aggregation을 사용해야 하므로 별도 처리

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

    // 클립 데이터 조회 (검색이 있는 경우 aggregation 사용)
    let clips: any[]
    let totalCount: number

    if (search) {
      // 공백 제거 및 대소문자 무시 검색
      const searchPattern = search.replace(/\s+/g, '').toLowerCase()
      
      const aggregationPipeline = [
        {
          $lookup: {
            from: 'songdetails',
            localField: 'songId',
            foreignField: '_id',
            as: 'songDetail'
          }
        },
        {
          $addFields: {
            songDetail: { $arrayElemAt: ['$songDetail', 0] },
            // 검색용 필드들 (공백 제거 및 소문자 변환)
            searchableTitle: { $toLower: { $replaceAll: { input: '$title', find: ' ', replacement: '' } } },
            searchableArtist: { $toLower: { $replaceAll: { input: '$artist', find: ' ', replacement: '' } } },
            searchableAddedBy: { $toLower: { $replaceAll: { input: '$addedByName', find: ' ', replacement: '' } } },
            searchableDescription: { $toLower: { $replaceAll: { input: { $ifNull: ['$description', ''] }, find: ' ', replacement: '' } } }
          }
        },
        {
          $addFields: {
            // SongDetail의 alias와 searchTags도 검색 대상에 포함
            searchableTitleAlias: { $toLower: { $replaceAll: { input: { $ifNull: ['$songDetail.titleAlias', ''] }, find: ' ', replacement: '' } } },
            searchableArtistAlias: { $toLower: { $replaceAll: { input: { $ifNull: ['$songDetail.artistAlias', ''] }, find: ' ', replacement: '' } } },
            searchableTags: {
              $reduce: {
                input: { $ifNull: ['$songDetail.searchTags', []] },
                initialValue: '',
                in: { $concat: ['$$value', { $toLower: { $replaceAll: { input: '$$this', find: ' ', replacement: '' } } }] }
              }
            }
          }
        },
        {
          $match: {
            // 기본 필터 조건들
            ...(filterBy === 'verified' && { isVerified: true }),
            ...(filterBy === 'unverified' && { isVerified: false }),
            ...(songId && { songId }),
            ...(addedBy && { addedByName: { $regex: `^${addedBy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } }),
            // 검색 조건
            $or: [
              { searchableTitle: { $regex: searchPattern, $options: 'i' } },
              { searchableArtist: { $regex: searchPattern, $options: 'i' } },
              { searchableAddedBy: { $regex: searchPattern, $options: 'i' } },
              { searchableDescription: { $regex: searchPattern, $options: 'i' } },
              { searchableTitleAlias: { $regex: searchPattern, $options: 'i' } },
              { searchableArtistAlias: { $regex: searchPattern, $options: 'i' } },
              { searchableTags: { $regex: searchPattern, $options: 'i' } }
            ]
          }
        },
        { $sort: sortConditions },
        { $skip: skip },
        { $limit: limit }
      ]

      clips = await SongVideo.aggregate(aggregationPipeline)
      
      // 검색 결과의 총 개수 계산
      const countPipeline = aggregationPipeline.slice(0, -2) // skip과 limit 제외
      countPipeline.push({ $count: 'total' })
      const countResult = await SongVideo.aggregate(countPipeline)
      totalCount = countResult.length > 0 ? countResult[0].total : 0
    } else {
      // 일반 조회
      const [clipsResult, countResult] = await Promise.all([
        SongVideo.find(matchConditions)
          .sort(sortConditions)
          .skip(skip)
          .limit(limit)
          .lean(),
        SongVideo.countDocuments(matchConditions)
      ])
      clips = clipsResult
      totalCount = countResult
    }

    // 각 클립의 곡 정보도 함께 조회 (검색이 아닌 경우만)
    const clipsWithSongInfo = search ? clips.map(clip => ({
      ...clip,
      songDetail: clip.songDetail ? {
        _id: clip.songDetail._id,
        title: clip.songDetail.title,
        artist: clip.songDetail.artist,
        titleAlias: clip.songDetail.titleAlias,
        artistAlias: clip.songDetail.artistAlias,
        language: clip.songDetail.language,
        sungCount: clip.songDetail.sungCount
      } : null
    })) : await Promise.all(
      clips.map(async (clip) => {
        const songDetail = await SongDetail.findById(clip.songId).lean()
        return {
          ...clip,
          songDetail: songDetail ? {
            _id: songDetail._id,
            title: songDetail.title,
            artist: songDetail.artist,
            titleAlias: songDetail.titleAlias,
            artistAlias: songDetail.artistAlias,
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
        {
          $lookup: {
            from: 'songdetails',
            localField: 'songId',
            foreignField: '_id',
            as: 'songDetail'
          }
        },
        {
          $addFields: {
            songDetail: { $arrayElemAt: ['$songDetail', 0] }
          }
        },
        { 
          $group: { 
            _id: { 
              songId: '$songId', 
              title: '$title', 
              artist: '$artist',
              titleAlias: '$songDetail.titleAlias',
              artistAlias: '$songDetail.artistAlias'
            }, 
            count: { $sum: 1 } 
          } 
        },
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
          titleAlias: s._id.titleAlias,
          artistAlias: s._id.artistAlias,
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

    await connectToDatabase()

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
      case 'updateUrl':
        if (!data.videoUrl) {
          return NextResponse.json({ error: 'videoUrl is required' }, { status: 400 })
        }
        
        // 유튜브 URL 검증
        if (!validateYouTubeUrl(data.videoUrl)) {
          return NextResponse.json({ error: 'Invalid YouTube URL' }, { status: 400 })
        }
        
        // videoUrl이 변경되면 videoId와 thumbnailUrl도 함께 업데이트
        const videoData = updateVideoData(data.videoUrl)
        if (videoData) {
          updateData.videoUrl = data.videoUrl
          updateData.videoId = videoData.videoId
          updateData.thumbnailUrl = videoData.thumbnailUrl
        } else {
          return NextResponse.json({ error: 'Failed to extract video data' }, { status: 400 })
        }
        break
      case 'updateClip':
        // 전체 클립 정보 업데이트
        if (data.videoUrl) {
          // 유튜브 URL 검증
          if (!validateYouTubeUrl(data.videoUrl)) {
            return NextResponse.json({ error: 'Invalid YouTube URL' }, { status: 400 })
          }
          
          // videoUrl이 변경되면 videoId와 thumbnailUrl도 함께 업데이트
          const videoData = updateVideoData(data.videoUrl)
          if (videoData) {
            updateData.videoUrl = data.videoUrl
            updateData.videoId = videoData.videoId
            updateData.thumbnailUrl = videoData.thumbnailUrl
          } else {
            return NextResponse.json({ error: 'Failed to extract video data' }, { status: 400 })
          }
        }
        
        if (data.startTime !== undefined) updateData.startTime = data.startTime
        if (data.endTime !== undefined) updateData.endTime = data.endTime
        if (data.description !== undefined) updateData.description = data.description
        break
      case 'bulkUpdateDuration':
        // 같은 곡의 모든 클립들에게 길이 일괄 적용
        const { songId, duration, excludeVideoId } = data;
        
        if (!songId || !duration || duration <= 0) {
          return NextResponse.json(
            { error: 'songId와 올바른 duration이 필요합니다.' },
            { status: 400 }
          );
        }

        // 같은 곡의 모든 클립들을 찾기 (현재 편집 중인 클립은 제외)
        const clipsToUpdate = await SongVideo.find({
          songId: songId,
          ...(excludeVideoId && { _id: { $ne: excludeVideoId } })
        });

        if (clipsToUpdate.length === 0) {
          return NextResponse.json({
            success: true,
            message: '업데이트할 클립이 없습니다.',
            updatedCount: 0
          });
        }

        // 각 클립의 종료시간을 (시작시간 + 새로운 길이)로 업데이트
        const updatePromises = clipsToUpdate.map(clip => 
          SongVideo.findByIdAndUpdate(clip._id, {
            $set: {
              endTime: (clip.startTime || 0) + duration
            }
          })
        );

        await Promise.all(updatePromises);

        return NextResponse.json({
          success: true,
          message: `${clipsToUpdate.length}개의 클립에 길이가 적용되었습니다.`,
          updatedCount: clipsToUpdate.length
        });
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

    await connectToDatabase()

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