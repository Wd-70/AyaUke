// 방종셀카: 검토 파일(attendees-review.txt)을 읽어 최종 참석자 명단을 기록한다.
// 규칙:
//   - '#' 주석/빈 줄 무시
//   - 탭이 있는 줄 = "판독<탭>교정". 교정이 있으면 교정 우선, 비면 판독, '-' 면 제외
//   - 탭이 없는 줄 = 누락 추가 닉(통째로 사용)
// 사용: node scripts/selfie/apply-review.mjs --date=2025-12-19 [--dry]
import fs from 'node:fs';
import path from 'node:path';
import { getDb } from '../db/client.mjs';

const arg = (k) => {
  const m = process.argv.find((a) => a.startsWith(`--${k}=`));
  return m ? m.slice(k.length + 3) : undefined;
};
const date = arg('date');
const dry = process.argv.includes('--dry');
if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  console.error('--date=YYYY-MM-DD 가 필요합니다.');
  process.exit(1);
}

const file = path.join(process.cwd(), 'selfie-archive', date, 'attendees-review.txt');
if (!fs.existsSync(file)) {
  console.error(`검토 파일이 없습니다: ${file}`);
  process.exit(1);
}

// src/shared/utils/song-match.ts 와 동일 규칙
const normalize = (s) =>
  (s || '').toLowerCase().trim()
    .replace(/\s+/g, '')
    .replace(/[-_.,!?()[\]{}]/g, '')
    .replace(/[^\w가-힣]/g, '');

const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
const seen = new Set();
const attendees = [];
let corrected = 0, excluded = 0, added = 0, asRead = 0;
const log = { corrected: [], excluded: [], added: [] };

for (const ln of lines) {
  if (!ln.trim() || ln.trim().startsWith('#')) continue;
  let name;
  if (ln.includes('\t')) {
    const i = ln.indexOf('\t');
    const col1 = ln.slice(0, i).trim();
    const col2 = ln.slice(i + 1).trim();
    if (col2 === '-') { excluded++; log.excluded.push(col1); continue; }
    if (col2) { name = col2; corrected++; log.corrected.push(`${col1} → ${col2}`); }
    else { name = col1; asRead++; }
  } else {
    name = ln.trim();
    added++; log.added.push(name);
  }
  const normalized = normalize(name);
  if (!name || !normalized || seen.has(normalized)) continue;
  seen.add(normalized);
  attendees.push({ nickname: name, normalized });
}

console.log(`판독유지 ${asRead} · 교정 ${corrected} · 제외 ${excluded} · 추가 ${added} → 최종 ${attendees.length}명`);
if (log.corrected.length) console.log('  교정:', log.corrected.join(', '));
if (log.excluded.length) console.log('  제외:', log.excluded.join(', '));
if (log.added.length) console.log('  추가:', log.added.join(', '));

if (dry) {
  console.log('\n[--dry] 기록하지 않았습니다. 최종 명단:');
  console.log('  ' + attendees.map((a) => a.nickname).join(', '));
  process.exit(0);
}

const { db, close } = await getDb();
try {
  await db.collection('selfiedays').updateOne(
    { date },
    { $set: { attendees, analyzed: true, analyzedAt: new Date(), updatedAt: new Date() }, $setOnInsert: { date, createdAt: new Date() } },
    { upsert: true },
  );
  console.log(`\n✅ ${date}: 참석자 ${attendees.length}명 기록`);
} finally {
  await close();
}
