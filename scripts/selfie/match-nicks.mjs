// 방종셀카: OCR 판독 닉을 보조 사전(_nick-dict.json)의 원본 철자로 매칭/교정한다.
// stdin: JSON 배열. 요소는
//   - 문자열  "단하루"            → 단일 판독
//   - 배열    ["솔레트","슐러튼"]  → 한 자리의 여러 후보(헷갈릴 때). 후보 전부 검색해 best를 고른다.
// stdout: JSON [{candidates, suggestion, matchedFrom, vodCount, dist, tier}]
//   tier: exact(정규화 완전일치 — |,공백,문장부호 흡수) / near(거리1) / maybe(거리2) / none
// 핵심: 헷갈리면 후보를 여러 개 넣어라. 정답 철자가 사전에 있으면 그 후보만 exact로 떠서 정답이 드러난다.
import fs from 'node:fs';

const DICT = 'selfie-archive/_nick-dict.json';
if (!fs.existsSync(DICT)) { console.error('_nick-dict.json 없음 — build-nick-dict.mjs 먼저 실행.'); process.exit(1); }
const dict = JSON.parse(fs.readFileSync(DICT, 'utf8'));
const normalize = (s) => (s || '').toLowerCase().trim().replace(/\s+/g, '').replace(/[-_.,!?()[\]{}]/g, '').replace(/[^\w가-힣]/g, '');

const exactIdx = new Map();
for (const d of dict) if (!exactIdx.has(d.normalized)) exactIdx.set(d.normalized, d);

function lev(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (cur[j] < best) best = cur[j];
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

const TIER_RANK = { exact: 0, near: 1, maybe: 2 };

/** 한 판독에 대해 dist<=2 인 사전 후보 전부(전혀 안 비슷한 건 제외) — dist asc, vodCount desc */
function matchAll(read) {
  const nr = normalize(read);
  if (!nr) return [];
  const hits = [];
  for (const d of dict) {
    if (Math.abs(d.normalized.length - nr.length) > 2) continue;
    const dist = lev(nr, d.normalized, 2);
    if (dist > 2) continue;
    hits.push({ nickname: d.nickname, vodCount: d.vodCount, dist });
  }
  hits.sort((a, b) => a.dist - b.dist || b.vodCount - a.vodCount);
  return hits;
}

/** 단일 판독 → best 사전 매칭(없으면 null) */
function matchOne(read) {
  const nr = normalize(read);
  if (!nr) return null;
  const ex = exactIdx.get(nr);
  if (ex) return { read, suggestion: ex.nickname, vodCount: ex.vodCount, dist: 0, tier: 'exact' };
  const all = matchAll(read);
  if (!all.length) return null;
  const best = all[0];
  return { read, suggestion: best.nickname, vodCount: best.vodCount, dist: best.dist, tier: best.dist === 1 ? 'near' : 'maybe' };
}

/**
 * 후보 그룹 매칭.
 * - 후보가 여러 개면(헷갈림): **exact만 신뢰**. exact가 있으면 그게 정답(사전의 단골). 없으면 none.
 *   (정답이 사전에 없을 때 fuzzy로 엉뚱하게 빠지는 것을 막는다.)
 * - 후보가 1개면(단일 판독): fuzzy(near/maybe)도 힌트로 반환.
 */
function matchGroup(cands) {
  const exacts = [];
  let fuzzyBest = null;
  // 모든 후보의 사전 매칭 합집합(dist<=2) — 닉 기준 dedup, 가장 가까운 dist 유지
  const pool = new Map();
  for (const c of cands) {
    for (const h of matchAll(c)) {
      const cur = pool.get(h.nickname);
      if (!cur || h.dist < cur.dist) pool.set(h.nickname, h);
    }
    const m = matchOne(c);
    if (!m) continue;
    if (m.tier === 'exact') exacts.push({ ...m, matchedFrom: c });
    else if (!fuzzyBest || TIER_RANK[m.tier] < TIER_RANK[fuzzyBest.tier] || (TIER_RANK[m.tier] === TIER_RANK[fuzzyBest.tier] && m.vodCount > fuzzyBest.vodCount)) {
      fuzzyBest = { ...m, matchedFrom: c };
    }
  }
  const matches = [...pool.values()].sort((a, b) => a.dist - b.dist || b.vodCount - a.vodCount).slice(0, 8);
  if (exacts.length) {
    const best = exacts.sort((a, b) => b.vodCount - a.vodCount)[0];
    return { candidates: cands, suggestion: best.suggestion, matchedFrom: best.matchedFrom, vodCount: best.vodCount, dist: 0, tier: 'exact', matches };
  }
  if (cands.length === 1 && fuzzyBest) {
    return { candidates: cands, suggestion: fuzzyBest.suggestion, matchedFrom: fuzzyBest.matchedFrom, vodCount: fuzzyBest.vodCount, dist: fuzzyBest.dist, tier: fuzzyBest.tier, matches };
  }
  return { candidates: cands, tier: 'none', matches };
}

let raw = '';
for await (const c of process.stdin) raw += c;
const items = JSON.parse(raw || '[]');
const results = items.map((it) => {
  const cands = Array.isArray(it) ? it : [it];
  return matchGroup(cands);
});
process.stdout.write(JSON.stringify(results));
