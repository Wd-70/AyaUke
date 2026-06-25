// 방종셀카: probe.json 기반으로 방종셀카 후보 X 게시물을 일괄 수집(syndication 직접, 원본 해상도).
// 후보 규칙: 게시물의 '이미지 중 하나라도' 비율이 [minRatio,maxRatio]면 셀카 후보로 보고 수집.
//   (극단 비율 배너가 섞여 있어도 셀카 비율 이미지가 있으면 그 글은 가져온다.)
// 한 게시물의 사진은 전부 받는다(채팅 아닌 건 이후 crop+codex-read 단계에서 자동 prune).
// 입력: selfie-archive/_x/probe.json + media-urls.json   출력: selfie-archive/<날짜>/ + selfieposts
// 사용: node scripts/selfie/x-collect-batch.mjs [--max-id=...] [--min-ratio=2.0] [--max-ratio=2.4] [--limit=N] [--dry]
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { getDb } from '../db/client.mjs';

const arg = (k) => { const m = process.argv.find((a) => a.startsWith(`--${k}=`)); return m ? m.slice(k.length + 3) : undefined; };
const dry = process.argv.includes('--dry');
const maxId = arg('max-id');
const minR = parseFloat(arg('min-ratio') || '2.0');
const maxR = parseFloat(arg('max-ratio') || '2.4');
const limit = arg('limit') ? parseInt(arg('limit'), 10) : Infinity;

const ARCHIVE = path.join(process.cwd(), 'selfie-archive');
const DIR = path.join(ARCHIVE, '_x');
const probe = JSON.parse(fs.readFileSync(path.join(DIR, 'probe.json'), 'utf8'));

// 후보: 이미지 비율 중 하나라도 [minR,maxR]
let cands = probe.filter((o) => !o.error && (o.ratios || []).some((r) => r >= minR && r <= maxR));
if (maxId) cands = cands.filter((c) => BigInt(c.id) <= BigInt(maxId));
cands.sort((a, b) => (a.id < b.id ? 1 : -1)); // 최신→과거
cands = cands.slice(0, limit);
console.error(`수집 후보 ${cands.length}건 (비율 ${minR}~${maxR})`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tokenOf = (id) => ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, '');
const origUrl = (m) => { const ext = (m.media_url_https.match(/\.(\w+)$/) || [, 'jpg'])[1]; return `${m.media_url_https.replace(/\.\w+$/, '')}?format=${ext}&name=orig`; };

const { db, close } = await getDb();
let posts = 0, imgsAdded = 0, skipped = 0, failed = 0;
try {
  for (const c of cands) {
    const id = c.id;
    try {
      const api = `https://cdn.syndication.twimg.com/tweet-result?id=${id}&token=${tokenOf(id)}&lang=ko`;
      const r = await fetch(api, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' } });
      if (!r.ok) { failed++; console.error(`  ${id} syndication ${r.status}`); await sleep(500); continue; }
      const tw = await r.json();
      const photos = (tw.mediaDetails || []).filter((m) => m.type === 'photo');
      if (!photos.length) { skipped++; continue; }
      const postedAt = new Date(tw.created_at);
      const date = postedAt.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
      const sourceUrl = `https://x.com/${tw.user?.screen_name || 'AyaUke_V'}/status/${id}`;

      const existing = await db.collection('selfieposts').findOne({ sourceUrl });
      const seen = new Set((existing?.images || []).map((i) => i.hash));
      const fresh = [];
      for (const m of photos) {
        const u = origUrl(m);
        const ext = (m.media_url_https.match(/\.(\w+)$/) || [, 'jpg'])[1];
        if (dry) { fresh.push({ imageUrl: u, hash: 'dry', width: m.original_info?.width, height: m.original_info?.height, ext }); continue; }
        const ir = await fetch(u);
        if (!ir.ok) { console.error(`    img ${ir.status} ${u}`); continue; }
        const bytes = Buffer.from(await ir.arrayBuffer());
        const hash = createHash('sha1').update(bytes).digest('hex');
        if (seen.has(hash)) continue;
        seen.add(hash);
        const dir = path.join(ARCHIVE, date);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, `${hash}.${ext}`), bytes);
        fresh.push({ imageUrl: u, localPath: `selfie-archive/${date}/${hash}.${ext}`, hash, width: m.original_info?.width, height: m.original_info?.height });
        await sleep(150);
      }
      if (dry) { console.error(`  [dry] ${date} ${id} 사진 ${photos.length}장`); posts++; continue; }
      if (!existing) {
        await db.collection('selfieposts').insertOne({ date, source: 'x', sourceUrl, postedAt, images: fresh, createdAt: new Date(), updatedAt: new Date() });
        posts++; imgsAdded += fresh.length;
      } else if (fresh.length) {
        await db.collection('selfieposts').updateOne({ _id: existing._id }, { $push: { images: { $each: fresh } }, $set: { date, postedAt, updatedAt: new Date() } });
        imgsAdded += fresh.length;
      } else { skipped++; }
      if ((posts + skipped) % 10 === 0) process.stderr.write(`\r  진행 ${posts + skipped + failed}/${cands.length} · 게시물 ${posts} · 이미지 ${imgsAdded}`);
      await sleep(250);
    } catch (e) { failed++; console.error(`  ${id} ERR ${e.message}`); await sleep(500); }
  }
  process.stderr.write('\n');
  console.error(`완료: 새 게시물 ${posts} · 이미지 ${imgsAdded}장 · 스킵 ${skipped} · 실패 ${failed}`);
} finally { await close(); }
