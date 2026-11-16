import { revalidatePath } from 'next/cache';
import { withApi, ok } from '@/shared/api/handler';
import { Permission, hasPermission } from '@/lib/permissions';
import { ForbiddenError } from '@/shared/api/errors';
import { SongChange } from '@/domains/catalog/song-workspace';
import { songLibraryDetail, changeLibrarySong } from '@/domains/catalog/song-workspace.service';
export const dynamic = 'force-dynamic';
export const GET = withApi({ auth: Permission.SONGS_VIEW }, async ({ params }) => ok(await songLibraryDetail(params.id, false), { headers: { 'Cache-Control': 'private, no-store' } }));
export const PATCH = withApi({ auth: Permission.SONGS_EDIT, schema: SongChange }, async ({ params, input, session }) => {
  if (input.action !== 'edit' && !hasPermission(session!.user, Permission.SONGS_DELETE)) throw new ForbiddenError();
  const song = await changeLibrarySong(params.id, input, session!.user.channelId, false);
  revalidatePath('/songbook');
  return ok(song);
});
