import mongoose from 'mongoose';
import SongDetailModel from '@/domains/catalog/song.schema';
import { withApi, ok } from '@/shared/api/handler';
import { Permission } from '@/lib/permissions';
import { ValidationError, NotFoundError, ConflictError } from '@/shared/api/errors';

function assertValidId(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ValidationError('유효하지 않은 ID입니다.');
  }
}

export const GET = withApi({}, async ({ params }) => {
  assertValidId(params.id);

  const song = await SongDetailModel.findById(params.id).lean();
  if (!song) throw new NotFoundError('곡을 찾을 수 없습니다.');

  return ok({ song });
});

export const PUT = withApi({ auth: Permission.SONGS_EDIT }, async ({ req, params }) => {
  assertValidId(params.id);
  const data = await req.json();

  try {
    const song = await SongDetailModel.findByIdAndUpdate(params.id, data, {
      new: true,
      runValidators: true,
      lean: true,
    });
    if (!song) throw new NotFoundError('곡을 찾을 수 없습니다.');
    return ok({ song });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
      throw new ConflictError('이미 존재하는 곡 제목입니다.');
    }
    throw error;
  }
});

export const DELETE = withApi({ auth: Permission.SONGS_EDIT }, async ({ params }) => {
  assertValidId(params.id);

  const deleted = await SongDetailModel.findByIdAndDelete(params.id);
  if (!deleted) throw new NotFoundError('곡을 찾을 수 없습니다.');

  return ok({ deletedId: params.id });
});
