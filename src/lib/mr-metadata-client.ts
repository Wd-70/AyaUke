export interface MRMetadata { title: string; channelTitle?: string }
const cache = new Map<string, { value: MRMetadata; expires: number }>();
const pending = new Map<string, Promise<MRMetadata>>();
const queue = new Map<string, { resolve: (value: MRMetadata) => void; reject: (error: Error) => void }>();
let timer: ReturnType<typeof setTimeout> | undefined;
export function seedMRMetadata(id: string, value: MRMetadata) {
  if (cache.size >= 300) cache.delete(cache.keys().next().value!);
  cache.set(id, { value, expires: Date.now() + 3600000 });
}
export function peekMRMetadata(id: string) {
  const cached = cache.get(id);
  return cached && cached.expires > Date.now() ? cached.value : undefined;
}
async function flush() {
  timer = undefined;
  const entries = [...queue.entries()].slice(0, 30);
  for (const [id] of entries) queue.delete(id);
  if (queue.size) timer = setTimeout(flush, 20);
  try {
    const response = await fetch('/api/youtube/metadata/batch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: entries.map(([id]) => id) }), signal: AbortSignal.timeout(15000) });
    const body = await response.json();
    if (!response.ok || !body.success) throw new Error('영상 정보 조회 실패');
    for (const [id, job] of entries) {
      const value = body.metadata?.[id];
      if (value?.title) { seedMRMetadata(id, value); job.resolve(value); }
      else job.reject(new Error('삭제되었거나 접근할 수 없는 영상입니다.'));
    }
  } catch (e) { for (const [, job] of entries) job.reject(e as Error); }
  finally { for (const [id] of entries) pending.delete(id); }
}
export function loadMRMetadata(id: string): Promise<MRMetadata> {
  const cached = peekMRMetadata(id);
  if (cached) return Promise.resolve(cached);
  const existing = pending.get(id);
  if (existing) return existing;
  const work = new Promise<MRMetadata>((resolve, reject) => queue.set(id, { resolve, reject }));
  pending.set(id, work);
  if (!timer) timer = setTimeout(flush, 20);
  return work;
}
