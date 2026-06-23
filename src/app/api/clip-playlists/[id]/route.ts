import { z } from 'zod'
import { NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { withApi } from '@/shared/api/handler'
import { ValidationError } from '@/shared/api/errors'
import * as clipPlaylistService from '@/domains/engagement/clip-playlist.service'

const UpdateBody = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  coverImage: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  isPublic: z.boolean().optional(),
})

function assertValidId(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ValidationError('유효하지 않은 클립 플레이리스트 ID입니다.')
  }
}

export const GET = withApi({ auth: 'user' }, async ({ session, params }) => {
  assertValidId(params.id)
  const playlist = await clipPlaylistService.getClipPlaylist(session!.user.channelId, params.id)
  return NextResponse.json({ playlist })
})

const update = withApi({ schema: UpdateBody, auth: 'user' }, async ({ input, session, params }) => {
  assertValidId(params.id)
  const playlist = await clipPlaylistService.updateClipPlaylist(session!.user.channelId, params.id, input)
  return NextResponse.json({ success: true, playlist })
})

export const PUT = update
export const PATCH = update

export const DELETE = withApi({ auth: 'user' }, async ({ session, params }) => {
  assertValidId(params.id)
  await clipPlaylistService.deleteClipPlaylist(session!.user.channelId, params.id)
  return NextResponse.json({ success: true })
})
