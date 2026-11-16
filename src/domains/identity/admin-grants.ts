import { z } from 'zod';
import { ADMIN_SCOPES, isSuperAdmin, type PermissionSubject } from '@/lib/permissions';
export const AdminUserUpdate = z.object({
  displayName: z.string().trim().max(100).optional(),
  profileImageUrl: z.string().max(2000).optional(),
  adminScopes: z.array(z.enum(ADMIN_SCOPES)).max(4).refine(v => new Set(v).size === v.length).optional(),
}).strict();
export function canChangeGrants(actor: PermissionSubject, target: PermissionSubject): boolean {
  return isSuperAdmin(actor) && !isSuperAdmin(target);
}
