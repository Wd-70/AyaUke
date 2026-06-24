// 방종셀카: 방종셀카가 아닌 이미지(손편지·스케줄표·일러스트 등)를 회차에서 제거한다.
// selfieposts.images 에서 해당 hash 제거 + 로컬 원본/크롭 파일 삭제 → 갤러리(/selfie)에서도 사라짐.
// hash = 파일명(확장자 제외) = 크롭 파일명. 빈 게시물이 되면 그 SelfiePost는 삭제.
// 사용: node scripts/selfie/prune-images.mjs --date=2025-01-01 --hashes=9b8f9e81...,abc123...
import fs from 'node:fs';
import path from 'node:path';
import { getDb } from '../db/client.mjs';

const arg = (k) => { const m = process.argv.find((a) => a.startsWith(`--${k}=`)); return m ? m.slice(k.length + 3) : undefined; };
const date = arg('date');
const hashes = (arg('hashes') || '').split(',').map((s) => s.trim()).filter(Boolean);
if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !hashes.length) {
  console.error('--date=YYYY-MM-DD --hashes=h1,h2 (hash=크롭/파일명) 필요'); process.exit(1);
}
const hset = new Set(hashes);

const dir = path.join(process.cwd(), 'selfie-archive', date);
// 로컬 원본 + 크롭 삭제
let filesDeleted = 0;
for (const h of hashes) {
  for (const f of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
    if (f.startsWith(h)) { fs.rmSync(path.join(dir, f), { force: true }); filesDeleted++; }
  }
  const crop = path.join(dir, '_chat', `${h}.png`);
  if (fs.existsSync(crop)) { fs.rmSync(crop, { force: true }); filesDeleted++; }
}

const { db, close } = await getDb();
try {
  const posts = await db.collection('selfieposts').find({ date }).toArray();
  let removed = 0, postsDeleted = 0;
  for (const p of posts) {
    const kept = (p.images || []).filter((im) => !hset.has(im.hash));
    const took = (p.images || []).length - kept.length;
    if (!took) continue;
    removed += took;
    if (kept.length === 0) { await db.collection('selfieposts').deleteOne({ _id: p._id }); postsDeleted++; }
    else await db.collection('selfieposts').updateOne({ _id: p._id }, { $set: { images: kept } });
  }
  console.log(`✅ ${date}: 이미지 ${removed}장 DB 제거, 파일 ${filesDeleted}개 삭제${postsDeleted ? `, 빈 게시물 ${postsDeleted}개 삭제` : ''}`);
} finally {
  await close();
}
