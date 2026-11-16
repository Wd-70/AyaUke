import { beforeEach, describe, expect, it, vi } from 'vitest';
import User from '@/models/User';
import { authOptions } from './authOptions';
vi.mock('@/shared/db/mongodb', () => ({ default: vi.fn() }));
vi.mock('@/models/User', () => ({ default: { findOne: vi.fn() } }));
vi.mock('@/lib/titleSystem', () => ({ getSelectedTitleInfo: () => null }));
const token = { channelId: 'channel', role: 'super_admin', isAdmin: true };
const evaluate = () => authOptions.callbacks.session({ session: { user: {} }, token });
beforeEach(() => vi.resetAllMocks());
describe('fresh session permissions', () => {
  it('uses DB grants, immediately observes revocations, and never trusts old JWT roles', async () => {
    vi.mocked(User.findOne).mockResolvedValueOnce({ role: 'user', adminScopes: ['clips'] } as never).mockResolvedValueOnce({ role: 'user', adminScopes: [] } as never);
    expect((await evaluate()).user).toMatchObject({ role: 'user', adminScopes: ['clips'], isAdmin: true });
    expect((await evaluate()).user).toMatchObject({ role: 'user', adminScopes: [], isAdmin: false });
    expect(User.findOne).toHaveBeenCalledTimes(2);
  });
  it('fails closed for deleted users and DB lookup failures', async () => {
    vi.mocked(User.findOne).mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('unavailable'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect((await evaluate()).user.isAdmin).toBe(false);
      expect((await evaluate()).user).toMatchObject({ role: 'user', adminScopes: [], isAdmin: false });
    } finally { log.mockRestore(); }
  });
});
