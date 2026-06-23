import mongoose from 'mongoose';
import ClipReport, {
  type ClipReportReason,
  type ClipReportStatus,
} from './schemas/clip-report.schema';
import SongVideo from './schemas/song-video.schema';
import User from '@/models/User';
import { NotFoundError, ConflictError } from '@/shared/api/errors';

const isValidId = (id: string) => mongoose.Types.ObjectId.isValid(id);

interface CreateReportInput {
  clipId: string;
  reason: ClipReportReason;
  detail?: string;
  channelId?: string | null;
}

/** 클립 신고 생성. 로그인 사용자는 같은 클립 대기중 신고 1건으로 제한. */
export async function createClipReport({ clipId, reason, detail, channelId }: CreateReportInput) {
  if (!isValidId(clipId)) throw new NotFoundError('클립을 찾을 수 없습니다.');

  const clip = await SongVideo.findById(clipId).select('_id');
  if (!clip) throw new NotFoundError('클립을 찾을 수 없습니다.');

  let reportedBy: mongoose.Types.ObjectId | undefined;
  let reportedByName: string | undefined;
  if (channelId) {
    const user = await User.findOne({ channelId }).select('_id displayName channelName');
    if (user) {
      reportedBy = user._id as mongoose.Types.ObjectId;
      reportedByName =
        (user as { displayName?: string; channelName?: string }).displayName ||
        (user as { channelName?: string }).channelName;

      const existing = await ClipReport.findOne({ clipId, channelId, status: 'pending' });
      if (existing) throw new ConflictError('이미 신고한 클립입니다. 검토 중이에요.');
    }
  }

  return ClipReport.create({
    clipId,
    reason,
    detail,
    reportedBy,
    reportedByName,
    channelId: channelId ?? undefined,
    status: 'pending',
  });
}

export interface ReportsQuery {
  status?: ClipReportStatus | 'all';
  page: number;
  limit: number;
}

/** 관리자: 신고 목록(클립·곡 정보 조인). */
export async function listClipReports({ status = 'pending', page, limit }: ReportsQuery) {
  const match = status === 'all' ? {} : { status };
  const [items, total] = await Promise.all([
    ClipReport.find(match)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate({ path: 'clipId', select: 'title artist platform videoId startTime endTime sungDate thumbnailUrl sourceUnavailable' })
      .lean(),
    ClipReport.countDocuments(match),
  ]);

  return {
    reports: items.map((r) => ({ ...r, _id: String((r as { _id: unknown })._id) })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

/** 관리자: 대기 신고 수 (배지용). */
export async function countPendingReports(): Promise<number> {
  return ClipReport.countDocuments({ status: 'pending' });
}

/**
 * 관리자: 신고 처리.
 * action: 'resolve'(처리됨) | 'dismiss'(반려) | 'mark_unavailable'(원본 불가 표시 + 처리됨)
 */
export async function resolveClipReport(
  reportId: string,
  action: 'resolve' | 'dismiss' | 'mark_unavailable',
  adminUserId?: string,
) {
  if (!isValidId(reportId)) throw new NotFoundError('신고를 찾을 수 없습니다.');
  const report = await ClipReport.findById(reportId);
  if (!report) throw new NotFoundError('신고를 찾을 수 없습니다.');

  if (action === 'mark_unavailable') {
    await SongVideo.findByIdAndUpdate(report.clipId, {
      $set: { sourceUnavailable: true, sourceCheckedAt: new Date() },
    });
  }

  report.status = action === 'dismiss' ? 'dismissed' : 'resolved';
  report.resolvedAt = new Date();
  if (adminUserId && isValidId(adminUserId)) {
    report.resolvedBy = new mongoose.Types.ObjectId(adminUserId);
  }
  await report.save();
  return report;
}
