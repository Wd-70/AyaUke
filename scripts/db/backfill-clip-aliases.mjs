// 기존 SongVideo(라이브 클립)에 SongDetail의 titleAlias/artistAlias를 비정규화 백필한다.
// 클립 표시를 노래책과 일관되게 별칭 우선으로 보여주기 위함.
// (SongVideo.songId === SongDetail._id 문자열)
// 사용: node scripts/db/backfill-clip-aliases.mjs
import { getDb } from './client.mjs';

const { db, close } = await getDb();

try {
  const songs = db.collection('songdetails');
  const clips = db.collection('songvideos');

  // songId → { titleAlias, artistAlias } 맵 구성 (별칭이 하나라도 있는 곡만)
  const detailDocs = await songs
    .find({ $or: [{ titleAlias: { $nin: [null, ''] } }, { artistAlias: { $nin: [null, ''] } }] })
    .project({ titleAlias: 1, artistAlias: 1 })
    .toArray();

  const aliasMap = new Map();
  for (const d of detailDocs) {
    aliasMap.set(String(d._id), {
      titleAlias: d.titleAlias || undefined,
      artistAlias: d.artistAlias || undefined,
    });
  }
  console.log(`별칭 보유 곡: ${aliasMap.size}개`);

  const cursor = clips.find({}).project({ songId: 1, titleAlias: 1, artistAlias: 1 });
  const ops = [];
  let scanned = 0;
  let planned = 0;

  for await (const c of cursor) {
    scanned++;
    const a = aliasMap.get(String(c.songId));
    const set = {};
    const unset = {};
    // 곡에 별칭이 있으면 채우고(값이 다르면), 곡에서 별칭이 사라졌으면 클립에서도 제거
    const wantTitle = a?.titleAlias;
    const wantArtist = a?.artistAlias;
    if (wantTitle) { if (c.titleAlias !== wantTitle) set.titleAlias = wantTitle; }
    else if (c.titleAlias != null) unset.titleAlias = '';
    if (wantArtist) { if (c.artistAlias !== wantArtist) set.artistAlias = wantArtist; }
    else if (c.artistAlias != null) unset.artistAlias = '';

    const update = {};
    if (Object.keys(set).length) update.$set = set;
    if (Object.keys(unset).length) update.$unset = unset;
    if (Object.keys(update).length) {
      ops.push({ updateOne: { filter: { _id: c._id }, update } });
      planned++;
    }
    if (ops.length >= 500) {
      await clips.bulkWrite(ops);
      ops.length = 0;
    }
  }
  if (ops.length) await clips.bulkWrite(ops);

  console.log(`클립 스캔 ${scanned}개, 업데이트 ${planned}개 완료`);
} finally {
  await close();
}
