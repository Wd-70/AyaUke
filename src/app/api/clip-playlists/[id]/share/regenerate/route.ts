import { NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { withApi } from '@/shared/api/handler'
import { ValidationError } from '@/shared/api/errors'
import * as clipPlaylistService from '@/domains/engagement/clip-playlist.service'

export const POST = withApi({ auth: 'user' }, async ({ session, params }) => {
  if (!mongoose.Types.ObjectId.isValid(params.id)) {
    throw new ValidationError('유효하지 않은 클립 플레이리스트 ID입니다.')
  }
  const playlist = await clipPlaylistService.regenerateShareId(session!.user.channelId, params.id)
  return NextResponse.json({
    success: true,
    playlist: {
      _id: playlist._id,
      shareId: playlist.shareId,
      shareHistory: playlist.shareHistory,
    },
    newShareUrl: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/clip-playlist/${playlist.shareId}`,
  })
})
