import { z } from 'zod';
import { NextResponse } from 'next/server';
import { withApi } from '@/shared/api/handler';
import { ForbiddenError, ValidationError } from '@/shared/api/errors';
import { hasPermission, Permission, UserRole } from '@/lib/permissions';
import * as songAdmin from '@/domains/catalog/song-admin.service';

// NOTE: 성공 응답은 기존 관리 화면 호환을 위해 레거시 형태 유지 (Phase 4 재설계 시 envelope로 전환)
export const GET = withApi({ auth: Permission.SONGS_VIEW }, async () => {
  const { songs, stats } = await songAdmin.listSongsForAdmin();
  return NextResponse.json({ success: true, songs, stats });
});

const ActionBody = z.object({
  action: z.enum(['bulk-edit', 'add-tags', 'edit-song', 'add-song', 'delete-songs']),
  songIds: z.array(z.string()).optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  songData: z.record(z.string(), z.unknown()).optional(),
});

const ACTION_PERMISSIONS: Record<z.infer<typeof ActionBody>['action'], Permission> = {
  'bulk-edit': Permission.SONGS_EDIT,
  'add-tags': Permission.SONGS_EDIT,
  'edit-song': Permission.SONGS_EDIT,
  'add-song': Permission.SONGS_CREATE,
  'delete-songs': Permission.SONGS_DELETE,
};

export const POST = withApi({ schema: ActionBody, auth: 'user' }, async ({ input, session }) => {
  const role = (session!.user as { role?: string }).role as UserRole;
  if (!hasPermission(role, ACTION_PERMISSIONS[input.action])) {
    throw new ForbiddenError('해당 작업에 대한 권한이 없습니다.');
  }

  const { action, songIds = [], data, songData } = input;

  switch (action) {
    case 'add-song': {
      const song = await songAdmin.addSong(songData as unknown as songAdmin.NewSongInput);
      return NextResponse.json({
        success: true,
        message: `${song.title} 곡이 성공적으로 추가되었습니다.`,
        song,
      });
    }
    case 'bulk-edit': {
      const affectedCount = await songAdmin.bulkEdit(songIds, data as songAdmin.BulkEditInput);
      return NextResponse.json({
        success: true,
        message: `${affectedCount}곡이 일괄 수정되었습니다.`,
        affectedCount,
      });
    }
    case 'edit-song': {
      const affectedCount = await songAdmin.editSong(songIds[0], data as songAdmin.EditSongInput);
      return NextResponse.json({
        success: true,
        message: '곡이 성공적으로 수정되었습니다.',
        affectedCount,
      });
    }
    case 'add-tags': {
      const affectedCount = await songAdmin.addTags(songIds, (data?.tags as string[]) ?? []);
      return NextResponse.json({
        success: true,
        message: `${affectedCount}곡에 태그가 추가되었습니다.`,
        affectedCount,
      });
    }
    case 'delete-songs': {
      const affectedCount = await songAdmin.softDeleteSongs(
        songIds,
        session!.user.channelId,
        data?.reason as string | undefined,
      );
      return NextResponse.json({
        success: true,
        message: `${affectedCount}곡이 삭제되었습니다.`,
        affectedCount,
      });
    }
    default:
      throw new ValidationError('알 수 없는 작업입니다.');
  }
});
