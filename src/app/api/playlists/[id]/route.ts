import { z } from 'zod';
import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { withApi } from '@/shared/api/handler';
import { ValidationError } from '@/shared/api/errors';
import * as playlistService from '@/domains/engagement/playlist.service';

const UpdateBody = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  coverImage: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  isPublic: z.boolean().optional(),
});

function assertValidId(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ValidationError('유효하지 않은 플레이리스트 ID입니다.');
  }
}

// NOTE: 성공 응답은 기존 훅 호환을 위해 레거시 형태 유지 (Phase 5에서 envelope로 전환)
export const GET = withApi({ auth: 'user' }, async ({ session, params }) => {
  assertValidId(params.id);
  const playlist = await playlistService.getPlaylist(session!.user.channelId, params.id);
  return NextResponse.json({ playlist });
});

// PUT/PATCH 모두 부분 업데이트로 동작한다 (기존 PUT도 name 외 필드는 선택이었음)
const update = withApi({ schema: UpdateBody, auth: 'user' }, async ({ input, session, params }) => {
  assertValidId(params.id);
  const playlist = await playlistService.updatePlaylist(session!.user.channelId, params.id, input);
  return NextResponse.json({ success: true, playlist });
});

export const PUT = update;
export const PATCH = update;

export const DELETE = withApi({ auth: 'user' }, async ({ session, params }) => {
  assertValidId(params.id);
  await playlistService.deletePlaylist(session!.user.channelId, params.id);
  return NextResponse.json({ success: true });
});
