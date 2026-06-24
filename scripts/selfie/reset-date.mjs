// 방종셀카: 특정 날짜의 수집 데이터를 비운다(재수집용).
// selfieposts(해당 date 게시물) 삭제 + selfie-archive/<date>/ 로컬 파일 삭제.
// 참석자 명단(selfiedays)은 건드리지 않는다.
// 사용: node scripts/selfie/reset-date.mjs --date=2025-12-19
import fs from 'node:fs';
import path from 'node:path';
import { getDb } from '../db/client.mjs';

const arg = (k) => {
  const m = process.argv.find((a) => a.startsWith(`--${k}=`));
  return m ? m.slice(k.length + 3) : undefined;
};

const date = arg('date');
if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  console.error('--date=YYYY-MM-DD 가 필요합니다.');
  process.exit(1);
}

const { db, close } = await getDb();
try {
  const res = await db.collection('selfieposts').deleteMany({ date });
  console.log(`🗑  selfieposts 삭제: ${res.deletedCount}건 (date=${date})`);
} finally {
  await close();
}

const dir = path.join(process.cwd(), 'selfie-archive', date);
if (fs.existsSync(dir)) {
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`🗑  로컬 파일 삭제: selfie-archive/${date}/`);
} else {
  console.log(`(로컬 폴더 없음: selfie-archive/${date}/)`);
}
console.log('완료 — 이제 확장으로 재수집하세요.');
