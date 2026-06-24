// 방종셀카: 닉네임 검토 파일을 생성한다.
// Claude가 채팅 크롭에서 읽은 닉을 확신/애매로 나눠 stdin(JSON)으로 넘기면,
// 정렬된 검토 파일(selfie-archive/<date>/attendees-review.txt)을 만든다.
//
// 사용(Claude):
//   echo '{"confident":["머슬머슬맨","쿠으로"],"uncertain":["뮹가리"]}' \
//     | node scripts/selfie/make-review.mjs --date=2025-12-19
//
// 검토 규칙(파일 헤더에도 안내):
//   - 탭 뒤를 비우면 → 왼쪽(판독)이 맞음
//   - 탭 뒤에 올바른 닉 → 교체  (확실 항목도 교정 가능)
//   - 탭 뒤에 '-'      → 제외
//   - 맨 아래 '누락 추가'에 탭 없이 한 줄에 하나씩 → 새 닉 추가
import fs from 'node:fs';
import path from 'node:path';

const arg = (k) => {
  const m = process.argv.find((a) => a.startsWith(`--${k}=`));
  return m ? m.slice(k.length + 3) : undefined;
};
const date = arg('date');
if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  console.error('--date=YYYY-MM-DD 가 필요합니다.');
  process.exit(1);
}

let raw = '';
for await (const chunk of process.stdin) raw += chunk;
let input;
try { input = JSON.parse(raw || '{}'); } catch (e) { console.error('stdin JSON 파싱 실패:', e.message); process.exit(1); }
const confident = Array.isArray(input.confident) ? input.confident : [];
const uncertain = Array.isArray(input.uncertain) ? input.uncertain : [];

const w = (s) => [...s].reduce((n, c) => n + (/[가-힣]/.test(c) ? 2 : 1), 0);
const TARGET = 24;
const line = (n) => n + ' '.repeat(Math.max(1, TARGET - w(n))) + '\t';

const out = [];
out.push(`# 방종셀카 ${date} 참석자 검토 — 왼쪽 = Claude 판독`);
out.push('# 탭 뒤 비움=판독이 맞음 / 탭 뒤 올바른 닉=교체(확실 항목도 교정 가능) / 탭 뒤 "-"=제외');
out.push('# 맨 아래 "누락 추가"에 못 잡힌 닉을 탭 없이 한 줄에 하나씩 적으면 추가됩니다.');
out.push('');
out.push('# ── 확실 (여기까지는 확신. 그래도 틀리면 교정) ──');
for (const n of confident) out.push(line(n));
out.push('');
out.push('# ── 애매 (특히 확인 부탁) ──');
for (const n of uncertain) out.push(line(n));
out.push('');
out.push('# ── 누락 추가 (탭 없이 한 줄에 하나씩) ──');
out.push('');

const dir = path.join(process.cwd(), 'selfie-archive', date);
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, 'attendees-review.txt');
fs.writeFileSync(file, out.join('\n') + '\n', 'utf8');
console.log(`작성: selfie-archive/${date}/attendees-review.txt  (확실 ${confident.length} / 애매 ${uncertain.length})`);
