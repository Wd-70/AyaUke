// 미매칭 타임라인(곡 DB에 없다고 분류된 것)을 정리한다:
//   1) 메모 분리   : songTitle의 부가정보("(하이라이트만)", "1절", "// 메모" 등)를
//                    분리해 customDescription(메모란)에 이어붙이고 곡명은 깔끔하게.
//   2) swap 교정   : 아티스트/곡명이 뒤바뀐 항목을 DB 매칭으로 검증해 교환.
//   3) 재매칭      : 정리된 값으로 곡 DB와 대조해 95%+ 면 matchedSong 설정.
//
// 모두 가역(필드 수정). dry-run 기본 / --apply 적용 / --samples 상세.
import { getDb } from './client.mjs';

const apply = process.argv.includes('--apply');
const samples = process.argv.includes('--samples');

// ── 매칭 규칙 (rematch-ambiguous 포팅) ──
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

function titleVariants(raw) {
  const v = new Set();
  const base = (raw || '').trim();
  v.add(base);
  const noSlash = base.split('//')[0].trim();
  v.add(noSlash);
  for (const m of base.matchAll(/[(（]([^)）]*)[)）]/g)) if (m[1].trim()) v.add(m[1].trim());
  let s = noSlash.replace(/[(（][^)）]*[)）]/g, ' ').replace(/\s*\d+(\s*,\s*\d+)*\s*\.?\s*$/, '').replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ' ').replace(/\s+/g, ' ').trim();
  v.add(s);
  return [...v].filter(Boolean).map(normalizeText).filter(Boolean);
}
function artistVariants(raw) {
  const v = new Set([(raw || '').trim()]);
  for (const tok of (raw || '').split(/[,/×xX&]| feat| ft\.| with /i)) if (tok.trim()) v.add(tok.trim());
  return [...v].map(normalizeText).filter(Boolean);
}

// ── 메모(부가정보) 분리 ──
const MEMO_KW = /(하이라이트|하이라이크|초반부|초반부분|앞부분|뒷부분|중간부터|중간부분|쇼츠|아는\s?부분|짧음|주의|무반주|커버곡|풀버전|원키|어쿠스틱|acoustic|반주만|부분만|일부만|[12]절|reprise|짧게)/;
function splitMemo(title) {
  let memos = [];
  let t = title || '';
  // 괄호 안에 메모 키워드가 있으면 분리 (일본어 원제 등 곡명 일부는 보존)
  t = t.replace(/[(（]([^)）]*)[)）]/g, (m, inner) => {
    if (MEMO_KW.test(inner)) { memos.push(inner.trim()); return ' '; }
    return m;
  });
  // "// 메모" 꼬리
  const sl = t.split('//');
  if (sl.length > 1) { memos.push(sl.slice(1).join('//').trim()); t = sl[0]; }
  // 끝에 붙은 비괄호 메모
  t = t.replace(/\s+([12]절|하이라이트만?|초반부분?만?|앞부분만?|뒷부분만?)\s*$/g, (m, kw) => { memos.push(kw); return ''; });
  t = t.replace(/\s+/g, ' ').trim();
  return { clean: t || (title || '').trim(), memo: memos.filter(Boolean).join(', ') };
}

const { db, close } = await getDb();
try {
  const pt = db.collection('parsedtimelines');
  const songsCol = db.collection('songdetails');
  const songs = await songsCol.find({}).toArray();
  const af = (s) => [s.artist, s.artistAlias, ...(s.searchTags || [])].filter(Boolean);
  const tf = (s) => [s.title, s.titleAlias, ...(s.searchTags || [])].filter(Boolean);

  // 한 방향에 대한 최고 매칭
  const bestMatch = (artistStr, titleStr) => {
    const aV = artistVariants(artistStr), tV = titleVariants(titleStr);
    let best = null;
    for (const s of songs) {
      const a = Math.max(...aV.map((x) => fscore(x, af(s))), 0);
      const t = Math.max(...tV.map((x) => fscore(x, tf(s))), 0);
      const score = (a + t) / 2;
      if (!best || score > best.score) best = { s, score, a, t };
    }
    return best;
  };

  const items = await pt
    .find({ isRelevant: true, isExcluded: { $ne: true }, matchedSong: { $exists: false }, artist: { $ne: '알 수 없음' } })
    .toArray();

  const updates = [];
  const stat = { memo: 0, swap: 0, matched: 0, cleaned: 0 };
  const exSwap = [], exMemo = [], exMatch = [];

  for (const it of items) {
    const { clean, memo } = splitMemo(it.songTitle);

    const fwd = bestMatch(it.artist, clean);
    const swp = bestMatch(clean, it.artist); // 곡명↔아티스트 교환 가정

    // 방향 결정: swap이 뚜렷이 우세할 때만 교환 (오교정 방지)
    let dir = 'forward', best = fwd;
    if (swp && swp.score >= 0.92 && swp.score > (fwd?.score ?? 0) + 0.1 && swp.t >= 0.9 && swp.a >= 0.9) {
      dir = 'swap'; best = swp;
    }

    const newArtist = dir === 'swap' ? clean : it.artist;
    const newTitle = dir === 'swap' ? it.artist : clean;

    const set = {};
    let changed = false;

    if (newArtist !== it.artist || newTitle !== it.songTitle) {
      set.artist = newArtist;
      set.songTitle = newTitle;
      changed = true;
      stat.cleaned++;
      if (dir === 'swap') { stat.swap++; if (exSwap.length < 20) exSwap.push(`  "${it.artist} | ${it.songTitle}" → 가수="${newArtist}" 곡="${newTitle}"`); }
    }

    if (memo) {
      const cur = it.customDescription && !/댓글로부터 생성/.test(it.customDescription) ? it.customDescription : '';
      set.customDescription = cur ? `${cur} / ${memo}` : memo;
      changed = true;
      stat.memo++;
      if (exMemo.length < 20) exMemo.push(`  "${it.songTitle}" → 곡="${newTitle}" 메모="${memo}"`);
    }

    if (best && best.score >= 0.95) {
      set.matchedSong = { songId: best.s._id.toString(), title: best.s.title, artist: best.s.artist, confidence: best.score };
      if (best.s.clipDuration && best.s.clipDuration > 0 && !it.isTimeVerified) {
        set.endTimeSeconds = it.startTimeSeconds + best.s.clipDuration;
        set.duration = best.s.clipDuration;
      }
      changed = true;
      stat.matched++;
      if (exMatch.length < 25) exMatch.push(`  ${(best.score * 100).toFixed(0)}% "${newArtist} - ${newTitle}" → ${best.s.artist} - ${best.s.title}`);
    }

    if (changed) {
      set.updatedAt = new Date();
      updates.push({ id: it.id, set });
    }
  }

  console.log('━━━ 미매칭 타임라인 정리 ━━━');
  console.log(`대상 ${items.length}개 → 변경 ${updates.length}개`);
  console.log(`  곡명/가수 정리: ${stat.cleaned} (그중 swap 교정 ${stat.swap})`);
  console.log(`  메모 분리: ${stat.memo}`);
  console.log(`  신규 매칭(95%+): ${stat.matched}`);

  if (samples) {
    console.log('\n[swap 교정]'); exSwap.forEach((s) => console.log(s));
    console.log('\n[메모 분리]'); exMemo.forEach((s) => console.log(s));
    console.log('\n[신규 매칭]'); exMatch.forEach((s) => console.log(s));
  }

  if (!apply) { console.log('\n[dry-run] 변경 없음. --apply 로 적용 / --samples 로 상세.'); await close(); process.exit(0); }

  const ops = updates.map((u) => ({ updateOne: { filter: { id: u.id }, update: { $set: u.set } } }));
  let modified = 0;
  for (let i = 0; i < ops.length; i += 500) { const r = await pt.bulkWrite(ops.slice(i, i + 500), { ordered: false }); modified += r.modifiedCount || 0; }
  console.log(`\n✅ 적용 완료: ${modified}개 항목 수정`);
} finally {
  await close();
}
