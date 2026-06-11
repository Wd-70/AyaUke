import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import { EJSON } from 'bson';
import { AppError, NotFoundError, ValidationError } from '@/shared/api/errors';

/**
 * 로컬 디스크 기반 DB 백업 관리.
 *
 * 운영 환경(Vercel)은 파일시스템이 읽기 전용·휘발성이라 사용할 수 없고,
 * 로컬 서버로 띄웠을 때만 동작한다. (다운로드 내보내기는 backup.service.ts가 담당)
 *
 * 저장 형식: ./backups/<ISO타임스탬프>/<collection>.jsonl  (EJSON, 1줄 1문서)
 *           + _manifest.json (생성시각/컬렉션별 문서수·크기)
 * scripts/db/backup.mjs 와 동일한 포맷이라 CLI 백업과 호환된다.
 */

const EXCLUDED_COLLECTIONS = new Set(['backups', 'backup_logs']);
const BACKUP_ROOT = path.join(process.cwd(), 'backups');
/** 백업 디렉터리 이름은 항상 ISO 타임스탬프 — 경로 탈출 방지용 패턴 */
const NAME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/;

export interface BackupCollectionInfo {
  collection: string;
  documents: number;
  sizeMB: number;
}

interface BackupManifest {
  createdAt: string;
  collections: BackupCollectionInfo[];
}

export interface BackupInfo extends BackupManifest {
  name: string;
  totalSizeMB: number;
  totalDocuments: number;
}

/** Vercel 등 서버리스가 아니면 로컬로 간주 */
export function isLocalEnvironment(): boolean {
  return !process.env.VERCEL;
}

function assertLocal(): void {
  if (!isLocalEnvironment()) {
    throw new AppError('NOT_LOCAL', '로컬 서버에서만 사용할 수 있는 기능입니다.', 400);
  }
}

/** 백업 이름을 검증하고 안전한 절대 경로로 변환 (디렉터리 탈출 차단) */
function resolveBackupDir(name: string): string {
  if (!NAME_PATTERN.test(name)) throw new ValidationError('잘못된 백업 이름입니다.');
  const dir = path.join(BACKUP_ROOT, name);
  if (path.dirname(dir) !== BACKUP_ROOT) throw new ValidationError('잘못된 백업 경로입니다.');
  return dir;
}

function toBackupInfo(name: string, manifest: BackupManifest): BackupInfo {
  return {
    name,
    ...manifest,
    totalSizeMB: +manifest.collections.reduce((sum, c) => sum + c.sizeMB, 0).toFixed(2),
    totalDocuments: manifest.collections.reduce((sum, c) => sum + c.documents, 0),
  };
}

/** 전체 컬렉션을 로컬 디스크에 백업 */
export async function saveBackupToDisk(): Promise<BackupInfo> {
  assertLocal();
  const db = mongoose.connection.db!;

  const collections = (await db.listCollections().toArray())
    .map((c) => c.name)
    .filter((name) => !EXCLUDED_COLLECTIONS.has(name) && !name.startsWith('system.'))
    .sort();

  const name = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const dir = path.join(BACKUP_ROOT, name);
  await fsp.mkdir(dir, { recursive: true });

  const summary: BackupCollectionInfo[] = [];
  for (const coll of collections) {
    const outPath = path.join(dir, `${coll}.jsonl`);
    const stream = fs.createWriteStream(outPath);
    let count = 0;
    for await (const doc of db.collection(coll).find()) {
      stream.write(EJSON.stringify(doc) + '\n');
      count++;
    }
    await new Promise<void>((resolve, reject) =>
      stream.end((err?: Error | null) => (err ? reject(err) : resolve())),
    );
    const sizeMB = +((await fsp.stat(outPath)).size / 1048576).toFixed(2);
    summary.push({ collection: coll, documents: count, sizeMB });
  }

  const manifest: BackupManifest = { createdAt: new Date().toISOString(), collections: summary };
  await fsp.writeFile(path.join(dir, '_manifest.json'), JSON.stringify(manifest, null, 2));

  return toBackupInfo(name, manifest);
}

/** 저장된 로컬 백업 목록 (최신 먼저) */
export async function listLocalBackups(): Promise<BackupInfo[]> {
  if (!fs.existsSync(BACKUP_ROOT)) return [];

  const entries = await fsp.readdir(BACKUP_ROOT, { withFileTypes: true });
  const backups: BackupInfo[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || !NAME_PATTERN.test(entry.name)) continue;

    const manifestPath = path.join(BACKUP_ROOT, entry.name, '_manifest.json');
    try {
      const manifest = JSON.parse(await fsp.readFile(manifestPath, 'utf8')) as BackupManifest;
      backups.push(toBackupInfo(entry.name, manifest));
    } catch {
      // manifest 누락·손상: 이름만으로 최소 표시
      backups.push({ name: entry.name, createdAt: '', collections: [], totalSizeMB: 0, totalDocuments: 0 });
    }
  }

  return backups.sort((a, b) => b.name.localeCompare(a.name));
}

/** 로컬 백업 삭제 */
export async function deleteLocalBackup(name: string): Promise<void> {
  assertLocal();
  const dir = resolveBackupDir(name);
  if (!fs.existsSync(dir)) throw new NotFoundError('백업을 찾을 수 없습니다.');
  await fsp.rm(dir, { recursive: true, force: true });
}

export interface RestoreResult {
  restored: Array<{ collection: string; documents: number }>;
}

/**
 * 백업 스냅샷으로 DB 복원 (파괴적).
 * 백업에 포함된 각 컬렉션을 비우고 백업 문서로 교체한다.
 * 인덱스는 유지하기 위해 drop 대신 deleteMany 사용.
 */
export async function restoreBackup(name: string): Promise<RestoreResult> {
  assertLocal();
  const dir = resolveBackupDir(name);
  if (!fs.existsSync(dir)) throw new NotFoundError('백업을 찾을 수 없습니다.');

  const manifest = JSON.parse(
    await fsp.readFile(path.join(dir, '_manifest.json'), 'utf8'),
  ) as BackupManifest;
  const db = mongoose.connection.db!;

  const restored: Array<{ collection: string; documents: number }> = [];
  for (const { collection } of manifest.collections) {
    // 폐기된 인-DB 백업 잔재(backups/backup_logs)는 복원하지 않음
    // (과거 CLI 스크립트 백업에 포함돼 있을 수 있음)
    if (EXCLUDED_COLLECTIONS.has(collection)) continue;

    const filePath = path.join(dir, `${collection}.jsonl`);
    if (!fs.existsSync(filePath)) continue;

    const content = await fsp.readFile(filePath, 'utf8');
    const docs = content
      .split('\n')
      .filter(Boolean)
      .map((line) => EJSON.parse(line) as Record<string, unknown>);

    await db.collection(collection).deleteMany({});
    const batchSize = 1000;
    for (let i = 0; i < docs.length; i += batchSize) {
      await db.collection(collection).insertMany(docs.slice(i, i + batchSize), { ordered: false });
    }
    restored.push({ collection, documents: docs.length });
  }

  return { restored };
}
