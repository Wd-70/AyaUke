// 방종셀카: 이미 승인된 회차의 attendees[].count(회차 내 출현수)만 백필한다.
// 멤버십(명단)은 절대 건드리지 않는다 — count 필드만 갱신.
// stdin JSON = { "닉네임 또는 정규화키": 횟수, ... }. 정규화해서 attendees.normalized 와 매칭.
// 매핑에 없는 참석자는 count=1 로 둔다. 매핑에 있으나 명단에 없는 키는 무시(경고).
// 사용: echo '{"아야님 가려워요":5,...}' | node scripts/selfie/set-counts.mjs --date=2025-06-09 [--dry]
import { getDb } from '../db/client.mjs';

const arg = (k) => { const m = process.argv.find((a) => a.startsWith(`--${k}=`)); return m ? m.slice(k.length + 3) : undefined; };
const date = arg('date');
const dry = process.argv.includes('--dry');
if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) { console.error('--date=YYYY-MM-DD 가 필요합니다.'); process.exit(1); }

const normalize = (s) =>
  (s || '').toLowerCase().trim()
    .replace(/\s+/g, '')
    .replace(/[-_.,!?()[\]{}]/g, '')
    .replace(/[^\w가-힣]/g, '');

let raw = '';
for await (const c of process.stdin) raw += c;
let input;
try { input = JSON.parse(raw || '{}'); } catch (e) { console.error('stdin JSON 파싱 실패:', e.message); process.exit(1); }

// 입력 키를 정규화 → 횟수 (정규화 충돌 시 합산)
const byNorm = new Map();
for (const [k, v] of Object.entries(input)) {
  const n = normalize(k);
  if (!n) continue;
  byNorm.set(n, (byNorm.get(n) || 0) + (Number(v) || 0));
}

const { db, close } = await getDb();
try {
  const day = await db.collection('selfiedays').findOne({ date });
  if (!day) { console.error(`selfiedays에 ${date} 없음`); process.exit(1); }
  const att = day.attendees || [];
  const matched = new Set();
  let changed = 0;
  const updated = att.map((a) => {
    const c = byNorm.has(a.normalized) ? byNorm.get(a.normalized) : 1;
    if (byNorm.has(a.normalized)) matched.add(a.normalized);
    if ((a.count ?? 1) !== c) changed++;
    return { ...a, count: c };
  });
  // 입력에 있으나 명단에 없는 키 경고(멤버십은 안 건드림)
  const orphan = [...byNorm.keys()].filter((n) => !matched.has(n));
  const top = updated.filter((a) => a.count > 1).sort((a, b) => b.count - a.count)
    .map((a) => `${a.nickname}×${a.count}`);

  console.log(`${date}: 참석자 ${att.length}명 · count 갱신 ${changed}건 · ×2이상 ${top.length}명`);
  if (top.length) console.log('  ' + top.join(', '));
  if (orphan.length) console.log('  ⚠ 명단에 없어 무시된 키:', orphan.join(', '));

  if (dry) { console.log('[--dry] 기록 안 함'); process.exit(0); }
  await db.collection('selfiedays').updateOne(
    { date },
    { $set: { attendees: updated, updatedAt: new Date() } },
  );
  console.log(`✅ ${date}: count 백필 완료`);
} finally {
  await close();
}
