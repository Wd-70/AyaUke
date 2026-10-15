import mongoose, { Schema, model, models } from 'mongoose';

const id = { type: Schema.Types.ObjectId, required: true };
// Intentionally no timestamps, title, URL, profile, reason, counters or revision log.
const personalSchema = new Schema({
  userId: id, clipId: id, sourceVersion: { type: Number, required: true },
  startTime: { type: Number, required: true }, endTime: { type: Number, default: null },
}, { versionKey: false });
personalSchema.index({ userId: 1, clipId: 1 }, { unique: true });
personalSchema.index({ clipId: 1 });

const proposalSchema = new Schema({
  clipId: id, userId: id, sourceVersion: { type: Number, required: true },
  baseVersion: { type: Number, required: true }, startTime: { type: Number, required: true },
  endTime: { type: Number, required: true }, createdAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['active', 'withdrawn', 'applied', 'superseded'], default: 'active' },
  expiresAt: Date,
}, { versionKey: false });
proposalSchema.index({ clipId: 1, status: 1, baseVersion: 1 });
proposalSchema.index({ userId: 1, createdAt: -1 });
proposalSchema.index({ clipId: 1, userId: 1 }, { unique: true, partialFilterExpression: { status: 'active' } });
proposalSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const voteSchema = new Schema({
  clipId: id, proposalId: id, userId: id,
  start: { type: Number, enum: [-1, 0, 1], required: true },
  end: { type: Number, enum: [-1, 0, 1], required: true }, expiresAt: Date,
}, { versionKey: false });
voteSchema.index({ proposalId: 1, userId: 1 }, { unique: true });
voteSchema.index({ clipId: 1 });
voteSchema.index({ userId: 1 });
voteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const historySchema = new Schema({
  clipId: id, userId: id, proposalId: Schema.Types.ObjectId,
  before: { startTime: Number, endTime: Number }, after: { startTime: Number, endTime: Number },
  rangeVersion: Number, createdAt: { type: Date, default: Date.now },
}, { versionKey: false });
historySchema.index({ clipId: 1, createdAt: -1 });

export const PersonalClipRange = (models.PersonalClipRange as mongoose.Model<mongoose.InferSchemaType<typeof personalSchema>>) || model('PersonalClipRange', personalSchema);
export const ClipRangeProposal = (models.ClipRangeProposal as mongoose.Model<mongoose.InferSchemaType<typeof proposalSchema>>) || model('ClipRangeProposal', proposalSchema);
export const ClipRangeVote = (models.ClipRangeVote as mongoose.Model<mongoose.InferSchemaType<typeof voteSchema>>) || model('ClipRangeVote', voteSchema);
export const ClipRangeHistory = (models.ClipRangeHistory as mongoose.Model<mongoose.InferSchemaType<typeof historySchema>>) || model('ClipRangeHistory', historySchema);

export async function removeClipRangeData(clipIds: unknown[]) {
  const filter = { clipId: { $in: clipIds } };
  await Promise.all([PersonalClipRange.deleteMany(filter), ClipRangeProposal.deleteMany(filter),
    ClipRangeVote.deleteMany(filter), ClipRangeHistory.deleteMany(filter)]);
}
