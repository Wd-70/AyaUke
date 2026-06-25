// 방종셀카: codex-read 출력(_x/_read/<세션>.txt)을 파싱해 로스터/사전 자동 대입 → make-review JSON 생성.
// 분류: 로스터 exact → 로스터 근접(정규화 편집거리 ≤1, Codex 자모오타 교정) → 사전 exact → 애매.
//   근접 교정분은 애매가 아니라 rosterConfident 로 넣되, stderr 에 '자동교정' 으로 모두 표기(검토 시 확인).
// NON-CHAT 으로 지목된 파일은 stderr 에 안내(Claude 가 원본 확인 후 prune).
// stdout = make-review 입력 JSON.  사용:
//   node scripts/selfie/x-build-review.mjs --session=2024-11-16_2326 | node scripts/selfie/make-review.mjs --date=2024-11-16_2326
import fs from 'node:fs';
import path from 'node:path';
import { getDb } from '../db/client.mjs';

const arg = (k) => { const m = process.argv.find((a) => a.startsWith(`--${k}=`)); return m ? m.slice(k.length + 3) : undefined; };
const session = arg('session');
if (!session) { console.error('--session=<세션키> 필요'); process.exit(1); }
const readFile = arg('read') || path.join('selfie-archive', '_x', '_read', `${session}.txt`);
if (!fs.existsSync(readFile)) { console.error(`판독 파일 없음: ${readFile}`); process.exit(1); }

const normalize = (s) => (s || '').toLowerCase().trim().replace(/\s+/g, '').replace(/[-_.,!?()[\]{}]/g, '').replace(/[^\w가-힣]/g, '');
function lev(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => i);
  for (let j = 1; j <= b.length; j++) {
    let prev = dp[0]; dp[0] = j;
    for (let i = 1; i <= a.length; i++) {
      const t = dp[i];
      dp[i] = Math.min(dp[i] + 1, dp[i - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = t;
    }
  }
  return dp[a.length];
}

// ── 판독 파일 파싱: '=== 이미지' 섹션의 닉 + NON-CHAT 파일 ──
const lines = fs.readFileSync(readFile, 'utf8').split(/\r?\n/);
const nicks = [];
const nonChat = [];
let inImg = false, inNon = false;
for (const raw of lines) {
  const ln = raw.trim();
  if (ln.startsWith('=== NON-CHAT')) { inNon = true; inImg = false; continue; }
  if (ln.startsWith('=== 이미지')) { inImg = true; continue; }
  if (ln.startsWith('===')) { continue; }
  if (inNon) {
    if (!ln || ln === '없음') continue;
    const m = ln.match(/([0-9a-f]{40})/i); // 크롭 파일명 해시
    if (m) nonChat.push(m[1]);
    continue;
  }
  if (!inImg) continue;
  if (!ln) continue;
  if (/^tokens used$/i.test(ln) || /^\d[\d,]*$/.test(ln)) continue; // codex 잡음
  nicks.push(ln);
}

// 정규화 dedup(첫 등장 철자 유지)
const seen = new Map(); // norm -> read
for (const n of nicks) { const nr = normalize(n); if (nr && !seen.has(nr)) seen.set(nr, n); }

const { db, close } = await getDb();
let rosterMap, rosterArr;
try {
  const days = await db.collection('selfiedays').find({}).toArray();
  const freq = new Map(); // norm -> Map(nickname->count)
  for (const d of days) for (const a of d.attendees || []) {
    if (!a.normalized) continue;
    if (!freq.has(a.normalized)) freq.set(a.normalized, new Map());
    const m = freq.get(a.normalized); m.set(a.nickname, (m.get(a.nickname) || 0) + 1);
  }
  rosterMap = new Map(); // norm -> 대표 nickname(최빈)
  for (const [norm, m] of freq) rosterMap.set(norm, [...m.entries()].sort((x, y) => y[1] - x[1])[0][0]);
  rosterArr = [...rosterMap.keys()];
} finally { await close(); }

const dict = JSON.parse(fs.readFileSync('selfie-archive/_nick-dict.json', 'utf8'));
const dictMap = new Map();
for (const d of dict) if (!dictMap.has(d.normalized)) dictMap.set(d.normalized, d.nickname);

const rosterConfident = [], dictConfident = [], uncertain = [], autoFixed = [];
for (const [nr, read] of seen) {
  if (rosterMap.has(nr)) { rosterConfident.push(rosterMap.get(nr)); continue; }
  // 로스터 근접(편집거리 ≤1) — Codex 자모오타 교정
  let best = null, bestD = 99;
  for (const rn of rosterArr) { const d = lev(nr, rn, 1); if (d < bestD) { bestD = d; best = rn; } if (bestD === 0) break; }
  if (best && bestD <= 1) { const canon = rosterMap.get(best); rosterConfident.push(canon); autoFixed.push(`${read} → ${canon}`); continue; }
  if (dictMap.has(nr)) { dictConfident.push(dictMap.get(nr)); continue; }
  // 로스터 d2 제안만 메모
  let s2 = null, d2 = 99;
  for (const rn of rosterArr) { const d = lev(nr, rn, 2); if (d < d2) { d2 = d; s2 = rn; } }
  uncertain.push({ value: read, note: s2 && d2 === 2 ? `로스터 ${rosterMap.get(s2)}(d2)?` : '사전/로스터 일치 없음' });
}

console.error(`[${session}] 유니크 ${seen.size} · 로스터확정 ${rosterConfident.length}(자동교정 ${autoFixed.length}) · 사전확정 ${dictConfident.length} · 애매 ${uncertain.length}`);
if (autoFixed.length) console.error('  자동교정: ' + autoFixed.join(', '));
if (uncertain.length) console.error('  애매: ' + uncertain.map((u) => u.value).join(', '));
if (nonChat.length) console.error('  ⚠ NON-CHAT 후보(원본 확인 후 prune): ' + nonChat.join(', '));
else console.error('  NON-CHAT: 없음');

process.stdout.write(JSON.stringify({ rosterConfident: [...new Set(rosterConfident)], dictConfident: [...new Set(dictConfident)], uncertain }));
