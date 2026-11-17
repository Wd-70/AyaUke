import mongoose, { type Model } from 'mongoose';

/**
 * 관리 작업 기록 — 데이터 유지보수(점검 후 고치기·백업·복원)와 시스템 설정 변경을
 * 언제·누가·무엇을 했는지 남긴다. 기록 실패가 본 작업을 막지 않도록 조용히 넘긴다.
 */
interface IMaintenanceLog {
  action: string;
  label: string;
  by: string;
  detail: string;
  createdAt?: Date;
}

const schema = new mongoose.Schema<IMaintenanceLog>(
  {
    action: { type: String, required: true, index: true },
    label: { type: String, required: true },
    by: { type: String, default: '' },
    detail: { type: String, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
schema.index({ createdAt: -1 });

const MaintenanceLog =
  (mongoose.models.MaintenanceLog as Model<IMaintenanceLog> | undefined) ||
  mongoose.model<IMaintenanceLog>('MaintenanceLog', schema);

export interface MaintenanceLogView {
  id: string;
  action: string;
  label: string;
  by: string;
  detail: string;
  at: string | null;
}

export async function logMaintenance(action: string, label: string, by: string, detail = ''): Promise<void> {
  try {
    await MaintenanceLog.create({ action, label, by, detail: detail.slice(0, 500) });
  } catch (error) {
    console.error('관리 작업 기록 실패:', error);
  }
}

export async function listMaintenanceLogs(limit = 12): Promise<MaintenanceLogView[]> {
  const rows = await MaintenanceLog.find({}).sort({ createdAt: -1 }).limit(limit).lean();
  return rows.map((r) => ({
    id: String(r._id),
    action: r.action,
    label: r.label,
    by: r.by,
    detail: r.detail,
    at: r.createdAt ? new Date(r.createdAt).toISOString() : null,
  }));
}

/** 작업 종류별 마지막 실행 시각 (예: 마지막 백업) */
export async function lastMaintenanceAt(actions: string[]): Promise<string | null> {
  const row = await MaintenanceLog.findOne({ action: { $in: actions } }).sort({ createdAt: -1 }).lean();
  return row?.createdAt ? new Date(row.createdAt).toISOString() : null;
}
