import { revalidatePath } from 'next/cache';
import { withApi, ok } from '@/shared/api/handler';
import { Permission } from '@/lib/permissions';
import { SongBulk } from '@/domains/catalog/song-workspace';
import { bulkLibrarySongs } from '@/domains/catalog/song-workspace.service';
export const POST = withApi({ auth: Permission.SONGS_EDIT, schema: SongBulk }, async ({ input }) => {
  const result = await bulkLibrarySongs(input, true);
  revalidatePath('/songbook');
  return ok(result);
});
