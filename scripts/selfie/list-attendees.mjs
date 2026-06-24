// 방종셀카: 지금까지 기록된 참석자 로스터를 덤프한다.
// 닉네임 추출 시 이 목록과 대조하면, OCR 미세 오독(아/야, ㅐ/ㅔ, 반복글자 수 등)을
// "알려진 닉 근접 매칭"으로 바로잡을 수 있다. 회차가 쌓일수록 정확도가 올라간다.
// 사용:
//   node scripts/selfie/list-attendees.mjs            # 사람이 보기 좋은 표
//   node scripts/selfie/list-attendees.mjs --json     # 기계 판독용 JSON
import { getDb } from '../db/client.mjs';

const json = process.argv.includes('--json');

const { db, close } = await getDb();
try {
  const days = await db.collection('selfiedays').find({}).toArray();
  const aliases = await db.collection('selfiealiases').find({}).toArray().catch(() => []);

  // 정규화 닉 → { 대표 표시명, 출현 회차수 }
  const tally = new Map();
  for (const d of days) {
    for (const a of d.attendees || []) {
      const cur = tally.get(a.normalized);
      if (cur) cur.days += 1;
      else tally.set(a.normalized, { nickname: a.nickname, normalized: a.normalized, days: 1 });
    }
  }
  // 사용자 등록 별칭도 로스터에 포함(출현 0이어도 알려진 닉)
  for (const al of aliases) {
    if (!tally.has(al.normalized)) tally.set(al.normalized, { nickname: al.nickname, normalized: al.normalized, days: 0, alias: true });
  }

  const roster = [...tally.values()].sort((a, b) => b.days - a.days || a.nickname.localeCompare(b.nickname));

  if (json) {
    console.log(JSON.stringify({ totalDays: days.length, count: roster.length, roster }, null, 2));
  } else {
    console.log(`# 방종셀카 로스터 — 회차 ${days.length}개 / 고유 닉 ${roster.length}명\n`);
    console.log('출현  표시명                  (정규화)');
    for (const r of roster) {
      const pad = ' '.repeat(Math.max(1, 24 - [...r.nickname].reduce((n, c) => n + (/[가-힣]/.test(c) ? 2 : 1), 0)));
      console.log(`${String(r.days).padStart(3)}   ${r.nickname}${pad}(${r.normalized})${r.alias ? ' [별칭]' : ''}`);
    }
  }
} finally {
  await close();
}
