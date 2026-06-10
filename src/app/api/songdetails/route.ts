import { z } from 'zod';
import SongDetailModel from '@/domains/catalog/song.schema';
import { withApi, ok } from '@/shared/api/handler';
import { Permission } from '@/lib/permissions';
import { ConflictError } from '@/shared/api/errors';

const ListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(2000).default(100),
  search: z.string().default(''),
});

export const GET = withApi({ schema: ListQuery, auth: Permission.SONGS_VIEW }, async ({ input }) => {
  const query: Record<string, unknown> = {};
  if (input.search) {
    const regex = { $regex: input.search, $options: 'i' };
    query.$or = [{ title: regex }, { artist: regex }, { titleAlias: regex }, { artistAlias: regex }];
  }

  const skip = (input.page - 1) * input.limit;
  const [songs, totalCount] = await Promise.all([
    SongDetailModel.find(query).sort({ updatedAt: -1 }).skip(skip).limit(input.limit).lean(),
    SongDetailModel.countDocuments(query),
  ]);

  return ok({
    songs,
    totalCount,
    currentPage: input.page,
    totalPages: Math.ceil(totalCount / input.limit),
    hasMore: totalCount > input.page * input.limit,
  });
});

export const POST = withApi({ auth: Permission.SONGS_CREATE }, async ({ req }) => {
  const data = await req.json();
  try {
    const song = await new SongDetailModel(data).save();
    return ok({ song }, { status: 201 });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
      throw new ConflictError('이미 존재하는 곡 제목입니다.');
    }
    throw error;
  }
});
