import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { BSON } from 'mongodb';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import SongVideo from './schemas/song-video.schema';
import { PersonalClipRange, ClipRangeProposal, ClipRangeVote, ClipRangeHistory } from './clip-range.schema';
import { savePersonal, getRanges, propose, evaluate, withdraw, publishOfficial } from './clip-range.service';
import { editRangeBoundary } from '@/components/clip/range/editor-policy';
import { toClipSourceTime } from '@/shared/utils/clip-time';

let mongo: MongoMemoryReplSet;
const id = () => new mongoose.Types.ObjectId().toString();
const owner = id(), admin = id();
const make = (extra: Record<string, unknown> = {}) => SongVideo.create({
  songId: id(), title: 'test', artist: 'test', platform: 'youtube', videoId: 'abcdefghijk',
  videoUrl: 'https://www.youtube.com/watch?v=abcdefghijk', sungDate: new Date(),
  addedBy: owner, addedByName: 'test', startTime: 100, endTime: 400, duration: 'PT1H', ...extra,
});
const adjusted = { startTime: 99.5, endTime: 370 };
beforeAll(async () => {
  // Never use the workspace URI: all mutations target this disposable replica set.
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri());
  await Promise.all([SongVideo.init(), PersonalClipRange.init(), ClipRangeProposal.init(), ClipRangeVote.init(), ClipRangeHistory.init()]);
}, 120_000);
afterAll(async () => { await mongoose.disconnect(); await mongo?.stop(); });
beforeEach(async () => {
  await Promise.all([SongVideo.deleteMany({}), PersonalClipRange.deleteMany({}), ClipRangeProposal.deleteMany({}), ClipRangeVote.deleteMany({}), ClipRangeHistory.deleteMany({})]);
});

describe('클립 구간 MongoDB 통합', () => {
  it('클립 기준 시작만 수정하면 개인 저장과 공유 모두 원본 종료 시각을 유지한다', async () => {
    const baseline = { startTime: 28_800.5, endTime: 28_980.5 };
    const clipId = String((await make({ ...baseline, duration: 'PT12H' }))._id);
    const value = editRangeBoundary(baseline, 'start', toClipSourceTime(-2.5, baseline.startTime));
    await savePersonal(clipId, owner, 0, value);
    const proposal = await propose(clipId, owner, 0, 0, value);
    expect((await getRanges([clipId], owner))[0].effective).toEqual({ startTime: 28_798, endTime: 28_980.5, origin: 'personal' });
    const stored = await ClipRangeProposal.findById(proposal);
    expect(stored?.startTime).toBe(28_798);
    expect(stored?.endTime).toBe(28_980.5);
    expect((await SongVideo.findById(clipId))?.endTime).toBe(28_980.5);
  });
  it('개인 설정은 한 행에 최소 필드만 저장하며 다른 사용자에게 노출하지 않는다', async () => {
    const clip = await make(), clipId = String(clip._id);
    await savePersonal(clipId, owner, 0, adjusted);
    await savePersonal(clipId, owner, 0, { ...adjusted, endTime: 365.1 });
    const rows = await PersonalClipRange.find({}).lean();
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0]).sort()).toEqual(['_id', 'clipId', 'userId', 'sourceVersion', 'startTime', 'endTime'].sort());
    expect((await getRanges([clipId], owner))[0].effective.endTime).toBe(365.1);
    expect((await getRanges([clipId], id()))[0].personal).toBeNull();
    expect((await getRanges([clipId]))[0].effective.origin).toBe('original');
    console.info('Personal range BSON bytes (decimal boundaries):', BSON.calculateObjectSize(rows[0]));
    await savePersonal(clipId, owner, 0, null);
    expect(await PersonalClipRange.countDocuments()).toBe(0);
  });
  it('양쪽 확인이 모인 제안 한 쌍만 추천하고 중복 공유·자가 평가는 방지한다', async () => {
    const clipId = String((await make())._id);
    const proposal = (await propose(clipId, owner, 0, 0, adjusted))!;
    expect(await propose(clipId, id(), 0, 0, adjusted)).toBe(proposal);
    expect(await ClipRangeProposal.countDocuments()).toBe(1);
    await expect(evaluate(clipId, owner, proposal, 1, 1)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await Promise.all([evaluate(clipId, id(), proposal, 1, 1), evaluate(clipId, id(), proposal, 1, 1)]);
    const voter = id();
    await evaluate(clipId, voter, proposal, 1, 0);
    expect((await getRanges([clipId]))[0].effective.origin).toBe('original');
    await evaluate(clipId, voter, proposal, 1, 1);
    const result = (await getRanges([clipId], voter, true))[0];
    expect(result.effective).toEqual({ ...adjusted, origin: 'community' });
    expect(result.proposals[0].support).toBe(3);
    expect(await ClipRangeVote.countDocuments()).toBe(3);
    await evaluate(clipId, id(), proposal, -1, 0);
    expect((await getRanges([clipId]))[0].effective.origin).toBe('community');
    await evaluate(clipId, id(), proposal, 0, -1);
    expect((await getRanges([clipId]))[0].effective.origin).toBe('original');
  }, 30_000);
  it('기본값과 같은 개인 설정은 저장하지 않고 명시적 고정만 예외로 둔다', async () => {
    const clipId = String((await make())._id), value = { startTime: 100, endTime: 400 };
    await savePersonal(clipId, owner, 0, value);
    expect(await PersonalClipRange.countDocuments()).toBe(0);
    await savePersonal(clipId, owner, 0, value, true);
    expect(await PersonalClipRange.countDocuments()).toBe(1);
    await savePersonal(clipId, owner, 0, value);
    expect(await PersonalClipRange.countDocuments()).toBe(0);
  });
  it('평가 취소는 행을 삭제하고 제안 수정은 이전 평가를 재사용하지 않는다', async () => {
    const clipId = String((await make())._id), voter = id();
    const proposal = (await propose(clipId, owner, 0, 0, adjusted))!;
    await evaluate(clipId, voter, proposal, 1, 1);
    await evaluate(clipId, voter, proposal, 0, 0);
    expect(await ClipRangeVote.countDocuments()).toBe(0);
    await evaluate(clipId, voter, proposal, 1, 1);
    const next = await propose(clipId, owner, 0, 0, { ...adjusted, endTime: 369 });
    expect(next).not.toBe(proposal);
    expect((await ClipRangeProposal.findById(proposal))?.status).toBe('superseded');
    expect((await ClipRangeVote.findOne({ proposalId: proposal }))?.expiresAt).toBeInstanceOf(Date);
    expect((await getRanges([clipId], owner, true))[0].proposals[0].support).toBe(0);
  });
  it('공식 등록·검증은 원자적이며 개인 설정은 유지하고 오래된 편집은 거부한다', async () => {
    const clipId = String((await make())._id);
    await savePersonal(clipId, owner, 0, { startTime: 100.1, endTime: 380 });
    const proposal = (await propose(clipId, owner, 0, 0, adjusted))!;
    await evaluate(clipId, id(), proposal, 1, 1);
    const result = await publishOfficial(clipId, admin, 0, 0, adjusted, proposal);
    expect(result?.isVerified).toBe(true);
    expect(result?.rangeVersion).toBe(1);
    expect((await getRanges([clipId]))[0].effective).toEqual({ ...adjusted, origin: 'official' });
    expect((await getRanges([clipId], owner))[0].effective.origin).toBe('personal');
    expect((await ClipRangeProposal.findById(proposal))?.status).toBe('applied');
    expect((await ClipRangeVote.findOne({ proposalId: proposal }))?.expiresAt).toBeInstanceOf(Date);
    expect(await ClipRangeHistory.countDocuments()).toBe(1);
    await expect(propose(clipId, owner, 0, 1, adjusted)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(evaluate(clipId, id(), proposal, 1, 1)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(publishOfficial(clipId, admin, 0, 0, { ...adjusted, endTime: 360 })).rejects.toMatchObject({ code: 'CONFLICT' });
    expect((await SongVideo.findById(clipId))?.endTime).toBe(370);
    expect(await ClipRangeHistory.countDocuments()).toBe(1);
  });
  it('동시에 검증을 저장하면 한 관리자만 성공하고 이력도 하나만 남는다', async () => {
    const clipId = String((await make())._id);
    const results = await Promise.allSettled([
      publishOfficial(clipId, admin, 0, 0, adjusted),
      publishOfficial(clipId, id(), 0, 0, { ...adjusted, endTime: 360 }),
    ]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(await ClipRangeHistory.countDocuments()).toBe(1);
  });
  it('일반 시간 수정은 검증을 해제하고 원본 교체만 개인 설정을 삭제한다', async () => {
    const clipId = String((await make({ isVerified: true }))._id);
    await savePersonal(clipId, owner, 0, adjusted);
    await SongVideo.findByIdAndUpdate(clipId, { endTime: 390 }, { new: true });
    expect((await SongVideo.findById(clipId))?.isVerified).toBe(false);
    expect(await PersonalClipRange.countDocuments()).toBe(1);
    const proposal = await propose(clipId, owner, 0, 1, adjusted);
    await SongVideo.findByIdAndUpdate(clipId, { videoId: 'lmnopqrstuv' }, { new: true });
    expect(await PersonalClipRange.countDocuments()).toBe(0);
    expect((await ClipRangeProposal.findById(proposal))?.status).toBe('superseded');
    expect((await SongVideo.findById(clipId))?.sourceVersion).toBe(1);
    await expect(savePersonal(clipId, owner, 0, adjusted)).rejects.toMatchObject({ code: 'CONFLICT' });
  });
  it('기존 리비전 필드 없는 문서도 수정 가능하고 관계없는 업데이트는 리비전을 바꾸지 않는다', async () => {
    const clipId = String((await make())._id);
    await SongVideo.collection.updateOne({ _id: new mongoose.Types.ObjectId(clipId) }, { $unset: { sourceVersion: '', rangeVersion: '' } });
    await SongVideo.findByIdAndUpdate(clipId, { description: 'edited' });
    expect((await getRanges([clipId]))[0].rangeVersion).toBe(0);
    await SongVideo.findByIdAndUpdate(clipId, { endTime: 390 });
    expect((await getRanges([clipId]))[0].rangeVersion).toBe(1);
  });
  it('철회·삭제와 잘못된 범위를 처리한다', async () => {
    const clipId = String((await make())._id);
    await expect(savePersonal(clipId, owner, 0, { startTime: 1, endTime: 4000 })).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(savePersonal(clipId, owner, 0, { startTime: 100, endTime: 99 })).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(savePersonal(clipId, owner, 0, { startTime: 100, endTime: null })).rejects.toMatchObject({ code: 'VALIDATION' });
    await savePersonal(clipId, owner, 0, adjusted);
    const proposal = (await propose(clipId, owner, 0, 0, adjusted))!;
    await evaluate(clipId, id(), proposal, 1, 1);
    await withdraw(clipId, owner, proposal);
    expect((await getRanges([clipId], owner, true))[0].proposals).toHaveLength(0);
    await SongVideo.findByIdAndDelete(clipId);
    expect(await PersonalClipRange.countDocuments()).toBe(0);
    expect(await ClipRangeProposal.countDocuments()).toBe(0);
    expect(await ClipRangeVote.countDocuments()).toBe(0);
  });
});
