// 방종셀카: 특정 날짜의 참석자(셀카 속 채팅 닉네임) 명단을 기록한다.
// Claude가 selfie-archive/<date>/ 이미지를 읽어 추출한 닉네임을 이 스크립트로 저장한다.
// 사용:
//   node scripts/selfie/record-attendees.mjs --date=2026-06-20 --names="닉1,닉2,닉3"
//   node scripts/selfie/record-attendees.mjs --date=2026-06-20 --file=names.txt   (줄바꿈 구분)
import fs from 'node:fs';
import { getDb } from '../db/client.mjs';

const arg = (k) => {
  const m = process.argv.find((a) => a.startsWith(`--${k}=`));
  return m ? m.slice(k.length + 3) : undefined;
};

const date = arg('date');
if (!date || !/^\d{4}-\d{2}-\d{2}(_\d{4})?$/.test(date)) {
  console.error('--date=YYYY-MM-DD[_HHMM] 가 필요합니다.');
  process.exit(1);
}

let raw = arg('names');
const file = arg('file');
if (!raw && file) raw = fs.readFileSync(file, 'utf8');
if (!raw) {
  console.error('--names="a,b,c" 또는 --file=names.txt 가 필요합니다.');
  process.exit(1);
}

// 정규화: 소문자 + 공백/구두점 제거, 한글·영문·숫자만 (src/shared/utils/song-match.ts와 동일 규칙)
const normalize = (s) =>
  (s || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '')
    .replace(/[-_.,!?()[\]{}]/g, '')
    .replace(/[^\w가-힣]/g, '');

const seen = new Set();
const attendees = [];
for (const part of raw.split(/[,\n]/)) {
  const nickname = part.trim();
  const normalized = normalize(nickname);
  if (!nickname || !normalized || seen.has(normalized)) continue;
  seen.add(normalized);
  attendees.push({ nickname, normalized });
}

const { db, close } = await getDb();
try {
  await db.collection('selfiedays').updateOne(
    { date },
    { $set: { attendees, analyzed: true, analyzedAt: new Date(), updatedAt: new Date() }, $setOnInsert: { date, createdAt: new Date() } },
    { upsert: true },
  );
  console.log(`✅ ${date}: 참석자 ${attendees.length}명 기록`);
} finally {
  await close();
}
