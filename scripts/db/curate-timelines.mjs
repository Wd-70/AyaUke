// 파싱된 타임라인(parsedtimelines)을 라이브 클립 제작에 적합하게 가공한다.
//
// 수행 작업 (모두 가역, 비파괴):
//   1) 자동 매칭   : 관련성 있는 미매칭 항목을 곡 DB와 대조해 95%+ 일치 시 matchedSong 설정
//                    (곡에 clipDuration이 있고 시간검증 전이면 endTime=start+clipDuration 동반 설정)
//   2) 관련성 보정 : isRelevant=false 인데 이미 matchedSong 이 있으면(곡 확정) isRelevant=true
//   3) 중복 정리   : 같은 영상+같은 곡에서 시간 범위가 겹치는(=같은 공연) 항목은 하나만 남기고
//                    나머지를 isExcluded=true 로 표기. 시간이 안 겹치면(여러 번 부름) 보존.
//
// 사용법:
//   node scripts/db/curate-timelines.mjs            # dry-run (변경 없음, 리포트만)
//   node scripts/db/curate-timelines.mjs --apply    # 실제 적용
//   node scripts/db/curate-timelines.mjs --samples   # dry-run + 변경 예시 자세히
import { getDb } from './client.mjs';

const apply = process.argv.includes('--apply');
const showSamples = process.argv.includes('--samples');

// ── 매칭 로직 (api/timeline-parser/route.ts 와 동일 규칙 포팅) ──────────────
function normalizeText(text) {
  return (text || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '')
    .replace(/[-_.,!?()[\]{}]/g, '')
    .replace(/[^\w가-힣]/g, '');
}
function levenshtein(a, b) {
  const m = [];
  for (let i = 0; i <= b.length; i++) m[i] = [i];
  for (let j = 0; j <= a.length; j++) m[0][j] = j;
  for (let i = 1; i <= b.length; i++)
    for (let j = 1; j <= a.length; j++)
      m[i][j] = b[i - 1] === a[j - 1] ? m[i - 1][j - 1] : Math.min(m[i - 1][j - 1] + 1, m[i][j - 1] + 1, m[i - 1][j] + 1);
  return m[b.length][a.length];
}
function similarity(s1, s2) {
  if (!s1 || !s2) return 0;
  const a = s1.toLowerCase().trim();
  const b = s2.toLowerCase().trim();
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) {
    const lo = a.length > b.length ? b : a;
    const hi = a.length > b.length ? a : b;
    return 0.8 + (lo.length / hi.length) * 0.2;
  }
  const ml = Math.max(a.length, b.length);
  if (ml === 0) return 1;
  return Math.max(0, (ml - levenshtein(a, b)) / ml);
}
function fieldScore(query, fields) {
  let best = 0;
  for (const f of fields) {
    const nf = normalizeText(f);
    if (nf === query) return 1;
    if (nf.includes(query) || query.includes(nf)) best = Math.max(best, 0.8);
    best = Math.max(best, similarity(query, nf));
  }
  return best;
}

// ── 메인 ────────────────────────────────────────────────────────────────
const { db, close } = await getDb();
try {
  const pt = db.collection('parsedtimelines');
  const songsCol = db.collection('songdetails');

  const allSongs = await songsCol.find({}).toArray();
  const artistFields = (s) => [s.artist, s.artistAlias, ...(s.searchTags || [])].filter(Boolean);
  const titleFields = (s) => [s.title, s.titleAlias, ...(s.searchTags || [])].filter(Boolean);

  const updates = []; // { id, set, reason }

  // ── 1) 자동 매칭 ──
  const toMatch = await pt
    .find({ isRelevant: true, matchedSong: { $exists: false }, artist: { $ne: '알 수 없음' } })
    .toArray();

  let autoMatched = 0;
  const candidates = []; // 60~95%
  const notInDb = [];    // <60%
  for (const it of toMatch) {
    const na = normalizeText(it.artist);
    const nt = normalizeText(it.songTitle);
    let best = null;
    for (const s of allSongs) {
      const score = (fieldScore(na, artistFields(s)) + fieldScore(nt, titleFields(s))) / 2;
      if (!best || score > best.score) best = { song: s, score };
    }
    if (best && best.score >= 0.95) {
      const set = {
        matchedSong: {
          songId: best.song._id.toString(),
          title: best.song.title,
          artist: best.song.artist,
          confidence: best.score,
        },
        updatedAt: new Date(),
      };
      // 곡에 기본 클립 길이가 있고 시간검증 전이면 종료시간 자동 설정 (앱의 매칭 동작과 동일)
      if (best.song.clipDuration && best.song.clipDuration > 0 && !it.isTimeVerified) {
        set.endTimeSeconds = it.startTimeSeconds + best.song.clipDuration;
        set.duration = best.song.clipDuration;
      }
      updates.push({ id: it.id, set, reason: `자동매칭 ${(best.score * 100).toFixed(0)}% → ${best.song.artist} - ${best.song.title}` });
      autoMatched++;
    } else if (best && best.score >= 0.6) {
      candidates.push({ it, best });
    } else {
      notInDb.push(it);
    }
  }

  // ── 2) 관련성 보정 (매칭됐는데 관련성 false) ──
  const contradictions = await pt.find({ isRelevant: false, matchedSong: { $exists: true } }).toArray();
  for (const it of contradictions) {
    updates.push({ id: it.id, set: { isRelevant: true, updatedAt: new Date() }, reason: '매칭됨 → 관련성 true 보정' });
  }

  // ── 3) 중복 정리 (같은 영상 + 같은 곡, 시간 범위 겹침) ──
  // 매칭된 항목은 적용 후 상태(updates 반영)를 기준으로 곡 키를 잡는다.
  const matchedSetById = new Map(updates.filter((u) => u.set.matchedSong).map((u) => [u.id, u.set.matchedSong]));
  const relevantItems = await pt
    .find({ isExcluded: { $ne: true } })
    .project({ id: 1, videoId: 1, songTitle: 1, startTimeSeconds: 1, endTimeSeconds: 1, duration: 1, matchedSong: 1, isRelevant: 1, isTimeVerified: 1 })
    .toArray();

  // 적용 후 isRelevant 상태 반영 (보정/매칭 포함)
  const willBeRelevant = (it) => {
    const u = updates.find((x) => x.id === it.id);
    if (u && u.set.isRelevant !== undefined) return u.set.isRelevant;
    if (u && u.set.matchedSong) return true;
    return it.isRelevant;
  };
  const songKey = (it) => {
    const m = matchedSetById.get(it.id) || it.matchedSong;
    return m?.songId ? `S:${m.songId}` : `T:${normalizeText(it.songTitle)}`;
  };
  const endOf = (it) => {
    if (typeof it.endTimeSeconds === 'number') return it.endTimeSeconds;
    if (typeof it.duration === 'number') return it.startTimeSeconds + it.duration;
    return it.startTimeSeconds + 30; // 종료 미상 시 기본 30초로 가정
  };
  // 두 항목이 같은 공연인가: 시간 범위가 겹치고, 겹침이 짧은 쪽 길이의 50% 이상
  const overlaps = (a, b) => {
    const ov = Math.min(endOf(a), endOf(b)) - Math.max(a.startTimeSeconds, b.startTimeSeconds);
    if (ov <= 0) return false;
    const lenA = Math.max(1, endOf(a) - a.startTimeSeconds);
    const lenB = Math.max(1, endOf(b) - b.startTimeSeconds);
    return ov / Math.min(lenA, lenB) >= 0.5;
  };

  const groups = new Map();
  for (const it of relevantItems) {
    if (!willBeRelevant(it)) continue;
    const key = `${it.videoId}|${songKey(it)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(it);
  }

  let dupExcluded = 0;
  const dupSamples = [];
  for (const [, items] of groups) {
    if (items.length < 2) continue;
    items.sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);
    const used = new Array(items.length).fill(false);
    for (let i = 0; i < items.length; i++) {
      if (used[i]) continue;
      const cluster = [items[i]];
      used[i] = true;
      for (let j = i + 1; j < items.length; j++) {
        if (!used[j] && overlaps(items[i], items[j])) {
          cluster.push(items[j]);
          used[j] = true;
        }
      }
      if (cluster.length < 2) continue;
      // keep 우선순위: 매칭됨 > 시간검증됨 > 시작 빠른 것
      const score = (it) => (matchedSetById.get(it.id) || it.matchedSong ? 4 : 0) + (it.isTimeVerified ? 2 : 0);
      cluster.sort((a, b) => score(b) - score(a) || a.startTimeSeconds - b.startTimeSeconds);
      const keep = cluster[0];
      for (const drop of cluster.slice(1)) {
        updates.push({ id: drop.id, set: { isExcluded: true, updatedAt: new Date() }, reason: `중복 제외(유지: ${keep.startTimeSeconds}s) ${drop.songTitle.slice(0, 20)}` });
        dupExcluded++;
        if (dupSamples.length < 15) dupSamples.push(`  ${drop.videoId} | "${drop.songTitle.slice(0, 24)}" drop@${drop.startTimeSeconds}s keep@${keep.startTimeSeconds}s`);
      }
    }
  }

  // ── 리포트 ──
  console.log('━━━ 가공 리포트 (parsedtimelines) ━━━');
  console.log(`1) 자동매칭(>=95%): ${autoMatched}개  | 후보(60~95%, 보류): ${candidates.length}개  | DB에없음(<60%, 보류): ${notInDb.length}개`);
  console.log(`2) 관련성 보정(매칭됐는데 false): ${contradictions.length}개`);
  console.log(`3) 중복 제외 표기: ${dupExcluded}개`);
  console.log(`── 총 변경 항목: ${updates.length}개`);

  if (showSamples) {
    console.log('\n[자동매칭 예시]');
    updates.filter((u) => u.set.matchedSong).slice(0, 12).forEach((u) => console.log('  ', u.reason));
    console.log('\n[후보 보류 예시 (수동 확인 권장)]');
    candidates.slice(0, 12).forEach((c) => console.log(`   "${c.it.artist} - ${c.it.songTitle}" ~ ${(c.best.score * 100).toFixed(0)}% ${c.best.song.artist} - ${c.best.song.title}`));
    console.log('\n[중복 제외 예시]');
    dupSamples.forEach((s) => console.log(s));
    console.log('\n[DB에 없는 곡 예시 (관련성 유지)]');
    notInDb.slice(0, 12).forEach((it) => console.log(`   ${it.artist} - ${it.songTitle}`));
  }

  if (!apply) {
    console.log('\n[dry-run] 변경 없음. 적용하려면 --apply 를 붙이세요.');
    await close();
    process.exit(0);
  }

  // ── 적용 (bulkWrite) ──
  const ops = updates.map((u) => ({ updateOne: { filter: { id: u.id }, update: { $set: u.set } } }));
  let modified = 0;
  for (let i = 0; i < ops.length; i += 500) {
    const res = await pt.bulkWrite(ops.slice(i, i + 500), { ordered: false });
    modified += res.modifiedCount || 0;
    console.log(`  적용 진행: ${Math.min(i + 500, ops.length)}/${ops.length}`);
  }
  console.log(`✅ 적용 완료: ${modified}개 항목 수정`);
} finally {
  await close();
}
