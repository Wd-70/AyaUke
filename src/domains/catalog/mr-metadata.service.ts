interface Metadata { title: string; channelTitle: string }
const cache = new Map<string, { expires: number; value: Metadata | null }>();
const pending = new Map<string, Promise<Record<string, Metadata>>>();
export async function batchMRMetadata(ids: string[]): Promise<Record<string, Metadata>> {
  const result: Record<string, Metadata> = {};
  const missing = [...new Set(ids)].filter(id => {
    const cached = cache.get(id);
    if (!cached || cached.expires <= Date.now()) return true;
    if (cached.value) result[id] = cached.value;
    return false;
  }).sort();
  if (!missing.length) return result;
  const batchKey = missing.join(',');
  let work = pending.get(batchKey);
  if (!work) {
    work = (async () => {
      const keys = [...new Set(Array.from({ length: 5 }, (_, i) => process.env[i ? `YOUTUBE_API_KEY_${i + 1}` : 'YOUTUBE_API_KEY']?.trim()).filter((key): key is string => !!key))];
      for (const key of keys) {
        const params = new URLSearchParams({ id: batchKey, part: 'snippet', key });
        const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`, { signal: AbortSignal.timeout(10000), next: { revalidate: 3600 } });
        const body = await response.json();
        if (!response.ok) {
          if (body.error?.errors?.some((e: { reason: string }) => ['quotaExceeded', 'dailyLimitExceeded'].includes(e.reason))) continue;
          throw new Error('영상 정보를 조회할 수 없습니다.');
        }
        const found: Record<string, Metadata> = {};
        for (const video of body.items || []) if (video.id && video.snippet?.title) {
          found[video.id] = { title: video.snippet.title, channelTitle: video.snippet.channelTitle || '' };
        }
        for (const id of missing) {
          if (cache.size >= 1000) cache.delete(cache.keys().next().value!);
          cache.set(id, { value: found[id] || null, expires: Date.now() + (found[id] ? 3600000 : 60000) });
        }
        return found;
      }
      throw new Error('YouTube 영상 정보 API를 사용할 수 없습니다.');
    })();
    pending.set(batchKey, work);
  }
  try { return { ...result, ...await work }; } finally { pending.delete(batchKey); }
}
