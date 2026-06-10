// 공용 MongoDB 연결 헬퍼 (scripts 전용, 앱 번들에 포함되지 않음)
// 사용: const { db, close } = await getDb();
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(path.join(projectRoot, 'package.json'));
const { MongoClient } = require('mongodb');

export function loadMongoUri() {
  const override = process.argv.find((a) => a.startsWith('--uri='));
  if (override) return override.slice('--uri='.length);
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;

  const envPath = path.join(projectRoot, '.env.local');
  if (!fs.existsSync(envPath)) {
    throw new Error('.env.local이 없고 MONGODB_URI 환경변수도 없습니다. --uri=<...>로 지정하세요.');
  }
  const match = fs.readFileSync(envPath, 'utf8').match(/^MONGODB_URI=(.+)$/m);
  if (!match) throw new Error('.env.local에서 MONGODB_URI를 찾을 수 없습니다.');
  return match[1].trim();
}

export async function getDb() {
  const uri = loadMongoUri();
  const client = new MongoClient(uri);
  await client.connect();
  const dbName = new URL(uri.replace('mongodb+srv://', 'https://')).pathname.replace(/^\//, '') || undefined;
  const db = client.db(dbName);
  return { client, db, close: () => client.close() };
}

export { projectRoot };
