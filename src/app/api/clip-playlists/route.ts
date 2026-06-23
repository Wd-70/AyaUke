import { z } from 'zod'
import { NextResponse } from 'next/server'
import { withApi } from '@/shared/api/handler'
import * as clipPlaylistService from '@/domains/engagement/clip-playlist.service'

const CreateBody = z.object({
  name: z.string().trim().min(1, '클립 플레이리스트 이름이 필요합니다.').max(100),
  description: z.string().max(500).optional(),
  coverImage: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
})

export const GET = withApi({ auth: 'user' }, async ({ session }) => {
  const playlists = await clipPlaylistService.listClipPlaylists(session!.user.channelId)
  return NextResponse.json({ playlists })
})

export const POST = withApi({ schema: CreateBody, auth: 'user' }, async ({ input, session }) => {
  const playlist = await clipPlaylistService.createClipPlaylist(session!.user.channelId, input)
  return NextResponse.json({ success: true, playlist }, { status: 201 })
})
