// 방종셀카: 닉네임 검토 파일을 생성한다.
// Claude가 채팅 크롭에서 읽은 닉을 분류해 stdin(JSON)으로 넘기면 정렬된 검토 파일을 만든다.
//
// 입력(JSON):
//   {
//     "rosterConfident": ["..."],          // 확실① 정답노트(이전 승인 목록) 일치
//     "dictConfident":   ["..."],          // 확실② 보조사전 exact 확인
//     "uncertain": [                        // 애매 — 후보/사전결과를 주석으로 함께 표기
//       { "value": "하늘딛음", "note": "후보 하늘담음 · 사전 하늘딛음(vod54,d1)" },
//       "산양우유"                            // 문자열만 줘도 됨(note 없음)
//     ]
//   }
//   (구버전 {confident, uncertain} 도 지원: confident → 확실① 로 취급)
//
// 검토 규칙: 탭 뒤 비움=판독 맞음 / 올바른 닉=교체 / "-"=제외 / 하단 "누락추가"에 탭없이 한 줄=추가
import fs from 'node:fs';
import path from 'node:path';

const arg = (k) => { const m = process.argv.find((a) => a.startsWith(`--${k}=`)); return m ? m.slice(k.length + 3) : undefined; };
const date = arg('date');
if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) { console.error('--date=YYYY-MM-DD 가 필요합니다.'); process.exit(1); }

let raw = '';
for await (const c of process.stdin) raw += c;
let input;
try { input = JSON.parse(raw || '{}'); } catch (e) { console.error('stdin JSON 파싱 실패:', e.message); process.exit(1); }

const rosterConfident = input.rosterConfident || input.confident || [];
const dictConfident = input.dictConfident || [];
const uncertain = (input.uncertain || []).map((u) => (typeof u === 'string' ? { value: u, note: '' } : u));

const w = (s) => [...s].reduce((n, c) => n + (/[가-힣]/.test(c) ? 2 : 1), 0);
const TARGET = 24;
const line = (n) => n + ' '.repeat(Math.max(1, TARGET - w(n))) + '\t';

const out = [];
out.push(`# 방종셀카 ${date} 참석자 검토 — 왼쪽 = Claude 판독`);
out.push('# 탭 뒤 비움=판독 맞음 / 올바른 닉=교체 / "-"=제외 / 맨 아래 누락추가에 탭없이 한 줄=추가');
out.push('');
out.push('# ═══ 확실 ① 정답노트(이전 승인 목록) 일치 ═══');
for (const n of rosterConfident) out.push(line(n));
out.push('');
out.push('# ═══ 확실 ② 보조사전 확인 ═══');
for (const n of dictConfident) out.push(line(n));
out.push('');
out.push('# ═══ 애매 (아래 # 줄 = 내 후보 · 사전검색 결과 참고) ═══');
for (const u of uncertain) {
  if (u.note) out.push(`# ${u.note}`);
  out.push(line(u.value));
}
out.push('');
out.push('# ═══ 누락 추가 (탭 없이 한 줄에 하나씩) ═══');
out.push('');

const dir = path.join(process.cwd(), 'selfie-archive', date);
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'attendees-review.txt'), out.join('\n') + '\n', 'utf8');
console.log(`작성: selfie-archive/${date}/attendees-review.txt  (확실① ${rosterConfident.length} / 확실② ${dictConfident.length} / 애매 ${uncertain.length})`);
