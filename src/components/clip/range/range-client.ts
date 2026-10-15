import type { QueryClient } from '@tanstack/react-query';
import type { ClipRangeDTO } from '@/domains/archive/clip-range.policy';

export const rangeKey = (owner: string, id: string) => ['clip-range', owner, id] as const;
async function decode<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok || !body.success) throw new Error(body.error?.message || '구간 정보를 처리하지 못했습니다.');
  return body.data;
}
export async function loadRanges(ids: string[], signal?: AbortSignal): Promise<ClipRangeDTO[]> {
  return decode(await fetch(`/api/clips/ranges?ids=${ids.join(',')}`, { cache: 'no-store', signal }));
}
export async function loadDetail(id: string): Promise<ClipRangeDTO> {
  return decode(await fetch(`/api/clips/${id}/range`, { cache: 'no-store' }));
}
export async function changeRange(id: string, body: object): Promise<{ range: ClipRangeDTO; clip?: Record<string, unknown>; proposalId?: string }> {
  return decode(await fetch(`/api/clips/${id}/range`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
}
export async function prefetchRanges(client: QueryClient, owner: string, ids: string[], signal?: AbortSignal) {
  const missing = [...new Set(ids)].filter(id => !client.getQueryData(rangeKey(owner, id))).slice(0, 10);
  if (!missing.length) return;
  const data = await loadRanges(missing, signal);
  if (signal?.aborted) return;
  for (const item of data) client.setQueryData(rangeKey(owner, item.clipId), item);
}
