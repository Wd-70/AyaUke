import { withApi, ok } from '@/shared/api/handler';
import { Permission } from '@/lib/permissions';
import { songLibraryStats } from '@/domains/catalog/song-workspace.service';
export const dynamic = 'force-dynamic';
export const GET = withApi({ auth: Permission.SONGS_VIEW }, async ({ params }) => ok(await songLibraryStats(params.id), { headers: { 'Cache-Control': 'private, no-store' } }));
