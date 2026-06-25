// 방종셀카: X(트위터) 게시물을 공개 syndication API로 직접 수집(확장/로그인 불필요).
// status URL/ID → 본문·작성일·원본 해상도 이미지 → selfie-archive/<KST날짜>/ 저장 + selfieposts upsert.
// (cdn.syndication.twimg.com/tweet-result : react-tweet가 쓰는 무인증 엔드포인트)
// 사용: node scripts/selfie/collect-x.mjs --url=https://x.com/AyaUke_V/status/1857792403681456419
//       node scripts/selfie/collect-x.mjs --id=1857792403681456419 [--dry]
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { getDb } from '../db/client.mjs';

const arg = (k) => { const m = process.argv.find((a) => a.startsWith(`--${k}=`)); return m ? m.slice(k.length + 3) : undefined; };
const dry = process.argv.includes('--dry');
const url = arg('url');
let id = arg('id');
if (!id && url) { const m = url.match(/status\/(\d{15,25})/); if (m) id = m[1]; }
if (!id || !/^\d{15,25}$/.test(id)) { console.error('--url=<status URL> 또는 --id=<숫자ID> 가 필요합니다.'); process.exit(1); }

const ARCHIVE = path.join(process.cwd(), 'selfie-archive');
const token = ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, '');
const api = `https://cdn.syndication.twimg.com/tweet-result?id=${id}&token=${token}&lang=ko`;

const res = await fetch(api, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' } });
if (!res.ok) { console.error(`syndication API 실패: HTTP ${res.status}`); process.exit(1); }
const tw = await res.json();
if (!tw || tw.__typename === 'TweetTombstone') { console.error('삭제/비공개 트윗이거나 데이터 없음.'); process.exit(1); }

const postedAt = new Date(tw.created_at); // ISO UTC
const date = postedAt.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }); // YYYY-MM-DD (KST)
const sourceUrl = `https://x.com/${tw.user?.screen_name || 'i'}/status/${id}`;
const photos = (tw.mediaDetails || []).filter((m) => m.type === 'photo');
if (!photos.length) { console.error('이 트윗에 사진이 없습니다(영상/텍스트뿐).'); process.exit(1); }

const origUrl = (m) => {
  const ext = (m.media_url_https.match(/\.(\w+)$/) || [, 'jpg'])[1];
  return `${m.media_url_https.replace(/\.\w+$/, '')}?format=${ext}&name=orig`;
};

console.error(`[collect-x] ${id} · ${tw.user?.screen_name} · ${date} (KST) · 사진 ${photos.length}장`);
console.error(`  본문: ${(tw.text || '').replace(/\s+/g, ' ').slice(0, 80)}…`);

const images = [];
for (const m of photos) {
  const u = origUrl(m);
  const r = await fetch(u);
  if (!r.ok) { console.error(`  이미지 실패 ${r.status}: ${u}`); continue; }
  const bytes = Buffer.from(await r.arrayBuffer());
  const hash = createHash('sha1').update(bytes).digest('hex');
  const ext = (m.media_url_https.match(/\.(\w+)$/) || [, 'jpg'])[1];
  const rel = `selfie-archive/${date}/${hash}.${ext}`;
  images.push({ bytes, image: { imageUrl: u, localPath: rel, hash, ext, width: m.original_info?.width, height: m.original_info?.height } });
}
if (!images.length) { console.error('다운로드된 이미지가 없습니다.'); process.exit(1); }

console.log(`${date} · ${sourceUrl}`);
for (const { image } of images) console.log(`  ${image.hash}  ${image.width}x${image.height}`);

if (dry) { console.log('[--dry] 저장/DB 기록 안 함'); process.exit(0); }

const dir = path.join(ARCHIVE, date);
fs.mkdirSync(dir, { recursive: true });
for (const { bytes, image } of images) fs.writeFileSync(path.join(dir, `${image.hash}.${image.ext}`), bytes);

const { db, close } = await getDb();
try {
  const existing = await db.collection('selfieposts').findOne({ sourceUrl });
  const seen = new Set((existing?.images || []).map((i) => i.hash));
  const fresh = images.map(({ image }) => ({ imageUrl: image.imageUrl, localPath: image.localPath, hash: image.hash, width: image.width, height: image.height }))
    .filter((i) => !seen.has(i.hash));
  if (!existing) {
    await db.collection('selfieposts').insertOne({ date, source: 'x', sourceUrl, postedAt, images: fresh, createdAt: new Date(), updatedAt: new Date() });
    console.log(`✅ ${date}: SelfiePost 생성 · 이미지 ${fresh.length}장 (source=x)`);
  } else if (fresh.length) {
    await db.collection('selfieposts').updateOne({ _id: existing._id }, { $push: { images: { $each: fresh } }, $set: { date, postedAt, updatedAt: new Date() } });
    console.log(`✅ ${date}: 기존 게시물에 이미지 ${fresh.length}장 추가`);
  } else {
    console.log(`· ${date}: 새 이미지 없음(이미 수집됨)`);
  }
} finally { await close(); }
