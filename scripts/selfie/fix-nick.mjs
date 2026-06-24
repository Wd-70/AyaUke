// 방종셀카: 기록된 참석자 닉네임을 DB(selfiedays)에서 직접 교정한다.
// 최종 승인본은 selfiedays 컬렉션이 진실(소스). 스팟 교정은 파일 왕복 대신 이걸로 DB를 바로 고친다.
// 사용:
//   node scripts/selfie/fix-nick.mjs --old="|엔비|" --new="l엔비l"            # 전 날짜에서 교정
//   node scripts/selfie/fix-nick.mjs --old="굴러굴" --new="굴러요" --date=2024-11-24
//   ... --remove   # 닉을 제외(삭제)
import { getDb } from '../db/client.mjs';

const arg = (k) => { const m = process.argv.find((a) => a.startsWith(`--${k}=`)); return m ? m.slice(k.length + 3) : undefined; };
const old = arg('old');
const nw = arg('new');
const date = arg('date');
const remove = process.argv.includes('--remove');
if (!old || (!nw && !remove)) { console.error('--old=... --new=... [--date=YYYY-MM-DD] | --old=... --remove'); process.exit(1); }

const normalize = (s) => (s || '').toLowerCase().trim().replace(/\s+/g, '').replace(/[-_.,!?()[\]{}]/g, '').replace(/[^\w가-힣]/g, '');

const { db, close } = await getDb();
try {
  const q = date ? { date } : {};
  const days = await db.collection('selfiedays').find(q).toArray();
  let changed = 0;
  for (const d of days) {
    const att = [...(d.attendees || [])];
    const idx = att.findIndex((a) => a.nickname === old);
    if (idx < 0) continue;
    if (remove) {
      att.splice(idx, 1);
      console.log(`${d.date}: "${old}" 제외`);
    } else {
      const newNorm = normalize(nw);
      const dup = att.findIndex((a, i) => i !== idx && a.normalized === newNorm);
      if (dup >= 0) { att.splice(idx, 1); console.log(`${d.date}: "${old}" → "${nw}" (이미 있어 병합)`); }
      else { att[idx] = { nickname: nw, normalized: newNorm }; console.log(`${d.date}: "${old}" → "${nw}"`); }
    }
    await db.collection('selfiedays').updateOne({ _id: d._id }, { $set: { attendees: att, updatedAt: new Date() } });
    changed++;
  }
  console.log(changed ? `\n✅ ${changed}개 날짜 갱신` : '해당 닉을 가진 날짜 없음');
} finally {
  await close();
}
