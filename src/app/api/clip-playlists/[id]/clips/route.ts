import { z } from 'zod'
import { NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { withApi } from '@/shared/api/handler'
import { ValidationError } from '@/shared/api/errors'
import * as clipPlaylistService from '@/domains/engagement/clip-playlist.service'

const objectId = z.string().refine((v) => mongoose.Types.ObjectId.isValid(v), '유효하지 않은 클립 ID입니다.')

const AddBody = z.object({ clipId: objectId })
const RemoveQuery = z.object({ clipId: objectId })
const ReorderBody = z.object({ clips: z.array(z.object({ clipId: z.string() })) })

function assertValidId(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ValidationError('유효하지 않은 클립 플레이리스트 ID입니다.')
  }
}

export const POST = withApi({ schema: AddBody, auth: 'user' }, async ({ input, session, params }) => {
  assertValidId(params.id)
  const { playlist, addedClipId } = await clipPlaylistService.addClipToPlaylist(
    session!.user.channelId,
    params.id,
    input.clipId,
  )
  return NextResponse.json({ success: true, playlist, addedClipId })
})

export const DELETE = withApi({ schema: RemoveQuery, auth: 'user' }, async ({ input, session, params }) => {
  assertValidId(params.id)
  const playlist = await clipPlaylistService.removeClipFromPlaylist(
    session!.user.channelId,
    params.id,
    input.clipId,
  )
  return NextResponse.json({ success: true, playlist })
})

export const PUT = withApi({ schema: ReorderBody, auth: 'user' }, async ({ input, session, params }) => {
  assertValidId(params.id)
  const playlist = await clipPlaylistService.reorderClips(
    session!.user.channelId,
    params.id,
    input.clips,
  )
  return NextResponse.json({ success: true, playlist })
})
