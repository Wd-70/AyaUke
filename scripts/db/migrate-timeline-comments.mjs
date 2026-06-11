// 타임라인 댓글 원문 정규화 마이그레이션
//
// parsedtimelines 각 항목에 중복 저장된 originalComment(댓글 HTML 전문)를
// timelinecomments 컬렉션(commentId 기준 한 벌)으로 옮기고,
// 옮긴 항목의 originalComment를 제거(공간 회수)한다.
//
// 사용법:
//   node scripts/db/migrate-timeline-comments.mjs          # dry-run (변경 없음, 통계만)
//   node scripts/db/migrate-timeline-comments.mjs --apply  # 실제 적용
//   node scripts/db/migrate-timeline-comments.mjs --apply --keep-original  # 원문 유지(백필만)
import { getDb } from './client.mjs';

const apply = process.argv.includes('--apply');
const keepOriginal = process.argv.includes('--keep-original');

const { db, close } = await getDb();
try {
  const items = db.collection('parsedtimelines');
  const commentsCol = db.collection('timelinecomments');

  const total = await items.countDocuments({});
  const withComment = await items.countDocuments({ originalComment: { $exists: true, $ne: '' } });
  console.log(`전체 항목: ${total}, originalComment 보유: ${withComment}`);

  // commentId별 댓글 원문 한 벌 수집 (가장 먼저 만나는 항목 기준)
  const cursor = items.find(
    { originalComment: { $exists: true, $ne: '' } },
    { projection: { commentId: 1, originalComment: 1, commentAuthor: 1, commentPublishedAt: 1, platform: 1 } },
  );

  const byComment = new Map();
  let missingCommentId = 0;
  for await (const doc of cursor) {
    if (!doc.commentId) { missingCommentId++; continue; }
    if (!byComment.has(doc.commentId)) {
      byComment.set(doc.commentId, {
        commentId: String(doc.commentId),
        platform: doc.platform || 'youtube',
        text: doc.originalComment,
        author: doc.commentAuthor,
        publishedAt: doc.commentPublishedAt,
      });
    }
  }

  console.log(`고유 댓글: ${byComment.size}개 (commentId 없는 항목: ${missingCommentId}개)`);

  if (!apply) {
    let bytes = 0;
    for (const c of byComment.values()) bytes += Buffer.byteLength(c.text || '');
    console.log(`정규화 후 댓글 저장: ${(bytes / 1048576).toFixed(1)}MB`);
    console.log('\n[dry-run] 변경 없음. 실제 적용하려면 --apply 를 붙이세요.');
    console.log('  - timelinecomments 백필(upsert)');
    if (!keepOriginal) console.log('  - parsedtimelines.originalComment 제거($unset)');
    await close();
    process.exit(0);
  }

  // 1) timelinecomments 백필 (upsert)
  const now = new Date();
  const ops = [...byComment.values()].map((c) => ({
    updateOne: {
      filter: { commentId: c.commentId },
      update: {
        $set: { platform: c.platform, text: c.text, author: c.author, publishedAt: c.publishedAt, updatedAt: now },
        $setOnInsert: { createdAt: now },
      },
      upsert: true,
    },
  }));

  let upserted = 0;
  for (let i = 0; i < ops.length; i += 500) {
    const batch = ops.slice(i, i + 500);
    const res = await commentsCol.bulkWrite(batch, { ordered: false });
    upserted += (res.upsertedCount || 0) + (res.modifiedCount || 0);
    console.log(`  백필 진행: ${Math.min(i + 500, ops.length)}/${ops.length}`);
  }
  // 유니크 인덱스 보장
  await commentsCol.createIndex({ commentId: 1 }, { unique: true }).catch(() => {});
  console.log(`✅ timelinecomments 백필 완료: ${byComment.size}개 (영향 ${upserted})`);

  // 2) parsedtimelines.originalComment 제거 (공간 회수)
  if (!keepOriginal) {
    const res = await items.updateMany(
      { originalComment: { $exists: true } },
      { $unset: { originalComment: '' } },
    );
    console.log(`✅ originalComment 제거: ${res.modifiedCount}개 항목`);
    console.log('   (디스크 공간은 컴팩션/자동 재사용으로 점진 회수됩니다)');
  } else {
    console.log('ℹ️ --keep-original: originalComment 유지(백필만 수행)');
  }
} finally {
  await close();
}
