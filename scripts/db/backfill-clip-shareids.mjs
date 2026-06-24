// 기존 SongVideo(라이브 클립) 문서에 공개 URL용 shareId를 백필한다.
// 공개 URL(/clip/[shareId])에서 내부 ObjectId 노출을 없애기 위함.
// 사용: node scripts/db/backfill-clip-shareids.mjs   (또는 npm run db:backfill-clip-shareids)
import { randomUUID } from 'node:crypto';
import { getDb } from './client.mjs';

const { db, close } = await getDb();

try {
  const coll = db.collection('songvideos');
  const cursor = coll.find(
    { $or: [{ shareId: { $exists: false } }, { shareId: null }] },
    { projection: { _id: 1 } },
  );

  let processed = 0;
  let ops = [];
  const flush = async () => {
    if (ops.length === 0) return;
    await coll.bulkWrite(ops, { ordered: false });
    ops = [];
  };

  for await (const doc of cursor) {
    ops.push({ updateOne: { filter: { _id: doc._id }, update: { $set: { shareId: randomUUID() } } } });
    processed++;
    if (ops.length >= 500) await flush();
  }
  await flush();

  const remaining = await coll.countDocuments({ $or: [{ shareId: { $exists: false } }, { shareId: null }] });
  console.log(`✅ shareId 백필 완료: ${processed}개 갱신, 남은 미설정 ${remaining}개`);
} finally {
  await close();
}
