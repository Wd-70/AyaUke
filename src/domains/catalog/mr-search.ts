import { z } from 'zod';

export const MRSearchInput = z.object({
  title: z.string().trim().min(1).max(200),
  artist: z.string().trim().min(1).max(200),
  language: z.enum(['Korean', 'Japanese', 'English', 'Chinese', 'Other', '']).default(''),
  query: z.string().trim().min(1).max(500).optional(),
}).strict();
export type MRSearchRequest = z.infer<typeof MRSearchInput>;
export interface MRCandidate {
  videoId: string; title: string; url: string; thumbnail: string;
  channelId: string; channelTitle: string; preferred: boolean;
}
export interface MRSearchResults {
  results: MRCandidate[]; searchQuery: string; excludedCount: number; warnings: string[];
}
// Verified against https://www.youtube.com/@떡뮤 on 2026-11-15.
// Match channel identity, never a mention of its name in a video title.
export const DDEOK_MR_CHANNEL_ID = 'UCrdNFs5BEnMkUsnexngzq5A';
// Official @KARAOKEKY and @TJ노래방TJKaraoke; verified 2026-11-15.
export const OFFICIAL_KARAOKE_CHANNEL_IDS = new Set(['UCDqaUIUSJP5EVMEI178Zfag', 'UCZUhx8ClCv6paFW7qi3qljg']);
export function isOfficialKoreanKaraoke(candidate: Pick<MRCandidate, 'channelId' | 'channelTitle'>) {
  if (OFFICIAL_KARAOKE_CHANNEL_IDS.has(candidate.channelId)) return true;
  const name = candidate.channelTitle.normalize('NFKC').replace(/[\s._\-·()[\]]/g, '').toLowerCase();
  return /^(tj(노래방|karaoke|media)|태진(노래방|미디어)|금영|ky(노래방|karaoke)|kumyoung|karaokeky)/.test(name);
}
export function rankMRCandidates(candidates: MRCandidate[], language: string) {
  const unique = [...new Map(candidates.map(item => [item.videoId, item])).values()];
  const results = unique.filter(item => language !== 'Korean' || !isOfficialKoreanKaraoke(item))
    .map(item => ({ ...item, preferred: language === 'Japanese' && item.channelId === DDEOK_MR_CHANNEL_ID }))
    .sort((a, b) => Number(b.preferred) - Number(a.preferred));
  return { results, excludedCount: unique.length - results.length };
}
export function matchesMRSongTitle(videoTitle: string, songTitle: string) {
  const normalize = (text: string) => text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  const title = normalize(songTitle);
  return !!title && normalize(videoTitle).includes(title);
}
export function defaultMRQuery(title: string, artist: string) {
  return `${title.trim()} ${artist.trim()} MR karaoke`.trim();
}
export function youtubeMRVideoId(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    const id = host === 'youtu.be' ? url.pathname.split('/')[1]
      : ['youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(host)
        ? url.searchParams.get('v') || url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1] : null;
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  } catch { return null; }
}
export interface EditableMR { url: string; skipSeconds?: number; label?: string; duration?: string }
export function compactMRLinks<T extends EditableMR>(mrLinks: T[], selectedMRIndex: number) {
  const selected = mrLinks[selectedMRIndex];
  const kept = mrLinks.filter(link => link.url.trim());
  return { mrLinks: kept, selectedMRIndex: Math.max(0, kept.indexOf(selected)) };
}
export function removeMRLink<T extends EditableMR>(mrLinks: T[], selectedMRIndex: number, index: number) {
  return { mrLinks: mrLinks.filter((_, i) => i !== index), selectedMRIndex: selectedMRIndex === index ? 0 : Math.max(0, selectedMRIndex - (index < selectedMRIndex ? 1 : 0)) };
}
export function hasMRCandidate(links: EditableMR[], candidate: MRCandidate) {
  return links.some(link => youtubeMRVideoId(link.url) === candidate.videoId);
}
// Fill only completely empty placeholders; preserve existing metadata and representative MR.
export function addMRCandidate<T extends EditableMR>(links: T[], candidate: MRCandidate): Array<T | Required<EditableMR>> {
  if (hasMRCandidate(links, candidate)) return links;
  const blank = links.findIndex(link => !link.url.trim() && !link.label?.trim() && !link.duration?.trim() && !link.skipSeconds);
  const added = { url: candidate.url, skipSeconds: 0, label: candidate.title.slice(0, 120), duration: '' };
  if (blank >= 0) return links.map((link, i) => i === blank ? added : link);
  return links.length < 30 ? [...links, added] : links;
}
