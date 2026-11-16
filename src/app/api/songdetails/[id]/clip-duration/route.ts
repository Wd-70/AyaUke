import { z } from 'zod';
import mongoose from 'mongoose';
import SongDetail from '@/domains/catalog/song.schema';
import { withApi, ok } from '@/shared/api/handler';
import { Permission } from '@/lib/permissions';
import { ValidationError, NotFoundError } from '@/shared/api/errors';

// Clip managers may change the duration default, never arbitrary song metadata.
const Body = z.object({ clipDuration: z.number().finite().positive().max(86400).nullable() }).strict();
export const PUT = withApi({ auth: Permission.CLIPS_MANAGE, schema: Body }, async ({ params, input }) => {
  if (!mongoose.Types.ObjectId.isValid(params.id)) throw new ValidationError('유효하지 않은 ID입니다.');
  const song = await SongDetail.findByIdAndUpdate(params.id, { $set: input }, { new: true, runValidators: true, lean: true });
  if (!song) throw new NotFoundError('곡을 찾을 수 없습니다.');
  return ok({ song });
});
