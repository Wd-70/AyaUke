// 합방(콜라보) 타임라인에서 아야가 부르지 않은 곡을 제외 표기한다.
//
// 도메인 규칙: 특정 업로더는 합방 곡마다 "참여 스트리머"를 하트 이모지로 표기하고,
// 우리 스트리머(아야)를 💜(보라 하트)로 나타낸다. 따라서 하트 표기가 있는데
// 💜가 없는 곡 = 아야가 부르지 않음 → isExcluded=true (가역).
//
// 주의: 하트를 애정 표현/장식으로 쓰는 업로더(예: "사랑해💜")는 이 형식이 아니므로
// 잘못 제외하지 않도록 '합방 표기 형식 + 아야=💜'가 확인된 업로더만 화이트리스트로 적용한다.
//
// 사용법:
//   node scripts/db/exclude-collab-nonaya.mjs          # dry-run
//   node scripts/db/exclude-collab-nonaya.mjs --apply   # 적용
import { getDb } from './client.mjs';

const apply = process.argv.includes('--apply');

// 아야=💜(보라 하트)로 합방 참여자를 표기하는 것이 확인된 업로더만 적용
const COLLAB_AUTHORS = ['@내이름은코난', '사향고양이에용'];

const PURPLE = '\u{1F49C}'; // 💜
// 하트류 이모지(보라 외): ❤ ❥ 및 컬러 하트, 하트장식 등
const HEART_RE = /[❤❥\u{2764}\u{1F493}-\u{1F49F}\u{1F90D}\u{1F90E}\u{1F5A4}\u{1FA75}-\u{1FA77}\u{1F9E1}]/u;

const { db, close } = await getDb();
try {
  const pt = db.collection('parsedtimelines');
  const updates = [];
  const samples = [];

  for (const author of COLLAB_AUTHORS) {
    const items = await pt
      .find({ commentAuthor: author })
      .project({ id: 1, songTitle: 1, isRelevant: 1, isExcluded: 1, matchedSong: 1 })
      .toArray();

    for (const it of items) {
      const title = it.songTitle || '';
      // 하트 표기가 있고(참여자 표기) 그 안에 💜가 없으면 아야가 안 부른 곡
      const hasHeart = HEART_RE.test(title) || title.includes(PURPLE);
      if (!hasHeart) continue; // 하트 표기 자체가 없으면 판단 불가 → 건드리지 않음
      if (title.includes(PURPLE)) continue; // 아야 참여 → 유지
      if (it.isExcluded === true) continue; // 이미 제외됨

      updates.push({ id: it.id, author });
      if (samples.length < 40) {
        samples.push(`  [${author}] rel=${it.isRelevant ? 'O' : 'X'}${it.matchedSong ? ' [M]' : '    '} "${title.slice(0, 48)}"`);
      }
    }
  }

  console.log('━━━ 합방 비-아야 곡 제외 ━━━');
  console.log(`적용 대상 업로더: ${COLLAB_AUTHORS.join(', ')}`);
  console.log(`제외 표기 대상(하트O + 💜X + 미제외): ${updates.length}개`);
  console.log(samples.join('\n'));

  if (!apply) {
    console.log('\n[dry-run] 변경 없음. 적용하려면 --apply 를 붙이세요.');
    await close();
    process.exit(0);
  }

  const ops = updates.map((u) => ({
    updateOne: { filter: { id: u.id }, update: { $set: { isExcluded: true, updatedAt: new Date() } } },
  }));
  let modified = 0;
  for (let i = 0; i < ops.length; i += 500) {
    const res = await pt.bulkWrite(ops.slice(i, i + 500), { ordered: false });
    modified += res.modifiedCount || 0;
  }
  console.log(`\n✅ 적용 완료: ${modified}개 항목 제외 표기`);
} finally {
  await close();
}
