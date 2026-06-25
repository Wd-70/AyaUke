// 방종셀카: 출현횟수 집계를 Codex(GPT-5.5)에 위임.
// 한 날짜의 _chat 크롭 + '정답지(승인 명단)'를 넘겨 닉별 총 출현횟수를 받는다.
// 응답을 받아 counts-review.txt 작성/검토는 Claude가 별도로 수행한다.
// 전제: apply-review 로 selfiedays.attendees(정답지)가 이미 기록돼 있어야 함.
// 사용: node scripts/selfie/codex-count.mjs --date=2025-08-04 [--model=gpt-5.5] [--effort=high]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { getDb } from '../db/client.mjs';

const arg = (k) => { const m = process.argv.find((a) => a.startsWith(`--${k}=`)); return m ? m.slice(k.length + 3) : undefined; };
const date = arg('date');
const model = arg('model') || 'gpt-5.5';
const effort = arg('effort') || 'high';
if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) { console.error('--date=YYYY-MM-DD 가 필요합니다.'); process.exit(1); }

const dir = path.join(process.cwd(), 'selfie-archive', date, '_chat');
if (!fs.existsSync(dir)) { console.error(`크롭 폴더 없음: ${dir}`); process.exit(1); }
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.png')).sort();
if (!files.length) { console.error('크롭 PNG가 없습니다.'); process.exit(1); }

const { db, close } = await getDb();
let roster;
try {
  const day = await db.collection('selfiedays').findOne({ date });
  if (!day || !(day.attendees || []).length) { console.error(`정답지 없음 — 먼저 apply-review로 ${date} 명단 기록`); process.exit(1); }
  roster = day.attendees.map((a) => a.nickname);
} finally { await close(); }

const answerKey = roster.map((n, i) => `${i + 1}. ${n}`).join('\n');
const prompt = `첨부 이미지들은 한 방송 회차(${date})의 '채팅창' 크롭 여러 장이다(${files.length}장).
아래는 이 회차의 확정 참석자 명단(정답지)이다:
${answerKey}

작업: 정답지의 각 닉네임이 첨부 이미지 전체에서 '몇 줄에 등장하는지' 총 횟수를 세어라.
- 같은 이미지 안에서 2줄에 나오면 2, 여러 이미지에 걸쳐 합산.
- 정답지에 있는 닉만 센다. 정답지에 없는 닉/메시지는 무시.
- 채팅 글자에 오탈자나 흐릿함이 있어도, 시각적으로 가장 가까운 '정답지의 닉'으로 매칭해서 센다.
- 정답지의 모든 닉을 빠짐없이 출력(0회여도 0으로).

출력 형식(설명 없이 이 형식만, 탭 구분):
<닉네임><탭><횟수>`;

const args = ['exec', '-m', model, '-c', `model_reasoning_effort=${effort}`, '-s', 'read-only',
  '-i', ...files.map((f) => path.join(dir, f))];

console.error(`[codex-count] ${date} · ${files.length}장 · 정답지 ${roster.length}명 · ${model}/${effort} 호출 중…`);
const res = spawnSync('codex', args, { input: prompt, encoding: 'utf8', maxBuffer: 1024 * 1024 * 32, shell: true });
if (res.error) { console.error('codex 실행 실패:', res.error.message); process.exit(1); }

// codex의 잡담/프리앰블을 걷어내고 '<닉네임>\t<횟수>' TSV만 stdout으로 (make-count-review 직결).
// codex가 답을 두 번 출력하는 경우가 있어 닉별 마지막 값으로 dedup.
const seen = new Map();
for (const ln of (res.stdout || '').split(/\r?\n/)) {
  const m = ln.match(/^(.+?)\t+(\d+)\s*$/);
  if (!m) continue;
  const nick = m[1].trim();
  if (!nick || nick.startsWith('#')) continue;
  seen.set(nick, parseInt(m[2], 10));
}
if (!seen.size) {
  console.error('codex 출력에서 TSV를 찾지 못함 — 원본 출력:');
  console.error(res.stdout || '');
  process.exit(1);
}
for (const [nick, c] of seen) process.stdout.write(`${nick}\t${c}\n`);
console.error(`[codex-count] ${seen.size}개 닉 집계 완료`);
if (res.status !== 0) console.error(res.stderr || '');
