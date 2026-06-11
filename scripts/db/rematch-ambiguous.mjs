// 애매한(60~95%) 미매칭 곡을 제목 변형 다중 매칭으로 재검토한다.
//
// songTitle에 붙은 군더더기(// 참여자, (...ver.)/(...OST)/(아야💜...) N., 이모지, 번호)와
// 괄호 안 '읽기'(예: 좋아하니까.(스키다카라)) 때문에 점수가 깎인 정답들을, 제목을 여러
// 변형으로 만들어 DB와 대조해 best 점수를 취한다. 95%+ 만 자동 매칭(오답은 그대로 보류).
//
// 사용법:
//   node scripts/db/rematch-ambiguous.mjs            # dry-run
//   node scripts/db/rematch-ambiguous.mjs --apply     # 적용
//   node scripts/db/rematch-ambiguous.mjs --threshold=0.93
import { getDb } from './client.mjs';

const apply = process.argv.includes('--apply');
const thArg = process.argv.find((a) => a.startsWith('--threshold='));
const THRESHOLD = thArg ? parseFloat(thArg.split('=')[1]) : 0.95;

// ── 매칭 규칙 (route.ts 포팅) ──
const normalizeText = (t) =>
  (t || '').toLowerCase().trim().replace(/\s+/g, '').replace(/[-_.,!?()[\]{}]/g, '').replace(/[^\w가-힣]/g, '');
function lev(a, b) {
  const m = [];
  for (let i = 0; i <= b.length; i++) m[i] = [i];
  for (let j = 0; j <= a.length; j++) m[0][j] = j;
  for (let i = 1; i <= b.length; i++) for (let j = 1; j <= a.length; j++)
    m[i][j] = b[i - 1] === a[j - 1] ? m[i - 1][j - 1] : Math.min(m[i - 1][j - 1] + 1, m[i][j - 1] + 1, m[i - 1][j] + 1);
  return m[b.length][a.length];
}
function sim(s1, s2) {
  if (!s1 || !s2) return 0;
  const a = s1.toLowerCase().trim(), b = s2.toLowerCase().trim();
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) { const lo = a.length > b.length ? b : a, hi = a.length > b.length ? a : b; return 0.8 + (lo.length / hi.length) * 0.2; }
  const ml = Math.max(a.length, b.length);
  return ml ? Math.max(0, (ml - lev(a, b)) / ml) : 1;
}
const fscore = (q, arr) => { let b = 0; for (const f of arr) { const nf = normalizeText(f); if (nf === q) return 1; if (nf.includes(q) || q.includes(nf)) b = Math.max(b, 0.8); b = Math.max(b, sim(q, nf)); } return b; };

// ── 제목 변형 생성 ──
function titleVariants(raw) {
  const v = new Set();
  const base = (raw || '').trim();
  v.add(base);
  // "// 참여자" 꼬리 제거
  const noSlash = base.split('//')[0].trim();
  v.add(noSlash);
  // 괄호 그룹 추출 + 제거
  const parens = [...base.matchAll(/[(（]([^)）]*)[)）]/g)].map((m) => m[1].trim()).filter(Boolean);
  for (const p of parens) v.add(p); // 괄호 안 '읽기'가 DB 제목인 경우
  let stripped = noSlash.replace(/[(（][^)）]*[)）]/g, ' ');
  // 꼬리 번호/마커 제거: " 12.", " 72, 73.", " ?" 등
  stripped = stripped.replace(/\s*\d+(\s*,\s*\d+)*\s*\.?\s*$/, '').replace(/\s*\?\s*$/, '');
  // 이모지/장식 제거
  stripped = stripped.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}❤❥✝️❄️]/gu, ' ').replace(/\s+/g, ' ').trim();
  v.add(stripped);
  // 흔한 버전/주석 토큰 제거
  v.add(stripped.replace(/\b(orchestra|acoustic|ver|버전|어쿠스틱|무반주|커버|mr|1절|2절|원키|inst|instrumental)\b/gi, '').replace(/\s+/g, ' ').trim());
  return [...v].filter(Boolean);
}
function artistVariants(raw) {
  const v = new Set();
  const base = (raw || '').trim();
  v.add(base);
  for (const tok of base.split(/[,/×xX&]| feat| ft\.| with /i)) { const t = tok.trim(); if (t) v.add(t); }
  return [...v];
}

const { db, close } = await getDb();
try {
  const pt = db.collection('parsedtimelines');
  const songsCol = db.collection('songdetails');
  const songs = await songsCol.find({}).toArray();
  const af = (s) => [s.artist, s.artistAlias, ...(s.searchTags || [])].filter(Boolean);
  const tf = (s) => [s.title, s.titleAlias, ...(s.searchTags || [])].filter(Boolean);

  const items = await pt
    .find({ isRelevant: true, isExcluded: { $ne: true }, matchedSong: { $exists: false }, artist: { $ne: '알 수 없음' } })
    .toArray();

  const proposals = [];
  const stillUnmatched = [];
  for (const it of items) {
    const aVars = artistVariants(it.artist).map(normalizeText).filter(Boolean);
    const tVars = titleVariants(it.songTitle).map(normalizeText).filter(Boolean);
    let best = null;
    for (const s of songs) {
      const as = Math.max(...aVars.map((a) => fscore(a, af(s))), 0);
      const ts = Math.max(...tVars.map((t) => fscore(t, tf(s))), 0);
      const score = (as + ts) / 2;
      if (!best || score > best.score) best = { s, score, as, ts };
    }
    // 오답(짧은 제목 흡인) 방지: 제목 점수도 충분히 높을 때만
    if (best && best.score >= THRESHOLD && best.ts >= 0.9) {
      proposals.push({ it, best });
    } else {
      stillUnmatched.push({ it, best });
    }
  }

  console.log(`━━━ 애매 곡 재매칭 (threshold ${THRESHOLD}) ━━━`);
  console.log(`대상(관련·미매칭): ${items.length}개 → 신규 자동매칭: ${proposals.length}개 | 보류: ${stillUnmatched.length}개\n`);
  console.log('[신규 매칭]');
  for (const p of proposals) console.log(`  ${(p.best.score * 100).toFixed(0)}% "${p.it.artist} - ${p.it.songTitle.slice(0, 42)}" → ${p.best.s.artist} - ${p.best.s.title}`);
  console.log('\n[보류(=DB에 없거나 불확실) 예시 30]');
  for (const u of stillUnmatched.slice(0, 30)) console.log(`  ${(u.best.score * 100).toFixed(0)}% "${u.it.artist} - ${u.it.songTitle.slice(0, 42)}" (best: ${u.best.s.artist} - ${u.best.s.title})`);

  if (!apply) { console.log('\n[dry-run] 변경 없음. --apply 로 적용.'); await close(); process.exit(0); }

  const ops = proposals.map(({ it, best }) => {
    const set = {
      matchedSong: { songId: best.s._id.toString(), title: best.s.title, artist: best.s.artist, confidence: best.score },
      updatedAt: new Date(),
    };
    if (best.s.clipDuration && best.s.clipDuration > 0 && !it.isTimeVerified) {
      set.endTimeSeconds = it.startTimeSeconds + best.s.clipDuration;
      set.duration = best.s.clipDuration;
    }
    return { updateOne: { filter: { id: it.id }, update: { $set: set } } };
  });
  let modified = 0;
  for (let i = 0; i < ops.length; i += 500) { const r = await pt.bulkWrite(ops.slice(i, i + 500), { ordered: false }); modified += r.modifiedCount || 0; }
  console.log(`\n✅ 적용 완료: ${modified}개 신규 매칭`);
} finally {
  await close();
}
