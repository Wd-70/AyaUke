import { z } from 'zod';

export const SONG_LANGUAGES = ['Korean', 'Japanese', 'English', 'Chinese', 'Other'] as const;
export const LANGUAGE_LABELS: Record<string, string> = { Korean: '한국어', Japanese: '일본어', English: '영어', Chinese: '중국어', Other: '기타', '': '미설정' };
const httpUrl = z.string().trim().max(2000).refine(value => {
  try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
}, 'http 또는 https 주소를 입력해주세요.');
const text = (max: number) => z.string().trim().max(max);
export const SongFields = z.object({
  titleAlias: text(200), artistAlias: text(200),
  language: z.union([z.enum(SONG_LANGUAGES), z.literal('')]),
  searchTags: z.array(text(80).min(1)).max(50),
  lyrics: z.string().max(100000),
  personalNotes: z.string().max(5000),
  imageUrl: z.union([z.literal(''), httpUrl]),
  keyAdjustment: z.number().int().min(-12).max(12).nullable(),
  clipDuration: z.number().finite().positive().max(86400).nullable(),
  mrLinks: z.array(z.object({
    url: httpUrl, skipSeconds: z.number().finite().min(0).max(86400),
    label: text(120), duration: text(40),
  }).strict()).max(30),
  selectedMRIndex: z.number().int().nonnegative(),
}).strict().superRefine((value, ctx) => {
  if (value.selectedMRIndex >= Math.max(1, value.mrLinks.length)) ctx.addIssue({ code: 'custom', path: ['selectedMRIndex'], message: '대표 MR을 다시 선택해주세요.' });
});
export type SongFieldsValue = z.infer<typeof SongFields>;
export const SongCreate = z.object({ title: text(200).min(1, '원본 제목을 입력해주세요.'), artist: text(200).min(1, '원본 가수를 입력해주세요.'), values: SongFields }).strict();
const Revision = z.string().datetime().nullable();
export const SongChange = z.discriminatedUnion('action', [
  z.object({ action: z.literal('edit'), expectedUpdatedAt: Revision, values: SongFields }).strict(),
  z.object({ action: z.enum(['archive', 'restore']), expectedUpdatedAt: Revision, reason: text(500).optional() }).strict(),
]);
export const SongBulk = z.object({
  targets: z.array(z.object({ id: z.string().regex(/^[a-f\d]{24}$/i), updatedAt: Revision }).strict()).min(1).max(100),
  change: z.discriminatedUnion('field', [
    z.object({ field: z.literal('language'), value: z.enum(SONG_LANGUAGES) }).strict(),
    z.object({ field: z.literal('keyAdjustment'), value: z.number().int().min(-12).max(12).nullable() }).strict(),
    z.object({ field: z.literal('searchTags'), value: z.array(text(80).min(1)).min(1).max(20) }).strict(),
  ]),
}).strict().refine(body => new Set(body.targets.map(t => t.id)).size === body.targets.length, '같은 곡을 중복 선택할 수 없습니다.');

export interface SongLibraryItem {
  id: string; title: string; artist: string; titleAlias: string; artistAlias: string;
  language: string; searchTags: string[]; imageUrl: string;
  displayConflicts?: number;
  mrCount: number; selectedMR: SongFieldsValue['mrLinks'][number] | null; hasLyrics: boolean;
  clipDuration: number | null; keyAdjustment: number | null;
  status: 'active' | 'deleted'; sourceType: 'sheet' | 'admin';
  clips: number; verifiedClips: number; likeCount: number; lastSungDate: string | null;
  updatedAt: string | null; createdAt: string | null;
}
export interface SongLibraryDetail extends SongLibraryItem {
  values: SongFieldsValue; deleteReason: string; statsLoaded?: boolean;
}
export interface SongLibrary { songs: SongLibraryItem[] }
export type SongFilter = 'all' | 'missing-mr' | 'missing-lyrics' | 'missing-duration' | 'zero-skip' | 'display-collision' | 'deleted';
export const FILTER_LABELS: Record<SongFilter, string> = {
  all: '노래책 등록곡', 'missing-mr': 'MR 없음', 'missing-lyrics': '가사 없음',
  'missing-duration': '기본 길이 없음', 'zero-skip': '대표 MR 스킵 0초', 'display-collision': '표시명 겹침', deleted: '보관함',
};
export const displaySongTitle = (song: Pick<SongLibraryItem, 'title' | 'titleAlias'>) => song.titleAlias || song.title;
export const displaySongArtist = (song: Pick<SongLibraryItem, 'artist' | 'artistAlias'>) => song.artistAlias || song.artist;
export function inSongFilter(song: SongLibraryItem, filter: SongFilter) {
  if (filter === 'deleted') return song.status === 'deleted';
  if (song.status === 'deleted') return false;
  if (filter === 'display-collision') return (song.displayConflicts || 0) > 0;
  if (filter === 'missing-mr') return song.mrCount === 0;
  if (filter === 'missing-lyrics') return !song.hasLyrics;
  if (filter === 'missing-duration') return !song.clipDuration;
  if (filter === 'zero-skip') return !!song.selectedMR && !song.selectedMR.skipSeconds;
  return true;
}
export function searchLibrary(songs: SongLibraryItem[], query: string, filter: SongFilter, language: string, source: string) {
  const normalize = (s: string) => s.normalize('NFKC').toLocaleLowerCase().replace(/\s/g, '');
  const tokens = query.trim().split(/\s+/).map(normalize).filter(Boolean);
  return songs.filter(song => inSongFilter(song, filter) && (language === 'all' || song.language === language)
    && (source === 'all' || song.sourceType === source)
    && tokens.every(token => normalize([song.title, song.artist, song.titleAlias, song.artistAlias, ...song.searchTags].join(' ')).includes(token)));
}
export function emptySongFields(): SongFieldsValue {
  return { titleAlias: '', artistAlias: '', language: '', searchTags: [], lyrics: '', personalNotes: '', imageUrl: '',
    keyAdjustment: null, clipDuration: null, mrLinks: [], selectedMRIndex: 0 };
}
export function durationLabel(seconds: number | null | undefined) {
  if (seconds == null) return '미설정';
  const rounded = Math.round(seconds * 100) / 100;
  const rest = String(Math.round((rounded % 60) * 100) / 100);
  return `${Math.floor(rounded / 60)}:${Number(rest) < 10 ? '0' : ''}${rest}`;
}
/** Keep the selected MR attached to its row after removal, rather than to a stale index. */
export function removeMR(values: SongFieldsValue, index: number): SongFieldsValue {
  const mrLinks = values.mrLinks.filter((_, i) => i !== index);
  const selectedMRIndex = values.selectedMRIndex === index ? 0 : values.selectedMRIndex - (index < values.selectedMRIndex ? 1 : 0);
  return { ...values, mrLinks, selectedMRIndex: Math.max(0, selectedMRIndex) };
}
export function mrPlaybackUrl(url: string, skip: number) {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return '';
    if (/(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(parsed.hostname)) parsed.searchParams.set('t', String(skip));
    return parsed.toString();
  } catch { return ''; }
}
