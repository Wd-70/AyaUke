import mongoose from 'mongoose';
import Playlist from './playlist.schema';
import User from '@/models/User';
import SongDetail from '@/domains/catalog/song.schema';
import { AppError, NotFoundError, ConflictError } from '@/shared/api/errors';

const SONG_POPULATE = ['songs.songId', 'title artist language'] as const;

export interface PlaylistInput {
  name: string;
  description?: string;
  coverImage?: string | null;
  tags?: string[];
  isPublic?: boolean;
}

const normalizeTags = (tags: unknown): string[] =>
  Array.isArray(tags) ? tags.filter((t) => typeof t === 'string' && t.trim()).map((t) => t.trim()) : [];

/** 소유권을 확인하며 플레이리스트를 가져온다. */
async function requireOwnedPlaylist(channelId: string, playlistId: string) {
  const playlist = await Playlist.findOne({ _id: playlistId, channelId });
  if (!playlist) throw new NotFoundError('플레이리스트를 찾을 수 없습니다.');
  return playlist;
}

async function assertNameAvailable(channelId: string, name: string, excludeId?: string) {
  const query: Record<string, unknown> = { channelId, name };
  if (excludeId) query._id = { $ne: excludeId };
  if (await Playlist.findOne(query)) {
    throw new ConflictError('같은 이름의 플레이리스트가 이미 있습니다.');
  }
}

/** 사용자의 모든 플레이리스트 (소유자 화면용 — 공유 정보 포함) */
export async function listPlaylists(channelId: string) {
  return Playlist.find({ channelId })
    .populate(...SONG_POPULATE)
    .sort({ updatedAt: -1 })
    .select('+shareId +isPublic +shareSettings');
}

export async function createPlaylist(channelId: string, input: PlaylistInput) {
  const user = await User.findOne({ channelId });
  if (!user) throw new NotFoundError('사용자를 찾을 수 없습니다.');

  const name = input.name.trim();
  await assertNameAvailable(channelId, name);

  const playlist = await new Playlist({
    userId: user._id,
    channelId,
    name,
    description: input.description?.trim() || '',
    coverImage: input.coverImage || null,
    tags: normalizeTags(input.tags),
    songs: [],
    isPublic: false,
  }).save();

  return Playlist.findById(playlist._id)
    .populate(...SONG_POPULATE)
    .select('+shareId +isPublic +shareSettings');
}

export async function getPlaylist(channelId: string, playlistId: string) {
  const playlist = await Playlist.findOne({ _id: playlistId, channelId }).populate(...SONG_POPULATE);
  if (!playlist) throw new NotFoundError('플레이리스트를 찾을 수 없습니다.');
  return playlist;
}

/** 부분 업데이트. 전달된 필드만 반영한다. */
export async function updatePlaylist(
  channelId: string,
  playlistId: string,
  updates: Partial<PlaylistInput>,
) {
  const playlist = await requireOwnedPlaylist(channelId, playlistId);

  if (updates.name?.trim() && updates.name.trim() !== playlist.name) {
    await assertNameAvailable(channelId, updates.name.trim(), playlistId);
    playlist.name = updates.name.trim();
  }
  if (typeof updates.description === 'string') playlist.description = updates.description.trim();
  if (updates.coverImage !== undefined) playlist.coverImage = updates.coverImage || null;
  if (updates.tags !== undefined) playlist.tags = normalizeTags(updates.tags);
  if (typeof updates.isPublic === 'boolean') playlist.isPublic = updates.isPublic;

  await playlist.save();
  return playlist;
}

export async function deletePlaylist(channelId: string, playlistId: string) {
  const result = await Playlist.findOneAndDelete({ _id: playlistId, channelId });
  if (!result) throw new NotFoundError('플레이리스트를 찾을 수 없습니다.');
}

/**
 * 곡 추가. SongDetail에 없는 곡(구글시트 전용)은 자리표시자 문서를 만들어 참조를 유지한다.
 */
export async function addSongToPlaylist(channelId: string, playlistId: string, songId: string) {
  const playlist = await requireOwnedPlaylist(channelId, playlistId);

  let song = await SongDetail.findById(songId);
  if (!song) {
    song = await new SongDetail({
      _id: new mongoose.Types.ObjectId(songId),
      title: 'Unknown Title',
      artist: 'Unknown Artist',
      language: 'Unknown',
    }).save();
  }

  if (playlist.songs.some((s: { songId: mongoose.Types.ObjectId }) => s.songId.toString() === songId)) {
    throw new ConflictError('이미 플레이리스트에 있는 곡입니다.');
  }

  const newOrder = playlist.songs.length > 0
    ? Math.max(...playlist.songs.map((s: { order: number }) => s.order)) + 1
    : 1;

  playlist.songs.push({
    songId: new mongoose.Types.ObjectId(songId),
    addedAt: new Date(),
    order: newOrder,
  });
  await playlist.save();

  const updated = await Playlist.findById(playlistId);
  return { playlist: updated, addedSong: song };
}

export async function removeSongFromPlaylist(channelId: string, playlistId: string, songId: string) {
  const playlist = await requireOwnedPlaylist(channelId, playlistId);

  const index = playlist.songs.findIndex(
    (s: { songId: mongoose.Types.ObjectId }) => s.songId.toString() === songId,
  );
  if (index === -1) throw new NotFoundError('플레이리스트에 없는 곡입니다.');

  playlist.songs.splice(index, 1);
  playlist.songs.forEach((s: { order: number }, i: number) => {
    s.order = i + 1;
  });
  await playlist.save();

  return Playlist.findById(playlistId).populate(...SONG_POPULATE);
}

/**
 * 공유 링크로 플레이리스트 조회. 공개 여부/만료/로그인 요구 정책을 검사하고
 * 소유자 여부에 따라 노출 필드와 권한을 구성한다.
 */
export async function getSharedPlaylist(shareId: string, viewerChannelId: string | null) {
  const playlist = await Playlist.findOne({ shareId }).populate('songs.songId').exec();
  if (!playlist) throw new NotFoundError('플레이리스트를 찾을 수 없습니다.');

  const isOwner = !!viewerChannelId && viewerChannelId === playlist.channelId;

  if (!playlist.isPublic && !isOwner) {
    throw new AppError('PRIVATE', '비공개 플레이리스트입니다.', 403);
  }
  if (playlist.shareSettings.expiresAt && new Date() > playlist.shareSettings.expiresAt) {
    throw new AppError('EXPIRED', '만료된 공유 링크입니다.', 410);
  }
  if (playlist.shareSettings.requireLogin && !viewerChannelId) {
    throw new AppError('LOGIN_REQUIRED', '로그인이 필요한 플레이리스트입니다.', 401);
  }

  return {
    playlist: {
      _id: playlist._id,
      name: playlist.name,
      description: playlist.description,
      coverImage: playlist.coverImage,
      tags: playlist.tags,
      songs: playlist.songs.map((item: { toObject: () => object; songId: { toObject: () => object; _id: unknown } }) => ({
        ...item.toObject(),
        songId: {
          ...item.songId.toObject(),
          id: String(item.songId._id),
        },
      })),
      songCount: playlist.songs.length,
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
  };
}

/** 곡 순서 전체 교체. 전달 순서대로 order를 다시 매긴다. */
export async function reorderPlaylistSongs(
  channelId: string,
  playlistId: string,
  songs: Array<{ songId: string }>,
) {
  const playlist = await requireOwnedPlaylist(channelId, playlistId);

  playlist.songs = songs.map((songData, index) => {
    const existing = playlist.songs.find(
      (s: { songId: mongoose.Types.ObjectId }) => s.songId.toString() === songData.songId,
    );
    return {
      songId: new mongoose.Types.ObjectId(songData.songId),
      addedAt: existing?.addedAt || new Date(),
      order: index + 1,
    };
  });
  await playlist.save();

  return Playlist.findById(playlistId).populate(...SONG_POPULATE);
}
