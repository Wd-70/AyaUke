// 보존기간이 지나 사라진 치지직 다시보기의 타임라인을 제외 표기한다.
//
// 치지직 다시보기는 보존기간이 있어 오래된 영상이 삭제된다. 현재 남아있는
// 가장 오래된 다시보기는 videoNo 12151700 (2026-03-10). 그보다 이전 영상
// (videoNo < 12151700)의 치지직 타임라인은 원본 다시보기가 없어 치지직
// 라이브 클립으로 활용할 수 없으므로 isExcluded=true 로 표기한다.
//
// 유튜브 타임라인은 영상이 유지되므로 대상이 아니다.
//
// 사용법:
//   node scripts/db/exclude-expired-chzzk.mjs           # dry-run
//   node scripts/db/exclude-expired-chzzk.mjs --apply
import { getDb } from './client.mjs';

const apply = process.argv.includes('--apply');
const CUTOFF_VIDEO_NO = 12151700; // 현존 최古 치지직 다시보기 (이상은 유지)

const { db, close } = await getDb();
try {
  const pt = db.collection('parsedtimelines');

  const items = await pt
    .find({ platform: 'chzzk' })
    .project({ id: 1, videoNo: 1, videoId: 1, uploadedDate: 1, isExcluded: 1, isRelevant: 1 })
    .toArray();

  const videoNoOf = (d) => d.videoNo ?? parseInt(d.videoId, 10);
  const expired = items.filter((d) => {
    const v = videoNoOf(d);
    return Number.isFinite(v) && v < CUTOFF_VIDEO_NO;
  });
  const toExclude = expired.filter((d) => d.isExcluded !== true);

  // 영상(videoNo)별 요약
  const byVideo = new Map();
  for (const d of expired) {
    const v = videoNoOf(d);
    if (!byVideo.has(v)) byVideo.set(v, { count: 0, date: d.uploadedDate });
    byVideo.get(v).count++;
  }
  const videoList = [...byVideo.entries()].sort((a, b) => b[0] - a[0]);

  console.log('━━━ 만료된 치지직 다시보기 타임라인 제외 ━━━');
  console.log(`기준: videoNo < ${CUTOFF_VIDEO_NO} (2026-03-10 이전)`);
  console.log(`chzzk 타임라인 ${items.length}개 중 만료 영상 타임라인 ${expired.length}개 (영상 ${byVideo.size}개)`);
  console.log(`  이미 제외 ${expired.length - toExclude.length}개 → 신규 제외 ${toExclude.length}개`);
  console.log('\n[영상별 (videoNo | 날짜 | 항목수)]');
  for (const [v, info] of videoList) {
    console.log(`  ${v} | ${new Date(info.date).toISOString().slice(0, 10)} | ${info.count}개`);
  }

  if (!apply) {
    console.log('\n[dry-run] 변경 없음. --apply 로 적용.');
    await close();
    process.exit(0);
  }

  const ops = toExclude.map((d) => ({
    updateOne: { filter: { id: d.id }, update: { $set: { isExcluded: true, updatedAt: new Date() } } },
  }));
  let modified = 0;
  for (let i = 0; i < ops.length; i += 500) {
    const r = await pt.bulkWrite(ops.slice(i, i + 500), { ordered: false });
    modified += r.modifiedCount || 0;
  }
  console.log(`\n✅ 적용 완료: ${modified}개 제외 표기`);
} finally {
  await close();
}
