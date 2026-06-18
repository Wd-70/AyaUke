import { z } from 'zod'
import { NextResponse } from 'next/server'
import type { Session } from 'next-auth'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import { isSuperAdmin, UserRole } from '@/lib/permissions'
import { connectDB as connectToDatabase } from '@/shared/db/mongodb'
import { withApi, ok } from '@/shared/api/handler'
import { ForbiddenError } from '@/shared/api/errors'
import SongVideo from '@/domains/archive/schemas/song-video.schema'
import { parseVideoUrl } from '@/shared/utils/video-url'
import * as clipService from '@/domains/archive/clip.service'

function assertSuperAdmin(session: Session | null) {
  const role = (session?.user as { role?: string } | undefined)?.role as UserRole | undefined
  if (!role || !isSuperAdmin(role)) {
    throw new ForbiddenError('최고관리자 권한이 필요합니다.')
  }
}

const GetQuery = z.object({
  // 중복검사용 전체 데이터 (TimelineParsingView/TimestampParserTab 업로드가 사용)
  getAllForDuplicateCheck: z.coerce.boolean().default(false),
  view: z.enum(['stats', 'songs', 'clips', 'song-clips']).default('clips'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['recent', 'addedBy', 'songTitle', 'verified', 'sungDate', 'clipCount', 'title']).default('recent'),
  filterBy: z.enum(['all', 'verified', 'unverified', 'unavailable']).default('all'),
  platform: z.enum(['all', 'youtube', 'chzzk']).default('all'),
  search: z.string().default(''),
  addedBy: z.string().default(''),
  songId: z.string().default(''),
  videoId: z.string().default(''),
})

export const GET = withApi({ schema: GetQuery, auth: 'user' }, async ({ input, session }) => {
  assertSuperAdmin(session)

  // 레거시 호환: 업로드 중복검사용 전체 클립 (성공 형태 유지)
  if (input.getAllForDuplicateCheck) {
    const clips = await clipService.getDuplicateCheckData()
    return NextResponse.json({
      success: true,
      clips,
      meta: { totalCount: clips.length },
    })
  }

  switch (input.view) {
    case 'stats':
      return ok(await clipService.getClipStats())

    case 'songs':
      return ok(
        await clipService.listSongsWithClips({
          page: input.page,
          limit: input.limit,
          search: input.search || undefined,
          sortBy: input.sortBy === 'clipCount' || input.sortBy === 'title' ? input.sortBy : 'recent',
        }),
      )

    case 'song-clips': {
      // 특정 곡의 클립 전체 + 곡 정보(기본 길이 포함)
      return ok(await clipService.listClipsForSong(input.songId))
    }

    case 'clips':
    default:
      return ok(
        await clipService.listClips({
          page: input.page,
          limit: input.limit,
          sortBy: input.sortBy === 'clipCount' || input.sortBy === 'title' ? 'recent' : input.sortBy,
          filterBy: input.filterBy,
          platform: input.platform,
          search: input.search || undefined,
          addedBy: input.addedBy || undefined,
          songId: input.songId || undefined,
          videoId: input.videoId || undefined,
        }),
      )
  }
})

// PATCH: 클립 부분 업데이트 (노래책 LiveClipManager의 bulkUpdateDuration 등이 사용)
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !isSuperAdmin(session.user.role as UserRole)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    await connectToDatabase()

    const { clipId, action, data } = await request.json()

    if (!clipId || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    let updateData: Record<string, unknown> = {}

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
      case 'updateClip': {
        if (action === 'updateUrl' && !data.videoUrl) {
          return NextResponse.json({ error: 'videoUrl is required' }, { status: 400 })
        }

        if (data.videoUrl) {
          // 영상 URL 검증 (유튜브/치지직)
          const videoData = parseVideoUrl(data.videoUrl)
          if (!videoData) {
            return NextResponse.json({ error: '올바른 유튜브 또는 치지직 다시보기 URL이 아닙니다.' }, { status: 400 })
          }
          updateData.videoUrl = data.videoUrl
          updateData.platform = videoData.platform
          updateData.videoId = videoData.videoId
          if (videoData.thumbnailUrl) updateData.thumbnailUrl = videoData.thumbnailUrl
        }

        if (action === 'updateClip') {
          if (data.startTime !== undefined) updateData.startTime = data.startTime
          if (data.endTime !== undefined) updateData.endTime = data.endTime
          if (data.description !== undefined) updateData.description = data.description
        }
        break
      }
      case 'bulkUpdateDuration': {
        // 같은 곡의 모든 클립에 길이 일괄 적용 (노래책 편집 UI에서 사용)
        const { songId, duration, excludeVideoId } = data

        if (!songId || !duration || duration <= 0) {
          return NextResponse.json(
            { error: 'songId와 올바른 duration이 필요합니다.' },
            { status: 400 }
          )
        }

        const clipsToUpdate = await SongVideo.find({
          songId,
          ...(excludeVideoId && { _id: { $ne: excludeVideoId } })
        }).select('startTime').lean()

        if (clipsToUpdate.length === 0) {
          return NextResponse.json({ success: true, message: '업데이트할 클립이 없습니다.', updatedCount: 0 })
        }

        await SongVideo.bulkWrite(
          clipsToUpdate.map((clip) => ({
            updateOne: {
              filter: { _id: clip._id },
              update: { $set: { endTime: (clip.startTime || 0) + duration } },
            },
          }))
        )

        return NextResponse.json({
          success: true,
          message: `${clipsToUpdate.length}개의 클립에 길이가 적용되었습니다.`,
          updatedCount: clipsToUpdate.length
        })
      }
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const updatedClip = await SongVideo.findByIdAndUpdate(clipId, updateData, { new: true }).lean()

    if (!updatedClip) {
      return NextResponse.json({ error: 'Clip not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, clip: updatedClip })
  } catch (error) {
    console.error('Clips update error:', error)
    return NextResponse.json({ error: 'Failed to update clip' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
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
    return NextResponse.json({ error: 'Failed to delete clip' }, { status: 500 })
  }
}
