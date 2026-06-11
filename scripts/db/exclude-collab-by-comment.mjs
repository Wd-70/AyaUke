// 특정 합방 댓글에서 아야가 부르지 않은 곡을 제외 표기한다 (댓글별 이모지 규칙).
//
// 배경: 합방 댓글은 곡마다 참여 스트리머를 이모지로 표기하는데, 업로더/방송마다
// 아야를 나타내는 이모지가 다르다(어떤 댓글은 💜, 이 댓글은 🪻). 또한 파싱된
// songTitle에서는 이모지가 형식정리로 제거됐으므로, 원본 댓글(chzzkcomments/
// timelinecomments)을 타임스탬프 기준으로 다시 읽어 판정한다.
//
// 규칙(사용자 지정):
//   - 이모지 없음            → 다 같이 부름(전원) → 유지
//   - 아야 이모지 있음        → 아야 참여 → 유지
//   - 다른 참여자 이모지만 있음 → 아야 미참여 → isExcluded=true
//
// 사용법:
//   node scripts/db/exclude-collab-by-comment.mjs            # dry-run
//   node scripts/db/exclude-collab-by-comment.mjs --apply
import { getDb } from './client.mjs';

const apply = process.argv.includes('--apply');

// ── 대상 댓글 설정 ──
// 사향고양이에용 2026-05-24 (KST) 싱크룸 합방. 아야=🪻(U+1FABB), 테리=✝, 나츠키=🎴, 이샤=❄
const TARGETS = [
  {
    commentId: 26472849,            // chzzkcomments.commentId (숫자)
    aya: '\u{1FABB}',               // 🪻 (아야)
    others: ['\u{271D}', '\u{1F3B4}', '\u{2744}'], // ✝ 🎴 ❄ (다른 참여자)
  },
];

const toSec = (t) => {
  const p = t.split(':').map(Number);
  return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1];
};

const { db, close } = await getDb();
try {
  const cc = db.collection('chzzkcomments');
  const tc = db.collection('timelinecomments');
  const pt = db.collection('parsedtimelines');

  const allUpdates = [];

  for (const target of TARGETS) {
    // 원본 댓글 확보 (chzzk 우선, 없으면 정규화본)
    const raw =
      (await cc.findOne({ commentId: target.commentId }))?.content ||
      (await tc.findOne({ commentId: String(target.commentId) }))?.text;
    if (!raw) {
      console.log(`⚠️ 원본 댓글 없음: ${target.commentId}`);
      continue;
    }

    // 타임스탬프 줄 → 이모지 정보 맵
    const map = new Map();
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*(\d{1,2}:\d{2}(?::\d{2})?)\s/);
      if (!m) continue;
      map.set(toSec(m[1]), {
        hasAya: line.includes(target.aya),
        hasOther: target.others.some((e) => line.includes(e)),
        line: line.trim(),
      });
    }

    const items = await pt
      .find({ commentId: String(target.commentId) })
      .project({ id: 1, songTitle: 1, startTimeSeconds: 1, isRelevant: 1, isExcluded: 1 })
      .toArray();

    let excl = 0, keepAya = 0, keepNone = 0, noMatch = 0;
    const samples = [];
    for (const it of items) {
      const info = map.get(it.startTimeSeconds);
      if (!info) { noMatch++; continue; }
      if (info.hasOther && !info.hasAya) {
        if (it.isExcluded !== true) {
          allUpdates.push(it.id);
          if (samples.length < 20) samples.push(`  ${it.startTimeSeconds}s | "${it.songTitle.slice(0, 32)}"`);
        }
        excl++;
      } else if (info.hasAya) keepAya++;
      else keepNone++;
    }

    console.log(`\n[댓글 ${target.commentId}] 파싱 ${items.length}개`);
    console.log(`  제외(다른참여자만): ${excl} | 유지(아야): ${keepAya} | 유지(전원/이모지없음): ${keepNone} | 타임매칭실패: ${noMatch}`);
    samples.forEach((s) => console.log(s));
  }

  console.log(`\n총 제외 표기 대상(미제외): ${allUpdates.length}개`);

  if (!apply) { console.log('\n[dry-run] 변경 없음. --apply 로 적용.'); await close(); process.exit(0); }

  const ops = allUpdates.map((id) => ({ updateOne: { filter: { id }, update: { $set: { isExcluded: true, updatedAt: new Date() } } } }));
  let modified = 0;
  for (let i = 0; i < ops.length; i += 500) { const r = await pt.bulkWrite(ops.slice(i, i + 500), { ordered: false }); modified += r.modifiedCount || 0; }
  console.log(`\n✅ 적용 완료: ${modified}개 제외 표기`);
} finally {
  await close();
}
