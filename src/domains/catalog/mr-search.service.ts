import { DDEOK_MR_CHANNEL_ID, defaultMRQuery, matchesMRSongTitle, rankMRCandidates, type MRCandidate, type MRSearchRequest, type MRSearchResults } from './mr-search';

interface SearchItem {
  id?: { videoId?: string };
  snippet?: { title?: string; channelId?: string; channelTitle?: string };
}
interface SearchResponse { items?: SearchItem[]; error?: { errors?: Array<{ reason?: string }> } }
export class MRSearchError extends Error {
  constructor(message: string, public status = 502) { super(message); }
}
const cache = new Map<string, { expires: number; value: MRSearchResults }>();
const pending = new Map<string, Promise<MRSearchResults>>();
const exhausted = new Map<string, number>();
function apiKeys() {
  return [...new Set(Array.from({ length: 5 }, (_, i) => process.env[i ? `YOUTUBE_API_KEY_${i + 1}` : 'YOUTUBE_API_KEY']?.trim()).filter((key): key is string => !!key))];
}
async function search(query: string, channelId?: string): Promise<MRCandidate[]> {
  const keys = apiKeys();
  if (!keys.length) throw new MRSearchError('YouTube 검색 API 키가 설정되지 않았습니다. 직접 링크를 입력해주세요.', 503);
  for (const key of keys) {
    if ((exhausted.get(key) || 0) > Date.now()) continue;
    const params = new URLSearchParams({ key, part: 'snippet', type: 'video', maxResults: channelId ? '10' : '25', order: 'relevance', q: query });
    if (channelId) params.set('channelId', channelId);
    let response: Response;
    try { response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`, { signal: AbortSignal.timeout(12000), cache: 'no-store' }); }
    catch { throw new MRSearchError('YouTube 검색 연결이 지연되고 있습니다. 잠시 후 다시 시도해주세요.'); }
    const data = await response.json().catch(() => null) as SearchResponse | null;
    if (!response.ok || !data || data.error) {
      if (data?.error?.errors?.some(error => ['quotaExceeded', 'dailyLimitExceeded'].includes(error.reason || ''))) {
        exhausted.set(key, Date.now() + 10 * 60 * 1000); continue;
      }
      throw new MRSearchError('YouTube 검색에 실패했습니다. 잠시 후 다시 시도하거나 직접 링크를 입력해주세요.');
    }
    return (data.items || []).flatMap(item => {
      const id = item.id?.videoId, snippet = item.snippet;
      if (!id || !/^[\w-]{11}$/.test(id) || !snippet?.channelId) return [];
      return [{ videoId: id, title: snippet.title || '제목 없음', channelId: snippet.channelId, channelTitle: snippet.channelTitle || '',
        url: `https://www.youtube.com/watch?v=${id}`, thumbnail: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`, preferred: false }];
    });
  }
  throw new MRSearchError('YouTube 검색 할당량을 초과했습니다. 나중에 다시 시도하거나 직접 링크를 입력해주세요.', 503);
}
export async function searchMRCandidates(input: MRSearchRequest): Promise<MRSearchResults> {
  const searchQuery = input.query || defaultMRQuery(input.title, input.artist);
  const key = JSON.stringify([searchQuery, input.language, input.title, input.artist]);
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;
  const active = pending.get(key);
  if (active) return active;
  const work = (async () => {
    // Dedicated channel query finds candidates beyond the global top 25.
    const requests = await Promise.allSettled([
      search(searchQuery),
      ...(input.language === 'Japanese' ? [search(input.query || `${input.title} ${input.artist}`, DDEOK_MR_CHANNEL_ID)] : []),
    ]);
    const fulfilled = requests.filter((result): result is PromiseFulfilledResult<MRCandidate[]> => result.status === 'fulfilled');
    if (!fulfilled.length) throw (requests[0] as PromiseRejectedResult).reason;
    const warnings: string[] = [];
    if (requests[0].status === 'rejected') warnings.push('전체 검색에 실패하여 떡뮤 채널 결과만 표시합니다.');
    if (requests[1]?.status === 'rejected') warnings.push('떡뮤 채널 별도 검색에 실패했습니다. 전체 검색 결과만 표시합니다.');
    // YouTube can return other songs by the same artist even for a dedicated channel query.
    // Keep only title matches from that channel in default search. A manual query is an explicit override.
    const candidates = fulfilled.flatMap(result => result.value).filter(item => input.query || input.language !== 'Japanese'
      || item.channelId !== DDEOK_MR_CHANNEL_ID || matchesMRSongTitle(item.title, input.title));
    const value = { ...rankMRCandidates(candidates, input.language), searchQuery, warnings };
    if (!warnings.length) {
      if (cache.size >= 100) cache.delete(cache.keys().next().value!);
      cache.set(key, { value, expires: Date.now() + 5 * 60 * 1000 });
    }
    return value;
  })();
  pending.set(key, work);
  try { return await work; } finally { pending.delete(key); }
}
