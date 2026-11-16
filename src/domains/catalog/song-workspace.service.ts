import mongoose from 'mongoose';
import type { z } from 'zod';
import SongDetail from './song.schema';
import { createSongKey } from './merge';
import SongVideo from '@/domains/archive/schemas/song-video.schema';
import { ConflictError, NotFoundError, ValidationError } from '@/shared/api/errors';
import { emptySongFields, type SongLibraryItem, type SongLibraryDetail, type SongFieldsValue, type SongCreate, type SongChange, type SongBulk } from './song-workspace';

// The workspace edits catalog entries, never pending user suggestions or generated counters.
const catalog = { $and: [
  { $or: [{ sourceType: { $in: ['sheet', 'admin'] } }, { sourceType: { $exists: false } }] },
  { $or: [{ status: { $in: ['active', 'deleted'] } }, { status: { $exists: false } }] },
] };
type CatalogDocument = Partial<SongFieldsValue> & {
  _id: unknown; title: string; artist: string; status?: string; sourceType?: string; hasLyrics?: boolean;
  likeCount?: number; lastSungDate?: string | null; createdAt?: Date; updatedAt?: Date; deleteReason?: string;
};
const date = (value: unknown) => value ? new Date(value as string).toISOString() : null;
function validId(id: string) { if (!mongoose.Types.ObjectId.isValid(id)) throw new ValidationError('잘못된 곡 ID입니다.'); }
function fields(doc: CatalogDocument): SongFieldsValue {
  return { ...emptySongFields(), titleAlias: doc.titleAlias || '', artistAlias: doc.artistAlias || '', language: doc.language || '',
    searchTags: doc.searchTags || [], lyrics: doc.lyrics || '', personalNotes: doc.personalNotes || '', imageUrl: doc.imageUrl || '',
    keyAdjustment: doc.keyAdjustment ?? null, clipDuration: doc.clipDuration != null && doc.clipDuration > 0 ? doc.clipDuration : null,
    mrLinks: (doc.mrLinks || []).map((m) => ({ url: m.url || '', skipSeconds: m.skipSeconds || 0, label: m.label || '', duration: m.duration || '' })),
    selectedMRIndex: doc.selectedMRIndex || 0 };
}
function item(doc: CatalogDocument, clips = 0, verifiedClips = 0): SongLibraryItem {
  const value = fields(doc);
  return { id: String(doc._id), title: doc.title, artist: doc.artist, titleAlias: value.titleAlias, artistAlias: value.artistAlias,
    language: value.language, searchTags: value.searchTags, imageUrl: value.imageUrl,
    mrCount: value.mrLinks.length, selectedMR: value.mrLinks[value.selectedMRIndex] || null,
    hasLyrics: 'hasLyrics' in doc ? !!doc.hasLyrics : !!value.lyrics.trim(), clipDuration: value.clipDuration, keyAdjustment: value.keyAdjustment,
    status: doc.status === 'deleted' ? 'deleted' : 'active', sourceType: doc.sourceType === 'admin' ? 'admin' : 'sheet',
    clips, verifiedClips, likeCount: doc.likeCount || 0, lastSungDate: doc.lastSungDate || null,
    updatedAt: date(doc.updatedAt), createdAt: date(doc.createdAt) };
}
type ClipCount = { _id: string; count: number; verified: number };
let countsCache: { expires: number; data: ClipCount[] } | undefined;
let countsPending: Promise<ClipCount[]> | undefined;
async function libraryCounts(cached: boolean | 'fresh') {
  if (cached === true && countsCache && countsCache.expires > Date.now()) return countsCache.data;
  if (cached === true && countsPending) return countsPending;
  const work = SongVideo.aggregate<ClipCount>([{ $group: { _id: '$songId', count: { $sum: 1 }, verified: { $sum: { $cond: ['$isVerified', 1, 0] } } } }]).exec();
  if (!cached) return work;
  countsPending = work;
  try { const data = await work; if (countsPending === work) countsCache = { data, expires: Date.now() + 30000 }; return data; }
  finally { if (countsPending === work) countsPending = undefined; }
}
// The list never transfers lyrics/notes bodies out of MongoDB.
export async function songLibrary(cachedCounts: boolean | 'fresh' = false) {
  const [docs, counts] = await Promise.all([
    SongDetail.aggregate<CatalogDocument>([
      { $match: catalog }, { $sort: { updatedAt: -1, _id: 1 } },
      { $project: { title: 1, artist: 1, titleAlias: 1, artistAlias: 1, language: 1, searchTags: 1, imageUrl: 1,
        keyAdjustment: 1, clipDuration: 1, mrLinks: 1, selectedMRIndex: 1, status: 1, sourceType: 1,
        likeCount: 1, lastSungDate: 1, createdAt: 1, updatedAt: 1,
        hasLyrics: { $gt: [{ $strLenCP: { $trim: { input: { $ifNull: ['$lyrics', ''] } } } }, 0] } } },
    ]),
    libraryCounts(cachedCounts),
  ]);
  const bySong = new Map(counts.map(c => [String(c._id), c]));
  const songs = docs.map(doc => { const count = bySong.get(String(doc._id)); return item(doc, count?.count, count?.verified); });
  const keys = new Map<string, number>();
  for (const song of songs.filter(s => s.status !== 'deleted')) {
    const key = createSongKey(song.titleAlias || song.title, song.artistAlias || song.artist);
    keys.set(key, (keys.get(key) || 0) + 1);
  }
  return { songs: songs.map(song => ({ ...song, displayConflicts: song.status === 'deleted' ? 0 : Math.max(0, (keys.get(createSongKey(song.titleAlias || song.title, song.artistAlias || song.artist)) || 0) - 1) })) };
}
export async function songLibraryDetail(id: string, includeStats = true): Promise<SongLibraryDetail> {
  validId(id);
  const doc = await SongDetail.findOne({ ...catalog, _id: id }).lean<CatalogDocument>();
  if (!doc) throw new NotFoundError('곡을 찾을 수 없습니다.');
  const stats = includeStats ? await songLibraryStats(id) : { clips: 0, verifiedClips: 0 };
  return { ...item(doc, stats.clips, stats.verifiedClips), statsLoaded: includeStats, values: fields(doc), deleteReason: doc.deleteReason || '' };
}
export async function songLibraryStats(id: string) {
  validId(id);
  const [counts] = await SongVideo.aggregate<{ count: number; verified: number }>([
    { $match: { songId: id } },
    { $group: { _id: null, count: { $sum: 1 }, verified: { $sum: { $cond: ['$isVerified', 1, 0] } } } },
  ]);
  return { clips: counts?.count || 0, verifiedClips: counts?.verified || 0 };
}
const writeFields = ({ language, ...values }: SongFieldsValue) => ({
  ...values, ...(language ? { language } : {}), searchTags: [...new Set(values.searchTags)],
});
export async function createLibrarySong(body: z.infer<typeof SongCreate>, includeStats = true) {
  const doc = await SongDetail.create({ title: body.title, artist: body.artist, ...writeFields(body.values), sourceType: 'admin', status: 'active' });
  return includeStats ? songLibraryDetail(String(doc._id)) : { ...item(doc), statsLoaded: false, values: fields(doc), deleteReason: '' };
}
const nextTimestamp = (previous: string | null) => new Date(Math.max(Date.now(), previous ? new Date(previous).getTime() + 1 : 0));
function revision(updatedAt: string | null) { return updatedAt ? new Date(updatedAt) : { $eq: null }; }
export async function changeLibrarySong(id: string, body: z.infer<typeof SongChange>, actor: string, includeStats = true) {
  validId(id);
  const status = body.action === 'restore' ? 'deleted' : { $ne: 'deleted' };
  const update = body.action === 'edit' ? { $set: writeFields(body.values), ...(body.values.language ? {} : { $unset: { language: '' } }) }
    : body.action === 'archive' ? { $set: { status: 'deleted', deletedAt: new Date(), deletedBy: actor, deleteReason: body.reason || '관리 화면에서 보관' } }
    : { $set: { status: 'active' }, $unset: { deletedAt: '', deletedBy: '', deleteReason: '' } };
  // One atomic compare-and-set prevents overwriting concurrent MR/default-duration changes.
  const stamped = { ...update, $set: { ...update.$set, updatedAt: nextTimestamp(body.expectedUpdatedAt) } };
  const changed = await SongDetail.findOneAndUpdate({ ...catalog, _id: id, status, updatedAt: revision(body.expectedUpdatedAt) }, stamped, { new: true, runValidators: true, timestamps: false });
  if (!changed) throw new ConflictError('다른 작업에서 이 곡이 변경되었습니다. 최신 내용을 불러온 뒤 다시 저장해주세요.');
  return includeStats ? songLibraryDetail(id) : { ...item(changed.toObject()), statsLoaded: false, values: fields(changed.toObject()), deleteReason: changed.deleteReason || '' };
}
export async function bulkLibrarySongs(body: z.infer<typeof SongBulk>, includeSummaries = false) {
  const changed: string[] = [], conflicts: string[] = [];
  const updated: SongLibraryItem[] = [];
  for (const target of body.targets) {
    const update = body.change.field === 'searchTags'
      ? { $addToSet: { searchTags: { $each: [...new Set(body.change.value)] } } }
      : { $set: { [body.change.field]: body.change.value } };
    const stamped = { ...update, $set: { ...('$set' in update ? update.$set : {}), updatedAt: nextTimestamp(target.updatedAt) } };
    const doc = await SongDetail.findOneAndUpdate({ ...catalog, _id: target.id, status: { $ne: 'deleted' }, updatedAt: revision(target.updatedAt) }, stamped, { new: true, runValidators: true, timestamps: false });
    (doc ? changed : conflicts).push(target.id);
    if (doc && includeSummaries) updated.push(item(doc.toObject()));
  }
  return { changed, conflicts, ...(includeSummaries ? { updated } : {}) };
}
