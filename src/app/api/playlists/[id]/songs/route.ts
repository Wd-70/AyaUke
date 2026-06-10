import { z } from 'zod';
import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { withApi } from '@/shared/api/handler';
import { ValidationError } from '@/shared/api/errors';
import * as playlistService from '@/domains/engagement/playlist.service';

const objectId = z.string().refine((v) => mongoose.Types.ObjectId.isValid(v), '유효하지 않은 곡 ID입니다.');

const AddBody = z.object({ songId: objectId });
const RemoveQuery = z.object({ songId: objectId });
const ReorderBody = z.object({ songs: z.array(z.object({ songId: z.string() })) });

function assertValidId(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ValidationError('유효하지 않은 플레이리스트 ID입니다.');
  }
}

// NOTE: 성공 응답은 기존 훅 호환을 위해 레거시 형태 유지 (Phase 5에서 envelope로 전환)
export const POST = withApi({ schema: AddBody, auth: 'user' }, async ({ input, session, params }) => {
  assertValidId(params.id);
  const { playlist, addedSong } = await playlistService.addSongToPlaylist(
    session!.user.channelId,
    params.id,
    input.songId,
  );
  return NextResponse.json({ success: true, playlist, addedSong });
});

export const DELETE = withApi({ schema: RemoveQuery, auth: 'user' }, async ({ input, session, params }) => {
  assertValidId(params.id);
  const playlist = await playlistService.removeSongFromPlaylist(
    session!.user.channelId,
    params.id,
    input.songId,
  );
  return NextResponse.json({ success: true, playlist });
});

export const PUT = withApi({ schema: ReorderBody, auth: 'user' }, async ({ input, session, params }) => {
  assertValidId(params.id);
  const playlist = await playlistService.reorderPlaylistSongs(
    session!.user.channelId,
    params.id,
    input.songs,
  );
  return NextResponse.json({ success: true, playlist });
});
