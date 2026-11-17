import mongoose, { type Model } from 'mongoose';
import { connectDB } from '@/shared/db/mongodb';
import {
  applySiteSettingsPatch,
  normalizeSiteSettings,
  DEFAULT_SITE_SETTINGS,
  type FeatureKey,
  type SiteSettings,
  type SiteSettingsPatch,
} from './site-settings';

/** 설정은 문서 하나(key: 'site')에 담는다 */
interface ISiteSetting {
  key: string;
  features: Record<string, boolean>;
  clipDefaults: { durationTolerance: number };
  updatedBy?: string | null;
  updatedAt?: Date;
}

const schema = new mongoose.Schema<ISiteSetting>(
  {
    key: { type: String, required: true, unique: true },
    features: { type: mongoose.Schema.Types.Mixed, default: {} },
    clipDefaults: { type: mongoose.Schema.Types.Mixed, default: {} },
    updatedBy: { type: String, default: null },
  },
  { timestamps: true, minimize: false },
);

const SiteSetting =
  (mongoose.models.SiteSetting as Model<ISiteSetting> | undefined) ||
  mongoose.model<ISiteSetting>('SiteSetting', schema);

// 기능 공개 확인은 페이지 요청마다 일어나므로 잠깐 기억해 둔다(저장하면 즉시 갱신)
const TTL = 30_000;
let cache: { at: number; value: SiteSettings } | null = null;

export async function getSiteSettings(): Promise<SiteSettings> {
  if (cache && Date.now() - cache.at < TTL) return cache.value;
  try {
    await connectDB();
    const doc = await SiteSetting.findOne({ key: 'site' }).lean();
    const value = normalizeSiteSettings(doc ?? undefined);
    cache = { at: Date.now(), value };
    return value;
  } catch (error) {
    // DB 장애 때 공개 페이지까지 막지 않도록 기본값(=기존 동작)으로
    console.error('사이트 설정을 읽지 못해 기본값을 씁니다:', error);
    return cache?.value ?? DEFAULT_SITE_SETTINGS;
  }
}

export async function saveSiteSettings(patch: SiteSettingsPatch, by: string): Promise<SiteSettings> {
  await connectDB();
  const current = normalizeSiteSettings(await SiteSetting.findOne({ key: 'site' }).lean());
  const next = applySiteSettingsPatch(current, patch);
  const doc = await SiteSetting.findOneAndUpdate(
    { key: 'site' },
    { $set: { features: next.features, clipDefaults: next.clipDefaults, updatedBy: by } },
    { upsert: true, new: true },
  ).lean();
  const value = normalizeSiteSettings(doc);
  cache = { at: Date.now(), value };
  return value;
}

export async function isFeatureOpen(key: FeatureKey): Promise<boolean> {
  return (await getSiteSettings()).features[key];
}
