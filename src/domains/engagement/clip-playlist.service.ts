import mongoose from 'mongoose'
import { generateShortId } from '@/shared/utils/short-id'
import ClipPlaylist from './clip-playlist.schema'
import SongVideo from '@/domains/archive/schemas/song-video.schema'
import User from '@/models/User'
import { AppError, NotFoundError, ConflictError, ValidationError } from '@/shared/api/errors'

/**
 * 클립 플레이리스트 유스케이스. SongVideo(클립)는 title/artist를 비정규화로 보유하므로
 * clips.clipId만 populate하면 표시에 필요한 필드가 모두 채워진다.
 */

// 표시용으로 노출할 클립(SongVideo) 필드
const CLIP_FIELDS =
  'songId title artist platform videoUrl videoId sungDate startTime endTime thumbnailUrl description sourceUnavailable likeCount'

export interface ClipPlaylistInput {
  name: string
  description?: string
  coverImage?: string | null
  tags?: string[]
  isPublic?: boolean
}

const normalizeTags = (tags: unknown): string[] =>
  Array.isArray(tags) ? tags.filter((t) => typeof t === 'string' && t.trim()).map((t) => t.trim()) : []

/** 소유권을 확인하며 클립 플레이리스트를 가져온다. */
async function requireOwned(channelId: string, playlistId: string) {
  const playlist = await ClipPlaylist.findOne({ _id: playlistId, channelId })
  if (!playlist) throw new NotFoundError('클립 플레이리스트를 찾을 수 없습니다.')
  return playlist
}

async function assertNameAvailable(channelId: string, name: string, excludeId?: string) {
  const query: Record<string, unknown> = { channelId, name }
  if (excludeId) query._id = { $ne: excludeId }
  if (await ClipPlaylist.findOne(query)) {
    throw new ConflictError('같은 이름의 클립 플레이리스트가 이미 있습니다.')
  }
}

/** 사용자의 모든 클립 플레이리스트 (소유자 화면용 — 공유 정보 포함) */
export async function listClipPlaylists(channelId: string) {
  return ClipPlaylist.find({ channelId })
    .populate('clips.clipId', CLIP_FIELDS)
    .sort({ updatedAt: -1 })
}

export async function createClipPlaylist(channelId: string, input: ClipPlaylistInput) {
  const user = await User.findOne({ channelId })
  if (!user) throw new NotFoundError('사용자를 찾을 수 없습니다.')

  const name = input.name.trim()
  await assertNameAvailable(channelId, name)

  const playlist = await new ClipPlaylist({
    userId: user._id,
    channelId,
    name,
    description: input.description?.trim() || '',
    coverImage: input.coverImage || null,
    tags: normalizeTags(input.tags),
    clips: [],
    isPublic: false,
  }).save()

  return ClipPlaylist.findById(playlist._id).populate('clips.clipId', CLIP_FIELDS)
}

export async function getClipPlaylist(channelId: string, playlistId: string) {
  const playlist = await ClipPlaylist.findOne({ _id: playlistId, channelId }).populate('clips.clipId', CLIP_FIELDS)
  if (!playlist) throw new NotFoundError('클립 플레이리스트를 찾을 수 없습니다.')
  return playlist
}

/** 부분 업데이트. 전달된 필드만 반영한다. */
export async function updateClipPlaylist(
  channelId: string,
  playlistId: string,
  updates: Partial<ClipPlaylistInput>,
) {
  const playlist = await requireOwned(channelId, playlistId)

  if (updates.name?.trim() && updates.name.trim() !== playlist.name) {
    await assertNameAvailable(channelId, updates.name.trim(), playlistId)
    playlist.name = updates.name.trim()
  }
  if (typeof updates.description === 'string') playlist.description = updates.description.trim()
  if (updates.coverImage !== undefined) playlist.coverImage = updates.coverImage || undefined
  if (updates.tags !== undefined) playlist.tags = normalizeTags(updates.tags)
  if (typeof updates.isPublic === 'boolean') playlist.isPublic = updates.isPublic

  await playlist.save()
  return playlist
}

export async function deleteClipPlaylist(channelId: string, playlistId: string) {
  const result = await ClipPlaylist.findOneAndDelete({ _id: playlistId, channelId })
  if (!result) throw new NotFoundError('클립 플레이리스트를 찾을 수 없습니다.')
}

/** 클립 추가. 존재하는 SongVideo만 담을 수 있다. */
export async function addClipToPlaylist(channelId: string, playlistId: string, clipId: string) {
  const playlist = await requireOwned(channelId, playlistId)

  const clip = await SongVideo.findById(clipId)
  if (!clip) throw new NotFoundError('클립을 찾을 수 없습니다.')

  if (playlist.clips.some((c: { clipId: mongoose.Types.ObjectId }) => c.clipId.toString() === clipId)) {
    throw new ConflictError('이미 플레이리스트에 있는 클립입니다.')
  }

  const newOrder = playlist.clips.length > 0
    ? Math.max(...playlist.clips.map((c: { order: number }) => c.order)) + 1
    : 1

  playlist.clips.push({
    clipId: new mongoose.Types.ObjectId(clipId),
    addedAt: new Date(),
    order: newOrder,
  })
  await playlist.save()

  const updated = await ClipPlaylist.findById(playlistId).populate('clips.clipId', CLIP_FIELDS)
  return { playlist: updated, addedClipId: clipId }
}

export async function removeClipFromPlaylist(channelId: string, playlistId: string, clipId: string) {
  const playlist = await requireOwned(channelId, playlistId)

  const index = playlist.clips.findIndex(
    (c: { clipId: mongoose.Types.ObjectId }) => c.clipId.toString() === clipId,
  )
  if (index === -1) throw new NotFoundError('플레이리스트에 없는 클립입니다.')

  playlist.clips.splice(index, 1)
  playlist.clips.forEach((c: { order: number }, i: number) => {
    c.order = i + 1
  })
  await playlist.save()

  return ClipPlaylist.findById(playlistId).populate('clips.clipId', CLIP_FIELDS)
}

/** 클립 순서 전체 교체. 전달 순서대로 order를 다시 매긴다. */
export async function reorderClips(
  channelId: string,
  playlistId: string,
  clips: Array<{ clipId: string }>,
) {
  const playlist = await requireOwned(channelId, playlistId)

  playlist.clips = clips.map((c, index) => {
    const existing = playlist.clips.find(
      (e: { clipId: mongoose.Types.ObjectId }) => e.clipId.toString() === c.clipId,
    )
    return {
      clipId: new mongoose.Types.ObjectId(c.clipId),
      addedAt: existing?.addedAt || new Date(),
      order: index + 1,
    }
  })
  await playlist.save()

  return ClipPlaylist.findById(playlistId).populate('clips.clipId', CLIP_FIELDS)
}

/** 공유 링크 재생성 (이전 링크는 히스토리에 보관). */
export async function regenerateShareId(channelId: string, playlistId: string) {
  const playlist = await requireOwned(channelId, playlistId)

  playlist.shareHistory.push({
    shareId: playlist.shareId,
    createdAt: playlist.createdAt,
    revokedAt: new Date(),
  })
  playlist.shareId = generateShortId()
  await playlist.save()

  return playlist
}

export interface ShareSettingsInput {
  isPublic?: boolean
  shareSettings?: {
    allowCopy?: boolean
    requireLogin?: boolean
    expiresAt?: string | null
  }
}

/** 공개 여부/공유 정책 업데이트. */
export async function updateShareSettings(channelId: string, playlistId: string, input: ShareSettingsInput) {
  const playlist = await requireOwned(channelId, playlistId)

  if (typeof input.isPublic === 'boolean') playlist.isPublic = input.isPublic

  if (input.shareSettings) {
    const s = input.shareSettings
    playlist.shareSettings = {
      allowCopy: s.allowCopy !== undefined ? s.allowCopy : playlist.shareSettings.allowCopy,
      requireLogin: s.requireLogin !== undefined ? s.requireLogin : playlist.shareSettings.requireLogin,
      expiresAt: s.expiresAt ? new Date(s.expiresAt) : undefined,
    }
  }
  await playlist.save()
  return playlist
}

/**
 * 공유 링크로 클립 플레이리스트 조회. 공개 여부/만료/로그인 요구 정책을 검사하고
 * 소유자 여부에 따라 노출 필드와 권한을 구성한다.
 */
export async function getSharedClipPlaylist(shareId: string, viewerChannelId: string | null) {
  if (!shareId) throw new ValidationError('공유 ID가 필요합니다.')

  const playlist = await ClipPlaylist.findOne({ shareId }).populate('clips.clipId', CLIP_FIELDS).exec()
  if (!playlist) throw new NotFoundError('클립 플레이리스트를 찾을 수 없습니다.')

  const isOwner = !!viewerChannelId && viewerChannelId === playlist.channelId

  if (!playlist.isPublic && !isOwner) {
    throw new AppError('PRIVATE', '비공개 클립 플레이리스트입니다.', 403)
  }
  if (playlist.shareSettings.expiresAt && new Date() > playlist.shareSettings.expiresAt) {
    throw new AppError('EXPIRED', '만료된 공유 링크입니다.', 410)
  }
  if (playlist.shareSettings.requireLogin && !viewerChannelId) {
    throw new AppError('LOGIN_REQUIRED', '로그인이 필요한 클립 플레이리스트입니다.', 401)
  }

  return {
    playlist: {
      _id: playlist._id,
      name: playlist.name,
      description: playlist.description,
      coverImage: playlist.coverImage,
      tags: playlist.tags,
      clips: (playlist.clips as unknown[]).map((raw) => {
        const item = raw as {
          toObject: () => object
          clipId: { toObject: () => object; _id: unknown } | null
        }
        return {
          ...item.toObject(),
          clipId: item.clipId
            ? { ...item.clipId.toObject(), id: String(item.clipId._id) }
            : null,
        }
      }),
      clipCount: playlist.clips.length,
      createdAt: playlist.createdAt,
      updatedAt: playlist.updatedAt,
      ...(isOwner && {
        shareId: playlist.shareId,
        isPublic: playlist.isPublic,
        shareSettings: playlist.shareSettings,
        shareHistory: playlist.shareHistory,
      }),
    },
    isOwner,
    permissions: {
      canEdit: isOwner,
      canDelete: isOwner,
      canShare: isOwner,
      canCopy: playlist.shareSettings.allowCopy || isOwner,
    },
  }
}
