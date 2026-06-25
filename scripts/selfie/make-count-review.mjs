// 방종셀카: 회차 내 출현수(count) 검토 파일을 만든다.
// **승인된 명단**(selfiedays.attendees)을 기준으로, Claude가 정답지 대조로 센 횟수를 채워
// 사용자가 숫자만 고칠 수 있는 파일(counts-review.txt)로 출력한다.
// stdin = JSON { "닉네임": 횟수, ... } 또는 TSV(줄마다 '<닉네임>\t<횟수>', codex-count 출력 직결).
//   입력에 없는 닉은 DB의 기존 count 유지. stdin을 비우면(또는 {}) 전부 DB값 그대로(재생성용).
// --source=<작성자>: 카운트를 누가 집계했는지 검토파일 헤더에 기록(예: "codex:gpt-5.5 high", "claude").
// 사용: echo '{"머슬머슬맨":3}' | node scripts/selfie/make-count-review.mjs --date=2025-07-30 --source=claude
//       node scripts/selfie/codex-count.mjs --date=D | node scripts/selfie/make-count-review.mjs --date=D --source="codex:gpt-5.5 high"
//       echo '{}' | node scripts/selfie/make-count-review.mjs --date=2024-11-24   # DB값 그대로
import fs from 'node:fs';
import path from 'node:path';
import { getDb } from '../db/client.mjs';

const arg = (k) => { const m = process.argv.find((a) => a.startsWith(`--${k}=`)); return m ? m.slice(k.length + 3) : undefined; };
const date = arg('date');
const source = arg('source') || '';
if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) { console.error('--date=YYYY-MM-DD 가 필요합니다.'); process.exit(1); }

const normalize = (s) =>
  (s || '').toLowerCase().trim()
    .replace(/\s+/g, '')
    .replace(/[-_.,!?()[\]{}]/g, '')
    .replace(/[^\w가-힣]/g, '');

let raw = '';
for await (const c of process.stdin) raw += c;
raw = raw.trim();
const byNorm = new Map();
if (raw.startsWith('{')) {
  let input;
  try { input = JSON.parse(raw); } catch (e) { console.error('stdin JSON 파싱 실패:', e.message); process.exit(1); }
  for (const [k, v] of Object.entries(input)) {
    const n = normalize(k); if (!n) continue;
    byNorm.set(n, (byNorm.get(n) || 0) + (Number(v) || 0));
  }
} else if (raw) {
  // TSV: '<닉네임>\t<횟수>'(codex-count 출력). 같은 닉 중복(이중출력)은 마지막 값으로 덮어씀.
  for (const ln of raw.split(/\r?\n/)) {
    const m = ln.match(/^(.+?)\t+(\d+)\s*$/);
    if (!m) continue;
    const n = normalize(m[1]); if (!n) continue;
    byNorm.set(n, parseInt(m[2], 10));
  }
}

const { db, close } = await getDb();
try {
  const day = await db.collection('selfiedays').findOne({ date });
  if (!day) { console.error(`selfiedays에 ${date} 없음 — 먼저 apply-review로 명단을 기록하세요.`); process.exit(1); }
  const rows = (day.attendees || []).map((a) => ({
    nickname: a.nickname,
    // 입력에 있으면 그 값, 없으면 DB의 기존 count(없으면 1)
    count: byNorm.has(a.normalized) ? byNorm.get(a.normalized) : (a.count ?? 1),
  }));
  // 횟수 내림차순 → 닉네임 오름차순
  rows.sort((a, b) => b.count - a.count || a.nickname.localeCompare(b.nickname, 'ko'));

  const out = [];
  out.push(`# 방종셀카 ${date} 회차 내 출현수(count) 검토`);
  if (source) out.push(`# 카운트 작성자: ${source}`); // 누가 집계했는지 기록(apply 시 DB에도 저장)
  out.push('# 형식: <횟수><탭>[확인]<탭><닉네임>. 숫자만 고치면 됨(총 출석수엔 무관, 회차 내 순위·동순위 정렬용).');
  out.push('# 가운데 칸에 v 등을 적으면 "확인함" 표시(결과 무영향). 줄은 추가/삭제하지 말고 횟수만 조정.');
  out.push('');
  for (const r of rows) out.push(`${r.count}\t\t${r.nickname}`); // 가운데 = 확인표시 칸(비움)
  out.push('');

  const dir = path.join(process.cwd(), 'selfie-archive', date);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'counts-review.txt'), out.join('\n'), 'utf8');
  const multi = rows.filter((r) => r.count > 1).length;
  console.log(`작성: selfie-archive/${date}/counts-review.txt  (${rows.length}명, ×2이상 ${multi}명)`);
} finally {
  await close();
}
