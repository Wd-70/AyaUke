// 곡/클립 플레이리스트 + 라이브 클립(SongVideo)의 shareId를 12자 짧은 base62 토큰으로 재생성한다.
// (기존 UUID 36자 → 12자 통일). 공유된 링크가 없다는 전제로 전부 덮어쓴다.
// 사용: node scripts/db/migrate-shareids-short.mjs
import { randomBytes } from 'node:crypto';
import { getDb } from './client.mjs';

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
function shortId(length = 12) {
  let out = '';
  while (out.length < length) {
    const buf = randomBytes(length);
    for (let i = 0; i < buf.length && out.length < length; i++) {
      const v = buf[i];
      if (v < 248) out += ALPHABET[v % 62]; // 248=62*4, 편향 제거
    }
  }
  return out;
}

const COLLECTIONS = ['songvideos', 'playlists', 'clipplaylists'];
const { db, close } = await getDb();

try {
  for (const name of COLLECTIONS) {
    const coll = db.collection(name);
    const total = await coll.countDocuments({});
    if (total === 0) {
      console.log(`- ${name}: 문서 없음, 건너뜀`);
      continue;
    }
    const used = new Set();
    let ops = [];
    let processed = 0;
    const flush = async () => {
      if (ops.length === 0) return;
      await coll.bulkWrite(ops, { ordered: false });
      ops = [];
    };
    const cursor = coll.find({}, { projection: { _id: 1 } });
    for await (const doc of cursor) {
      let id = shortId();
      while (used.has(id)) id = shortId();
      used.add(id);
      ops.push({ updateOne: { filter: { _id: doc._id }, update: { $set: { shareId: id } } } });
      processed++;
      if (ops.length >= 500) await flush();
    }
    await flush();
    console.log(`✅ ${name}: ${processed}개 shareId 재생성(12자)`);
  }
} finally {
  await close();
}
