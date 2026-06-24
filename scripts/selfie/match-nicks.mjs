// 방종셀카: OCR 판독 닉을 보조 사전(_nick-dict.json)의 원본 철자로 매칭/교정한다.
// stdin: JSON 문자열 배열 (내 판독들)
// stdout: JSON [{read, suggestion, vodCount, dist, tier}]
//   tier: exact(정규화 완전일치 — |,공백,문장부호 차이 흡수) / near(거리1) / maybe(거리2) / none
// 정규화 일치는 사실상 확정, near는 단골(vodCount 높음)일수록 신뢰.
import fs from 'node:fs';

const DICT = 'selfie-archive/_nick-dict.json';
if (!fs.existsSync(DICT)) { console.error('_nick-dict.json 없음 — build-nick-dict.mjs 먼저 실행.'); process.exit(1); }
const dict = JSON.parse(fs.readFileSync(DICT, 'utf8'));
const normalize = (s) => (s || '').toLowerCase().trim().replace(/\s+/g, '').replace(/[-_.,!?()[\]{}]/g, '').replace(/[^\w가-힣]/g, '');

// 정규화 인덱스(완전일치 빠르게)
const exactIdx = new Map();
for (const d of dict) if (!exactIdx.has(d.normalized)) exactIdx.set(d.normalized, d);

function lev(a, b, max) {
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > max) return max + 1;
  let prev = Array.from({ length: lb + 1 }, (_, i) => i);
  for (let i = 1; i <= la; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (cur[j] < best) best = cur[j];
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[lb];
}

let raw = '';
for await (const c of process.stdin) raw += c;
const reads = JSON.parse(raw || '[]');

const results = reads.map((read) => {
  const nr = normalize(read);
  if (!nr) return { read, tier: 'none' };
  const ex = exactIdx.get(nr);
  if (ex) return { read, suggestion: ex.nickname, vodCount: ex.vodCount, dist: 0, tier: 'exact' };
  let best = null;
  for (const d of dict) {
    if (Math.abs(d.normalized.length - nr.length) > 2) continue;
    const dist = lev(nr, d.normalized, 2);
    if (dist > 2) continue;
    if (!best || dist < best.dist || (dist === best.dist && d.vodCount > best.vodCount)) best = { d, dist };
  }
  if (best) return { read, suggestion: best.d.nickname, vodCount: best.d.vodCount, dist: best.dist, tier: best.dist === 1 ? 'near' : 'maybe' };
  return { read, tier: 'none' };
});

process.stdout.write(JSON.stringify(results));
