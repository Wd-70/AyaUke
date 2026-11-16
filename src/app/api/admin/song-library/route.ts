import { revalidatePath } from 'next/cache';
import { withApi, ok } from '@/shared/api/handler';
import { Permission } from '@/lib/permissions';
import { SongCreate } from '@/domains/catalog/song-workspace';
import { songLibrary, createLibrarySong } from '@/domains/catalog/song-workspace.service';
export const dynamic = 'force-dynamic';
export const GET = withApi({ auth: Permission.SONGS_VIEW }, async ({ req }) => ok(await songLibrary(req.nextUrl.searchParams.get('fresh') === '1' ? 'fresh' : true), { headers: { 'Cache-Control': 'private, no-store' } }));
export const POST = withApi({ auth: Permission.SONGS_CREATE, schema: SongCreate }, async ({ input }) => {
  const song = await createLibrarySong(input, false);
  revalidatePath('/songbook');
  return ok(song, { status: 201 });
});
