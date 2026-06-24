// 방종셀카: 게시글 id 목록을 받아 에이전트 peek으로 본문 이미지(첫 장)만 수집한다(ingest 없음).
// stdin: JSON 배열 (["107774", ...] 또는 [{id:"107774"}, ...])
// stdout: JSON 배열 [{ id, postedAt, imageCount, imageUrl(첫 장) }]
// 전제: dev 서버(3000) + 에이전트 ON. 토큰은 .env.local의 SELFIE_DEV_TOKEN.
// 사용: echo '["107774","123938"]' | node scripts/selfie/peek-batch.mjs > peek.json
import fs from 'node:fs';

const BASE = 'http://localhost:3000';
const CLUB = '31127887';
const BATCH = Number(process.env.PEEK_BATCH || 8);

const TOK = (fs.readFileSync('.env.local', 'utf8').match(/^SELFIE_DEV_TOKEN=(.+)$/m) || [])[1]?.trim();
if (!TOK) { console.error('.env.local 의 SELFIE_DEV_TOKEN 을 찾지 못했습니다.'); process.exit(1); }
const H = { 'X-Selfie-Token': TOK, 'Content-Type': 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function enqueue(type, payload) {
  const r = await fetch(`${BASE}/api/admin/selfie/agent/enqueue`, { method: 'POST', headers: H, body: JSON.stringify({ type, payload }) });
  return (await r.json()).command.id;
}
async function waitResult(id, maxSec = 180) {
  for (let i = 0; i < maxSec / 2; i++) {
    const r = await fetch(`${BASE}/api/admin/selfie/agent/result?id=${id}`, { headers: { 'X-Selfie-Token': TOK } });
    const j = await r.json();
    if (j.result) return j.result;
    await sleep(2000);
  }
  return null;
}

let raw = '';
for await (const c of process.stdin) raw += c;
const ids = JSON.parse(raw || '[]').map((x) => (typeof x === 'string' ? x : x.id)).filter(Boolean);
if (!ids.length) { console.error('id 목록이 비었습니다.'); process.exit(1); }

const out = [];
for (let i = 0; i < ids.length; i += BATCH) {
  const chunk = ids.slice(i, i + BATCH);
  const urls = chunk.map((id) => `https://cafe.naver.com/ca-fe/cafes/${CLUB}/articles/${id}`);
  const cid = await enqueue('peek', { urls });
  const r = await waitResult(cid);
  const rs = (r && r.data && r.data.results) || [];
  for (const x of rs) {
    const id = (x.url.match(/articles\/(\d+)/) || [])[1];
    out.push({ id, postedAt: x.postedAt || null, imageCount: x.imageCount || 0, imageUrl: (x.images && x.images[0]) || '' });
  }
  process.stderr.write(`peek ${Math.min(i + BATCH, ids.length)}/${ids.length}\n`);
}
process.stdout.write(JSON.stringify(out));
