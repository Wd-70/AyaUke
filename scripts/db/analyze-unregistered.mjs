// 파싱된 타임라인(parsedtimelines) 중 라이브 클립(songvideos)으로 등록되지 않은
// 데이터를 분류하고, "곡 DB에 없는 곡"을 곡별로 집계해 파일로 저장한다.
//
// 등록 판정: songvideos 에 (videoId + 같은 곡 songId + startTime ±15초) 매칭이 있으면 등록됨.
//
// 사용법:
//   node scripts/db/analyze-unregistered.mjs
//   → 콘솔에 분류 요약, reports/ 에 상세 파일 저장
import { getDb } from './client.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { projectRoot } from './client.mjs';

const normalize = (s) =>
  (s || '').toLowerCase().trim().replace(/\s+/g, '').replace(/[-_.,!?()[\]{}]/g, '').replace(/[^\w가-힣]/g, '');

const { db, close } = await getDb();
try {
  const pt = db.collection('parsedtimelines');
  const sv = db.collection('songvideos');

  // 등록된 클립 인덱스: videoId → [{ songId, startTime }]
  const clips = await sv.find({}).project({ videoId: 1, songId: 1, startTime: 1 }).toArray();
  const clipIndex = new Map();
  for (const c of clips) {
    if (!clipIndex.has(c.videoId)) clipIndex.set(c.videoId, []);
    clipIndex.get(c.videoId).push({ songId: String(c.songId), startTime: c.startTime });
  }
  const isRegistered = (it) => {
    const list = clipIndex.get(it.videoId);
    if (!list) return false;
    const songId = it.matchedSong?.songId ? String(it.matchedSong.songId) : null;
    return list.some(
      (c) => Math.abs((c.startTime ?? -1) - it.startTimeSeconds) <= 15 && (!songId || c.songId === songId),
    );
  };

  const items = await pt
    .find({})
    .project({ artist: 1, songTitle: 1, startTimeSeconds: 1, videoId: 1, platform: 1, isRelevant: 1, isExcluded: 1, matchedSong: 1 })
    .toArray();

  // 분류
  const cats = {
    registered: 0,            // 이미 클립 등록됨
    matchedUnregistered: [],  // 매칭됐고 클립 가능하지만 미등록 → 등록 후보
    noSongInDb: [],           // 관련O·제외X·매칭X → 곡 DB에 없음
    excluded: 0,              // 제외됨
    irrelevant: 0,            // 관련성 없음(잡담)
  };

  for (const it of items) {
    if (isRegistered(it)) { cats.registered++; continue; }
    if (it.isExcluded) { cats.excluded++; continue; }
    if (!it.isRelevant) { cats.irrelevant++; continue; }
    if (it.matchedSong?.songId) cats.matchedUnregistered.push(it);
    else cats.noSongInDb.push(it);
  }

  // DB에 없는 곡: (artist, songTitle) 정규화 키로 집계
  const songCount = new Map();
  for (const it of cats.noSongInDb) {
    const key = `${normalize(it.artist)}|${normalize(it.songTitle)}`;
    if (!songCount.has(key)) songCount.set(key, { artist: it.artist, songTitle: it.songTitle, count: 0 });
    songCount.get(key).count++;
  }
  const songList = [...songCount.values()].sort((a, b) => b.count - a.count || a.artist.localeCompare(b.artist));

  // ── 콘솔 요약 ──
  console.log('━━━ 파싱 타임라인 등록 현황 ━━━');
  console.log(`전체 ${items.length}개`);
  console.log(`  등록됨(songvideos): ${cats.registered}`);
  console.log(`  미등록·매칭됨(등록 후보): ${cats.matchedUnregistered.length}`);
  console.log(`  미등록·곡DB에 없음: ${cats.noSongInDb.length}  (고유 곡 ${songList.length}개)`);
  console.log(`  미등록·제외됨: ${cats.excluded}`);
  console.log(`  미등록·관련성 없음(잡담): ${cats.irrelevant}`);

  // ── 파일 저장 ──
  const reportsDir = path.join(projectRoot, 'reports');
  fs.mkdirSync(reportsDir, { recursive: true });

  // 1) DB에 없는 곡 (곡별 개수)
  const songsFile = path.join(reportsDir, 'db-missing-songs.txt');
  const songLines = [
    `# 곡 DB에 없는 곡 (관련성 있고 미제외·미매칭인 파싱 타임라인 기준)`,
    `# 생성: ${new Date().toISOString()}`,
    `# 총 ${cats.noSongInDb.length}개 항목 / 고유 곡 ${songList.length}개`,
    `# 형식: 개수\t아티스트 - 곡명`,
    ``,
    ...songList.map((s) => `${s.count}\t${s.artist} - ${s.songTitle}`),
  ];
  fs.writeFileSync(songsFile, songLines.join('\n'), 'utf8');

  // 2) 등록 후보(매칭됐는데 미등록) 목록 — 참고용
  const candFile = path.join(reportsDir, 'unregistered-matched.txt');
  const candLines = [
    `# 매칭됐지만 클립 미등록 (등록 후보)`,
    `# 생성: ${new Date().toISOString()} / 총 ${cats.matchedUnregistered.length}개`,
    `# 형식: 시작초\t플랫폼\t매칭곡 → 원본"아티스트 - 곡명"`,
    ``,
    ...cats.matchedUnregistered
      .sort((a, b) => (a.matchedSong.artist || '').localeCompare(b.matchedSong.artist || ''))
      .map((it) => `${it.startTimeSeconds}\t${it.platform || 'youtube'}\t${it.matchedSong.artist} - ${it.matchedSong.title}\t← "${it.artist} - ${it.songTitle}"`),
  ];
  fs.writeFileSync(candFile, candLines.join('\n'), 'utf8');

  console.log(`\n저장:`);
  console.log(`  ${path.relative(projectRoot, songsFile)}  (DB에 없는 곡 ${songList.length}개)`);
  console.log(`  ${path.relative(projectRoot, candFile)}  (등록 후보 ${cats.matchedUnregistered.length}개)`);
  console.log(`\n[DB에 없는 곡 상위 25]`);
  for (const s of songList.slice(0, 25)) console.log(`  ${String(s.count).padStart(3)}  ${s.artist} - ${s.songTitle}`);
} finally {
  await close();
}
