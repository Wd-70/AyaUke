// 방종셀카: 회차 내 출현수(count) 검토 파일을 만든다.
// **승인된 명단**(selfiedays.attendees)을 기준으로, Claude가 정답지 대조로 센 횟수를 채워
// 사용자가 숫자만 고칠 수 있는 파일(counts-review.txt)로 출력한다.
// stdin JSON = { "닉네임": 횟수, ... }(정답지 대조 결과). 명단에 있으나 입력에 없으면 1.
// 사용: echo '{"머슬머슬맨":3}' | node scripts/selfie/make-count-review.mjs --date=2025-07-30
import fs from 'node:fs';
import path from 'node:path';
import { getDb } from '../db/client.mjs';

const arg = (k) => { const m = process.argv.find((a) => a.startsWith(`--${k}=`)); return m ? m.slice(k.length + 3) : undefined; };
const date = arg('date');
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
const byNorm = new Map();
for (const [k, v] of Object.entries(input)) {
  const n = normalize(k); if (!n) continue;
  byNorm.set(n, (byNorm.get(n) || 0) + (Number(v) || 0));
}

const { db, close } = await getDb();
try {
  const day = await db.collection('selfiedays').findOne({ date });
  if (!day) { console.error(`selfiedays에 ${date} 없음 — 먼저 apply-review로 명단을 기록하세요.`); process.exit(1); }
  const rows = (day.attendees || []).map((a) => ({
    nickname: a.nickname,
    count: byNorm.has(a.normalized) ? byNorm.get(a.normalized) : 1,
  }));
  // 횟수 내림차순 → 닉네임 오름차순
  rows.sort((a, b) => b.count - a.count || a.nickname.localeCompare(b.nickname, 'ko'));

  const out = [];
  out.push(`# 방종셀카 ${date} 회차 내 출현수(count) 검토`);
  out.push('# 형식: <횟수><탭><닉네임>. 숫자만 고치면 됨(총 출석수엔 무관, 회차 내 순위·동순위 정렬용).');
  out.push('# 정답지(승인 명단) 기준 — 줄을 추가/삭제하지 말고 횟수만 조정하세요.');
  out.push('');
  for (const r of rows) out.push(`${r.count}\t${r.nickname}`);
  out.push('');

  const dir = path.join(process.cwd(), 'selfie-archive', date);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'counts-review.txt'), out.join('\n'), 'utf8');
  const multi = rows.filter((r) => r.count > 1).length;
  console.log(`작성: selfie-archive/${date}/counts-review.txt  (${rows.length}명, ×2이상 ${multi}명)`);
} finally {
  await close();
}
