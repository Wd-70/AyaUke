import { normalizeText } from '@/shared/utils/song-match';
import type { WorkflowItem, UnmatchedTimelineCandidates } from '@/app/admin/tabs/clip-workflow/types';

/** Existing free-text discovery rules; never treat a text hit as a confirmed song match. */
export function filterUnmatchedTimelines(items: WorkflowItem[], query: string, excludeId?: string): WorkflowItem[] {
  const tokens = query.split(/\s+/).map(normalizeText).filter(Boolean);
  if (!tokens.length) return [];
  return items.filter(item => {
    if (item.id === excludeId || !item.isRelevant || item.isExcluded || item.matchedSongId) return false;
    const text = normalizeText(`${item.artist} ${item.songTitle}`);
    return tokens.every(token => text.includes(token));
  }).sort((a, b) => (b.date || '').localeCompare(a.date || '') || a.startTimeSeconds - b.startTimeSeconds);
}

export function paginateUnmatchedTimelines(items: WorkflowItem[], requestedPage: number): UnmatchedTimelineCandidates {
  const pageSize = 50;
  const page = Math.max(1, Math.min(Math.floor(requestedPage) || 1, Math.max(1, Math.ceil(items.length / pageSize))));
  return { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length, page, pageSize };
}
