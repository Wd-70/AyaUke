import { z } from 'zod';
import { NextResponse } from 'next/server';
import { withApi } from '@/shared/api/handler';
import * as playlistService from '@/domains/engagement/playlist.service';

const CreateBody = z.object({
  name: z.string().trim().min(1, '플레이리스트 이름이 필요합니다.').max(100),
  description: z.string().max(500).optional(),
  coverImage: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
});

// NOTE: 성공 응답은 기존 훅 호환을 위해 레거시 형태 유지 (Phase 5에서 envelope로 전환)
export const GET = withApi({ auth: 'user' }, async ({ session }) => {
  const playlists = await playlistService.listPlaylists(session!.user.channelId);
  return NextResponse.json({ playlists });
});

export const POST = withApi({ schema: CreateBody, auth: 'user' }, async ({ input, session }) => {
  const playlist = await playlistService.createPlaylist(session!.user.channelId, input);
  return NextResponse.json({ success: true, playlist }, { status: 201 });
});
