import { z } from 'zod'
import { NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { withApi } from '@/shared/api/handler'
import { ValidationError } from '@/shared/api/errors'
import * as clipPlaylistService from '@/domains/engagement/clip-playlist.service'

const Body = z.object({
  isPublic: z.boolean().optional(),
  shareSettings: z.object({
    allowCopy: z.boolean().optional(),
    requireLogin: z.boolean().optional(),
    expiresAt: z.string().nullable().optional(),
  }).optional(),
})

export const PUT = withApi({ schema: Body, auth: 'user' }, async ({ input, session, params }) => {
  if (!mongoose.Types.ObjectId.isValid(params.id)) {
    throw new ValidationError('유효하지 않은 클립 플레이리스트 ID입니다.')
  }
  const playlist = await clipPlaylistService.updateShareSettings(session!.user.channelId, params.id, input)
  return NextResponse.json({
    success: true,
    playlist: {
      _id: playlist._id,
      isPublic: playlist.isPublic,
      shareSettings: playlist.shareSettings,
    },
  })
})
