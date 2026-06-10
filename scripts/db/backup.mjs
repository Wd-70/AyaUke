// 전체/선택 컬렉션을 로컬 JSONL 파일로 백업 (DB 쓰기 없음)
//
// 사용법:
//   node scripts/db/backup.mjs                  # 전체 컬렉션
//   node scripts/db/backup.mjs songdetails users  # 지정 컬렉션만
//
// 출력: ./backups/<ISO날짜시각>/<collection>.jsonl  (EJSON, 1줄 1문서)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { getDb, projectRoot } from './client.mjs';

const require = createRequire(path.join(projectRoot, 'package.json'));
const { EJSON } = require('bson');

const requested = process.argv.slice(2).filter((a) => !a.startsWith('--'));

const { db, close } = await getDb();
try {
  const all = (await db.listCollections().toArray()).map((c) => c.name);
  const targets = requested.length ? requested : all;
  const missing = targets.filter((t) => !all.includes(t));
  if (missing.length) throw new Error(`존재하지 않는 컬렉션: ${missing.join(', ')}`);

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outDir = path.join(projectRoot, 'backups', stamp);
  fs.mkdirSync(outDir, { recursive: true });

  const summary = [];
  for (const name of targets) {
    const outPath = path.join(outDir, `${name}.jsonl`);
    const stream = fs.createWriteStream(outPath);
    let count = 0;
    for await (const doc of db.collection(name).find()) {
      stream.write(EJSON.stringify(doc) + '\n');
      count++;
    }
    await new Promise((resolve, reject) => stream.end((e) => (e ? reject(e) : resolve())));
    const sizeMB = +(fs.statSync(outPath).size / 1048576).toFixed(2);
    summary.push({ collection: name, documents: count, sizeMB });
    console.error(`  ✓ ${name}: ${count} docs (${sizeMB} MB)`);
  }

  fs.writeFileSync(
    path.join(outDir, '_manifest.json'),
    JSON.stringify({ createdAt: new Date().toISOString(), collections: summary }, null, 2),
  );
  console.log(JSON.stringify({ outDir, collections: summary }, null, 2));
} finally {
  await close();
}
