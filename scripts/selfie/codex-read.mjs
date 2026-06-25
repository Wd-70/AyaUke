// 방종셀카: 이미지 인식을 Codex(GPT-5.5)에 위임 — 닉네임 판독 + 비-채팅 이미지 식별.
// 한 날짜의 _chat 크롭을 전부 첨부해 각 이미지의 닉네임 목록을 받는다.
// 응답을 받아 정답노트/사전 대입·검토파일 작성은 Claude가 별도로 수행한다.
// 사용: node scripts/selfie/codex-read.mjs --date=2025-08-04 [--model=gpt-5.5] [--effort=high]
//   (Codex 사용량 소진 시엔 Claude가 직접 이미지를 Read로 판독)
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const arg = (k) => { const m = process.argv.find((a) => a.startsWith(`--${k}=`)); return m ? m.slice(k.length + 3) : undefined; };
const date = arg('date');
const model = arg('model') || 'gpt-5.5';
const effort = arg('effort') || 'high';
if (!date || !/^\d{4}-\d{2}-\d{2}(_\d{4})?$/.test(date)) { console.error('--date=YYYY-MM-DD 가 필요합니다.'); process.exit(1); }

const dir = path.join(process.cwd(), 'selfie-archive', date, '_chat');
if (!fs.existsSync(dir)) { console.error(`크롭 폴더 없음: ${dir} — 먼저 crop-chat.mjs 실행`); process.exit(1); }
const files = fs.readdirSync(dir).filter((f) => /\.(png|jpe?g|webp)$/i.test(f)).sort();
if (!files.length) { console.error('크롭 PNG가 없습니다.'); process.exit(1); }

const listing = files.map((f, i) => `이미지 ${i + 1}: ${f}`).join('\n');
const prompt = `첨부 이미지들은 한국 스트리밍(치지직) 방송 종료 셀카에서 '채팅창' 부분만 크롭한 것이다.
첨부 순서와 파일명:
${listing}

작업:
1) 각 이미지에서 채팅 각 줄 맨 앞의 '컬러 닉네임(작성자)'만 추출하라. 닉네임 뒤의 메시지·이모티콘·"wwww"·하트 등은 제외하고 닉네임만.
2) 같은 닉이 한 이미지 안에서 여러 줄에 나오면, 나온 줄 수만큼 모두 반복해서 적어라(중복 유지 — 횟수 집계에 필요).
3) 닉네임은 한국어 문장형(예: "분내가 좋은 사람", "계란말이에당근넣지마")이 흔하니 글자를 뭉개지 말고 의미가 통하게 읽어라.
4) 채팅창이 아닌 이미지(게임 화면, 일러스트, 손편지, 스케줄표 등 채팅 닉을 읽을 수 없는 것)가 있으면 그 파일명을 NON-CHAT 섹션에 따로 적어라.

출력 형식(설명·잡담 없이 이 형식만):
=== 이미지 N: <파일명> ===
<닉네임>
<닉네임>
...
(모든 이미지 반복)
=== NON-CHAT ===
<파일명> — <간단한 이유>
(없으면 "없음")`;

const args = ['exec', '-m', model, '-c', `model_reasoning_effort=${effort}`, '-s', 'read-only',
  '-i', ...files.map((f) => path.join(dir, f))];

console.error(`[codex-read] ${date} · ${files.length}장 · ${model}/${effort} 호출 중…`);
const res = spawnSync('codex', args, { input: prompt, encoding: 'utf8', maxBuffer: 1024 * 1024 * 32, shell: true });
if (res.error) { console.error('codex 실행 실패:', res.error.message); process.exit(1); }
process.stdout.write(res.stdout || '');
if (res.status !== 0) { console.error(res.stderr || ''); process.exit(res.status || 1); }
