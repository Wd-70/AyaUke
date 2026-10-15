import mongoose, { type ClientSession } from 'mongoose';
import SongVideo from './schemas/song-video.schema';
import { PersonalClipRange, ClipRangeProposal, ClipRangeVote, ClipRangeHistory } from './clip-range.schema';
import { chooseRecommendation, resolveRange, roundTime, validRange, type ClipRange, type ClipRangeDTO } from './clip-range.policy';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '@/shared/api/errors';

export function objectId(value: string) {
  if (!/^[a-f\d]{24}$/i.test(value)) throw new ValidationError('잘못된 식별자입니다.');
  return new mongoose.Types.ObjectId(value);
}
const expiry = () => new Date(Date.now() + 90 * 86_400_000);
const range = (c: { startTime?: number | null; endTime?: number | null }): ClipRange =>
  ({ startTime: c.startTime ?? 0, endTime: c.endTime ?? null });

function normalize(input: ClipRange, duration?: string): ClipRange {
  const value = { startTime: roundTime(input.startTime), endTime: input.endTime === null ? null : roundTime(input.endTime) };
  // Existing source metadata may be ISO-8601 (YouTube), clock time, or seconds.
  let length: number | undefined;
  if (duration) {
    const iso = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec(duration);
    if (iso) length = Number(iso[1] || 0) * 3600 + Number(iso[2] || 0) * 60 + Number(iso[3] || 0);
    else if (/^\d+(?::\d+){0,2}$/.test(duration)) length = duration.split(':').reduce((n, s) => n * 60 + Number(s), 0);
  }
  if (!validRange(value, length && length > 0 ? length : undefined)) throw new ValidationError('원본 범위 안에서 시작보다 뒤의 종료 시각을 지정해주세요.');
  return value;
}

async function requireClip(id: string, session?: ClientSession) {
  const clip = await SongVideo.findById(objectId(id)).session(session ?? null);
  if (!clip || clip.sourceUnavailable) throw new NotFoundError('재생 가능한 클립을 찾을 수 없습니다.');
  return clip;
}

function checkVersion(clip: { sourceVersion?: number; rangeVersion?: number }, sourceVersion: number, baseVersion?: number) {
  if ((clip.sourceVersion ?? 0) !== sourceVersion || (baseVersion !== undefined && (clip.rangeVersion ?? 0) !== baseVersion))
    throw new ConflictError('원본 또는 공식 구간이 변경되었습니다. 최신 값을 다시 불러와주세요.');
}

/** Serialize community mutations with official updates using the same clip document.
 * Transactions retry write conflicts; candidate votes never race official verification. */
async function lockClip(id: string, session: ClientSession) {
  const clip = await requireClip(id, session);
  await SongVideo.updateOne({ _id: clip._id }, { $inc: { rangeActivity: 1 } }, { session, timestamps: false });
  return clip;
}

async function summaries(clipIds: mongoose.Types.ObjectId[], session?: ClientSession) {
  return ClipRangeVote.aggregate<{ _id: mongoose.Types.ObjectId; support: number; objections: number }>([
    { $match: { clipId: { $in: clipIds }, expiresAt: { $exists: false } } },
    { $group: { _id: '$proposalId', support: { $sum: { $cond: [{ $and: [{ $eq: ['$start', 1] }, { $eq: ['$end', 1] }] }, 1, 0] } },
      objections: { $sum: { $cond: [{ $or: [{ $eq: ['$start', -1] }, { $eq: ['$end', -1] }] }, 1, 0] } } } },
  ]).session(session ?? null);
}

async function refreshRecommendation(clip: Awaited<ReturnType<typeof requireClip>>, session: ClientSession) {
  const proposals = await ClipRangeProposal.find({ clipId: clip._id, status: 'active',
    baseVersion: clip.rangeVersion ?? 0, sourceVersion: clip.sourceVersion ?? 0 }).session(session).lean();
  const counts = await summaries([clip._id as mongoose.Types.ObjectId], session);
  const candidates = proposals.map(p => ({ id: String(p._id), createdAt: p.createdAt!,
    support: counts.find(c => String(c._id) === String(p._id))?.support ?? 0,
    objections: counts.find(c => String(c._id) === String(p._id))?.objections ?? 0 }));
  const selected = clip.isVerified ? null : chooseRecommendation(candidates, clip.communityRange?.proposalId?.toString());
  const proposal = proposals.find(p => String(p._id) === selected);
  await SongVideo.updateOne({ _id: clip._id }, { $set: { communityRange: proposal ? {
    proposalId: proposal._id, sourceVersion: proposal.sourceVersion, baseVersion: proposal.baseVersion,
    startTime: proposal.startTime, endTime: proposal.endTime,
    support: candidates.find(c => c.id === selected)!.support,
    trimSeconds: Math.max(0, (clip.endTime ?? proposal.endTime) - proposal.endTime),
  } : null } }, { session, timestamps: false });
}

export async function getRanges(ids: string[], userId?: string, detailed = false): Promise<ClipRangeDTO[]> {
  const clipIds = [...new Set(ids)].map(objectId);
  const clips = await SongVideo.find({ _id: { $in: clipIds }, sourceUnavailable: { $ne: true } })
    .select('platform videoId startTime endTime isVerified sourceVersion rangeVersion communityRange').lean();
  const personal = userId ? await PersonalClipRange.find({ userId: objectId(userId), clipId: { $in: clipIds } }).lean() : [];
  // Basic playback needs only two indexed queries, never per-clip proposal aggregation.
  const proposals = detailed ? await ClipRangeProposal.find({ clipId: { $in: clipIds }, status: 'active' }).sort({ createdAt: 1 }).limit(50).lean() : [];
  const counts = detailed ? await summaries(clipIds) : [];
  const votes = detailed && userId ? await ClipRangeVote.find({ userId: objectId(userId), clipId: { $in: clipIds }, expiresAt: { $exists: false } }).lean() : [];
  return clips.map(c => {
    const official = range(c);
    const base = { ...official, isVerified: c.isVerified, sourceVersion: c.sourceVersion ?? 0, rangeVersion: c.rangeVersion ?? 0 };
    const mine = personal.find(p => String(p.clipId) === String(c._id) && p.sourceVersion === base.sourceVersion);
    const effective = resolveRange(base, mine ? { ...range(mine), sourceVersion: mine.sourceVersion } : null, c.communityRange);
    return { clipId: String(c._id), platform: c.platform || 'youtube', videoId: c.videoId,
      sourceVersion: base.sourceVersion, rangeVersion: base.rangeVersion, isVerified: !!c.isVerified,
      official, personal: mine ? range(mine) : null, effective,
      recommendationId: !c.isVerified && c.communityRange?.baseVersion === base.rangeVersion ? String(c.communityRange.proposalId) : null,
      proposals: proposals.filter(p => String(p.clipId) === String(c._id) && p.baseVersion === base.rangeVersion && p.sourceVersion === base.sourceVersion).map(p => {
        const count = counts.find(x => String(x._id) === String(p._id));
        const vote = votes.find(v => String(v.proposalId) === String(p._id));
        return { id: String(p._id), ...range(p), mine: String(p.userId) === userId,
          support: count?.support ?? 0, objections: count?.objections ?? 0,
          vote: vote ? { start: vote.start, end: vote.end } : null };
      }),
    };
  });
}

export async function savePersonal(clipId: string, userId: string, sourceVersion: number, input: ClipRange | null, pin = false) {
  await mongoose.connection.transaction(async session => {
    const clip = await lockClip(clipId, session);
    checkVersion(clip, sourceVersion);
    const key = { clipId: clip._id, userId: objectId(userId) };
    if (input === null) { await PersonalClipRange.deleteOne(key).session(session); return; }
    const value = normalize(input, clip.duration);
    if (value.endTime === null) throw new ValidationError('개인 구간의 종료 시간을 지정해주세요.');
    const fallback = resolveRange({ ...range(clip), isVerified: clip.isVerified,
      sourceVersion: clip.sourceVersion ?? 0, rangeVersion: clip.rangeVersion ?? 0 }, null, clip.communityRange);
    if (!pin && value.startTime === fallback.startTime && value.endTime === fallback.endTime) {
      await PersonalClipRange.deleteOne(key).session(session); return;
    }
    await PersonalClipRange.updateOne(key, { $set: { ...value, sourceVersion } }, { upsert: true, session });
  });
}

export async function propose(clipId: string, userId: string, sourceVersion: number, baseVersion: number, input: ClipRange) {
  return mongoose.connection.transaction(async session => {
    const clip = await lockClip(clipId, session);
    checkVersion(clip, sourceVersion, baseVersion);
    if (clip.isVerified) throw new ForbiddenError('검증된 클립은 개인 구간만 저장할 수 있습니다.');
    const value = normalize(input, clip.duration);
    if (value.endTime === null) throw new ValidationError('공유할 구간의 종료 시간을 지정해주세요.');
    if (value.startTime === (clip.startTime ?? 0) && value.endTime === clip.endTime) throw new ValidationError('기존 구간과 동일합니다.');
    const key = { clipId: clip._id, status: 'active', baseVersion, sourceVersion };
    const duplicate = await ClipRangeProposal.findOne({ ...key, ...value }).session(session);
    if (duplicate) return String(duplicate._id);
    if (await ClipRangeProposal.countDocuments({ userId: objectId(userId), createdAt: { $gte: new Date(Date.now() - 86_400_000) } }).session(session) >= 20)
      throw new ValidationError('개선안 공유는 하루 20건까지 가능합니다.');
    const active = await ClipRangeProposal.countDocuments(key).session(session);
    const previous = await ClipRangeProposal.findOne({ clipId: clip._id, userId: objectId(userId), status: 'active' }).session(session);
    if (active >= 50 && !previous) throw new ValidationError('제안이 많습니다. 기존 제안을 먼저 확인해주세요.');
    if (previous) {
      const expiresAt = expiry();
      await ClipRangeProposal.updateOne({ _id: previous._id }, { $set: { status: 'superseded', expiresAt } }, { session });
      await ClipRangeVote.updateMany({ proposalId: previous._id }, { $set: { expiresAt } }, { session });
    }
    const [proposal] = await ClipRangeProposal.create([{ ...key, ...value, userId: objectId(userId) }], { session });
    await refreshRecommendation(clip, session);
    return String(proposal._id);
  });
}

export async function evaluate(clipId: string, userId: string, proposalId: string, start: number, end: number) {
  await mongoose.connection.transaction(async session => {
    const clip = await lockClip(clipId, session);
    if (clip.isVerified) throw new ForbiddenError('공식 검증이 완료되었습니다.');
    const proposal = await ClipRangeProposal.findOne({ _id: objectId(proposalId), clipId: clip._id, status: 'active' }).session(session);
    if (!proposal) throw new NotFoundError('활성 제안을 찾을 수 없습니다.');
    checkVersion(clip, proposal.sourceVersion, proposal.baseVersion);
    if (String(proposal.userId) === userId) throw new ForbiddenError('본인의 제안에는 평가할 수 없습니다.');
    const key = { proposalId: proposal._id, userId: objectId(userId) };
    if (start === 0 && end === 0) await ClipRangeVote.deleteOne(key).session(session);
    else await ClipRangeVote.updateOne(key,
      { $set: { clipId: clip._id, start, end } }, { upsert: true, session });
    await refreshRecommendation(clip, session);
  });
}

export async function withdraw(clipId: string, userId: string, proposalId: string) {
  await mongoose.connection.transaction(async session => {
    const clip = await lockClip(clipId, session);
    const proposal = await ClipRangeProposal.findOne({ _id: objectId(proposalId), clipId: clip._id, userId: objectId(userId), status: 'active' }).session(session);
    if (!proposal) throw new NotFoundError('철회할 제안을 찾을 수 없습니다.');
    const expiresAt = expiry();
    await ClipRangeProposal.updateOne({ _id: proposal._id }, { $set: { status: 'withdrawn', expiresAt } }, { session });
    await ClipRangeVote.updateMany({ proposalId: proposal._id }, { $set: { expiresAt } }, { session });
    await refreshRecommendation(clip, session);
  });
}

export async function publishOfficial(clipId: string, userId: string, sourceVersion: number, baseVersion: number, input: ClipRange, proposalId?: string) {
  return mongoose.connection.transaction(async session => {
    const clip = await lockClip(clipId, session);
    checkVersion(clip, sourceVersion, baseVersion);
    const value = normalize(input, clip.duration);
    if (value.endTime === null) throw new ValidationError('검증할 종료 시간을 지정해주세요.');
    if (proposalId && !await ClipRangeProposal.exists({ _id: objectId(proposalId), clipId: clip._id, baseVersion, sourceVersion, status: 'active' }).session(session))
      throw new ConflictError('제안이 변경되었습니다. 다시 확인해주세요.');
    const updated = await SongVideo.findOneAndUpdate({ _id: clip._id }, { $set: {
      ...value, isVerified: true, verifiedBy: objectId(userId), verifiedAt: new Date(), communityRange: null,
    } }, { new: true, runValidators: true, session });
    if (!updated) throw new ConflictError('다른 관리자가 먼저 변경했습니다.');
    if (proposalId) await ClipRangeProposal.updateOne({ _id: objectId(proposalId) }, { $set: { status: 'applied', expiresAt: expiry() } }, { session });
    await ClipRangeHistory.create([{ clipId: clip._id, userId: objectId(userId),
      ...(proposalId ? { proposalId: objectId(proposalId) } : {}), before: range(clip), after: value, rangeVersion: updated.rangeVersion }], { session });
    const old = await ClipRangeHistory.find({ clipId: clip._id }).sort({ createdAt: -1, _id: -1 }).skip(20).select('_id').session(session);
    if (old.length) await ClipRangeHistory.deleteMany({ _id: { $in: old.map(h => h._id) } }).session(session);
    return updated.toObject();
  });
}
