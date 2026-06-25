// 방종셀카: 회차 내 출현수 검토 파일(counts-review.txt)을 읽어 attendees[].count 를 기록한다.
// 멤버십(명단)은 건드리지 않는다 — count 필드만 갱신. 정규화로 매칭.
// 파일 형식: '<횟수><탭>[확인표시]<탭><닉네임>'. '#'/빈 줄 무시. 명단에 없는 줄은 경고 후 무시.
//   가운데 칸(확인표시 v 등)은 결과에 영향 없음 — 사용자 "확인함" 체크용. 닉네임은 항상 마지막 탭 칸.
// 사용: node scripts/selfie/apply-count-review.mjs --date=2025-07-30 [--dry]
import fs from 'node:fs';
import path from 'node:path';
import { getDb } from '../db/client.mjs';

const arg = (k) => { const m = process.argv.find((a) => a.startsWith(`--${k}=`)); return m ? m.slice(k.length + 3) : undefined; };
const date = arg('date');
const dry = process.argv.includes('--dry');
if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) { console.error('--date=YYYY-MM-DD 가 필요합니다.'); process.exit(1); }

const file = path.join(process.cwd(), 'selfie-archive', date, 'counts-review.txt');
if (!fs.existsSync(file)) { console.error(`검토 파일이 없습니다: ${file}`); process.exit(1); }

const normalize = (s) =>
  (s || '').toLowerCase().trim()
    .replace(/\s+/g, '')
    .replace(/[-_.,!?()[\]{}]/g, '')
    .replace(/[^\w가-힣]/g, '');

const byNorm = new Map(); // normalized -> count
let countSource = arg('source') || ''; // --source 우선, 없으면 파일 헤더의 '# 카운트 작성자:'
for (const ln of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
  if (!ln.trim()) continue;
  if (ln.trim().startsWith('#')) {
    const m = ln.match(/^#\s*카운트 작성자:\s*(.+?)\s*$/);
    if (m && !arg('source')) countSource = m[1];
    continue;
  }
  const parts = ln.split('\t');
  if (parts.length < 2) { console.warn('  ⚠ 탭 없는 줄 무시:', ln.trim()); continue; }
  const count = parseInt(parts[0].trim(), 10);
  const nick = parts[parts.length - 1].trim(); // 닉네임은 항상 마지막 칸(가운데 확인표시는 무시)
  const n = normalize(nick);
  if (!n || !Number.isFinite(count)) { console.warn('  ⚠ 형식 오류 무시:', ln.trim()); continue; }
  byNorm.set(n, Math.max(1, count));
}

const { db, close } = await getDb();
try {
  const day = await db.collection('selfiedays').findOne({ date });
  if (!day) { console.error(`selfiedays에 ${date} 없음`); process.exit(1); }
  const att = day.attendees || [];
  const matched = new Set();
  let changed = 0;
  const updated = att.map((a) => {
    const c = byNorm.has(a.normalized) ? byNorm.get(a.normalized) : (a.count ?? 1);
    if (byNorm.has(a.normalized)) matched.add(a.normalized);
    if ((a.count ?? 1) !== c) changed++;
    return { ...a, count: c };
  });
  const orphan = [...byNorm.keys()].filter((n) => !matched.has(n));
  const top = updated.filter((a) => a.count > 1).sort((a, b) => b.count - a.count)
    .map((a) => `${a.nickname}×${a.count}`);

  console.log(`${date}: 참석자 ${att.length}명 · count 갱신 ${changed}건 · ×2이상 ${top.length}명`);
  if (top.length) console.log('  ' + top.join(', '));
  if (orphan.length) console.log('  ⚠ 명단에 없어 무시된 닉:', orphan.join(', '));
  if (countSource) console.log(`  카운트 작성자: ${countSource}`);

  if (dry) { console.log('[--dry] 기록 안 함'); process.exit(0); }
  const set = { attendees: updated, updatedAt: new Date(), countAt: new Date() };
  if (countSource) set.countSource = countSource; // 누가 집계했는지 DB에 영구 기록
  await db.collection('selfiedays').updateOne({ date }, { $set: set });
  console.log(`✅ ${date}: count 기록 완료${countSource ? ` (작성자 ${countSource})` : ''}`);
} finally {
  await close();
}
