// 방종셀카: 게시글 id 목록을 에이전트 openCollect으로 일괄 수집(원본 해상도, 날짜별 저장).
// stdin: JSON 배열 (["112976", ...] 또는 [{id:"112976"}, ...])
// stdout: 각 글 수집 결과(날짜/추가이미지수)
// 전제: dev 서버(3000) + 에이전트 ON. 토큰은 .env.local의 SELFIE_DEV_TOKEN.
// 사용: echo '["112976","97249"]' | node scripts/selfie/collect-batch.mjs
import fs from 'node:fs';

const BASE = 'http://localhost:3000';
const CLUB = '31127887';

const TOK = (fs.readFileSync('.env.local', 'utf8').match(/^SELFIE_DEV_TOKEN=(.+)$/m) || [])[1]?.trim();
if (!TOK) { console.error('.env.local 의 SELFIE_DEV_TOKEN 을 찾지 못했습니다.'); process.exit(1); }
const H = { 'X-Selfie-Token': TOK, 'Content-Type': 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function enqueue(type, payload) {
  const r = await fetch(`${BASE}/api/admin/selfie/agent/enqueue`, { method: 'POST', headers: H, body: JSON.stringify({ type, payload }) });
  return (await r.json()).command.id;
}
async function waitResult(id, maxSec = 90) {
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

const summary = [];
for (const id of ids) {
  const url = `https://cafe.naver.com/ca-fe/cafes/${CLUB}/articles/${id}`;
  const cid = await enqueue('openCollect', { url });
  const r = await waitResult(cid);
  const res = r && r.data && r.data.results && r.data.results[0];
  const date = res && res.data && res.data.date;
  const added = res && res.data && res.data.addedImages;
  summary.push({ id, date: date || null, addedImages: added ?? null, ok: !!(r && r.ok) });
  console.log(`${id}  date=${date || '?'}  +${added ?? '?'}장`);
}
fs.writeFileSync('selfie-archive/_collect_summary.json', JSON.stringify(summary, null, 2));
console.log(`\n완료: ${summary.length}글, 날짜 ${[...new Set(summary.map((s) => s.date).filter(Boolean))].length}개`);
