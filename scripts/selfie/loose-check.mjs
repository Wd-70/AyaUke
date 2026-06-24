// 방종셀카: |, i, l, 1 처럼 구분하기 힘든 글자를 보조 사전의 원본 철자로 확인한다.
// 이 글자들을 모두 같은 것으로 취급(loose)해 사전을 조회 → 사전이 쓴 실제 문자를 알려준다.
// 입력: stdin JSON 닉 배열. 없으면 현재 로스터에서 |,i,l,1 포함 닉을 검사(--roster 기본).
// 사용:
//   echo '["|단하루|","lollobok7"]' | node scripts/selfie/loose-check.mjs
//   node scripts/selfie/loose-check.mjs --roster
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const DICT = 'selfie-archive/_nick-dict.json';
if (!fs.existsSync(DICT)) { console.error('_nick-dict.json 없음.'); process.exit(1); }
const dict = JSON.parse(fs.readFileSync(DICT, 'utf8'));
const loose = (s) => (s || '').toLowerCase().replace(/[|il1]/g, '#').replace(/\s+/g, '').replace(/[-_.,!?()[\]{}]/g, '').replace(/[^\w가-힣#]/g, '');

const idx = new Map();
for (const d of dict) { const k = loose(d.nickname); if (!idx.has(k)) idx.set(k, []); idx.get(k).push(d); }

let nicks = [];
const raw = fs.readFileSync(0, 'utf8').trim();
if (raw) nicks = JSON.parse(raw);
else nicks = JSON.parse(execSync('node scripts/selfie/list-attendees.mjs --json').toString()).roster.map((r) => r.nickname).filter((n) => /[|il1]/i.test(n));

for (const n of nicks) {
  const all = idx.get(loose(n)) || [];
  const diff = all.filter((d) => d.nickname !== n).sort((a, b) => b.vodCount - a.vodCount);
  if (diff.length) console.log(`🔎 "${n}"  → 사전: ${diff.map((h) => `"${h.nickname}"(vod${h.vodCount})`).join(', ')}`);
  else console.log(`   "${n}"  → ${all.length ? '사전과 동일 철자(확정)' : '사전에 없음'}`);
}
