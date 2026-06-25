// 방종셀카: probe.json 기반 X 방종셀카 후보를 '게시글 1건 = 세션 1개'로 일괄 수집.
// 세션키/폴더 = <방송일>_<HHMM>  (방송일: 새벽~정오(00:00~11:59) 종료 셀카는 전날로 라벨, HHMM=게시 KST 시각)
//   병합 안 함 — 가까운 시각 게시글은 폴더명 시각으로 사람이 판단(같은 방송이면 검토 때 합치기).
// 후보 규칙: 게시물 이미지 중 하나라도 비율 [minRatio,maxRatio] → 수집(극단 배너 섞여도 셀카 있으면 포함).
// 한 게시물의 사진은 전부 받음(채팅 아닌 건 이후 codex-read NON-CHAT → prune).
// 출력: selfie-archive/<세션키>/<hash>.<ext> + selfieposts(date=세션키) + selfie-archive/_x/sessions.json
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

let cands = probe.filter((o) => !o.error && (o.ratios || []).some((r) => r >= minR && r <= maxR));
if (maxId) cands = cands.filter((c) => BigInt(c.id) <= BigInt(maxId));
cands.sort((a, b) => (a.id < b.id ? 1 : -1)); // 최신→과거
cands = cands.slice(0, limit);
console.error(`수집 후보 ${cands.length}건 (비율 ${minR}~${maxR})`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tokenOf = (id) => ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, '');
const origUrl = (m) => { const ext = (m.media_url_https.match(/\.(\w+)$/) || [, 'jpg'])[1]; return `${m.media_url_https.replace(/\.\w+$/, '')}?format=${ext}&name=orig`; };

/** 게시 시각(ISO) → { sessionKey:<방송일>_<HHMM>, broadcastDate, hhmm }. 00:00~11:59 종료는 전날. */
function sessionKeyFor(iso) {
  const kst = new Date(new Date(iso).getTime() + 9 * 3600 * 1000); // UTC 필드 = KST 벽시계
  const H = kst.getUTCHours(), Mi = kst.getUTCMinutes();
  const bd = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()));
  if (H < 12) bd.setUTCDate(bd.getUTCDate() - 1); // 새벽~정오 = 전날 방송
  const broadcastDate = bd.toISOString().slice(0, 10);
  const hhmm = String(H).padStart(2, '0') + String(Mi).padStart(2, '0');
  return { sessionKey: `${broadcastDate}_${hhmm}`, broadcastDate, hhmm };
}

const { db, close } = await getDb();
const usedKeys = new Set();
const manifest = [];
let sessions = 0, imgs = 0, skipped = 0, failed = 0;
try {
  for (const c of cands) {
    const id = c.id;
    try {
      const r = await fetch(`https://cdn.syndication.twimg.com/tweet-result?id=${id}&token=${tokenOf(id)}&lang=ko`, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' } });
      if (!r.ok) { failed++; console.error(`  ${id} syndication ${r.status}`); await sleep(600); continue; }
      const tw = await r.json();
      const photos = (tw.mediaDetails || []).filter((m) => m.type === 'photo');
      if (!photos.length) { skipped++; continue; }
      const postedAt = new Date(tw.created_at);
      let { sessionKey, broadcastDate, hhmm } = sessionKeyFor(tw.created_at);
      while (usedKeys.has(sessionKey)) sessionKey += 'b'; // 동일 분(分) 충돌 방지
      usedKeys.add(sessionKey);
      const sourceUrl = `https://x.com/${tw.user?.screen_name || 'AyaUke_V'}/status/${id}`;
      manifest.push({ sessionKey, broadcastDate, hhmm, id, sourceUrl, postedAt: postedAt.toISOString(), photoCount: photos.length, text: (tw.text || '').replace(/\s+/g, ' ').slice(0, 50) });

      if (dry) { sessions++; continue; }
      const fresh = [];
      for (const m of photos) {
        const u = origUrl(m);
        const ext = (m.media_url_https.match(/\.(\w+)$/) || [, 'jpg'])[1];
        const ir = await fetch(u);
        if (!ir.ok) { console.error(`    img ${ir.status} ${u}`); continue; }
        const bytes = Buffer.from(await ir.arrayBuffer());
        const hash = createHash('sha1').update(bytes).digest('hex');
        const dir = path.join(ARCHIVE, sessionKey);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, `${hash}.${ext}`), bytes);
        fresh.push({ imageUrl: u, localPath: `selfie-archive/${sessionKey}/${hash}.${ext}`, hash, width: m.original_info?.width, height: m.original_info?.height });
        await sleep(150);
      }
      await db.collection('selfieposts').updateOne(
        { sourceUrl },
        { $set: { date: sessionKey, source: 'x', sourceUrl, postedAt, images: fresh, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
        { upsert: true },
      );
      sessions++; imgs += fresh.length;
      if (sessions % 10 === 0) process.stderr.write(`\r  진행 ${sessions + skipped + failed}/${cands.length} · 세션 ${sessions} · 이미지 ${imgs}`);
      await sleep(250);
    } catch (e) { failed++; console.error(`  ${id} ERR ${e.message}`); await sleep(600); }
  }
  process.stderr.write('\n');
  manifest.sort((a, b) => (a.sessionKey < b.sessionKey ? 1 : -1));
  fs.writeFileSync(path.join(DIR, 'sessions.json'), JSON.stringify(manifest, null, 0), 'utf8');
  console.error(`완료: 세션 ${sessions} · 이미지 ${imgs}장 · 스킵 ${skipped} · 실패 ${failed} · manifest=selfie-archive/_x/sessions.json`);
} finally { await close(); }
