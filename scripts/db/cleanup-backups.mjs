// 운영 DB 안의 backups / backup_logs 컬렉션 정리 (파괴적 — --confirm 필수)
//
// 사용법:
//   node scripts/db/cleanup-backups.mjs            # 통계만 출력 (안전)
//   node scripts/db/cleanup-backups.mjs --confirm  # 실제 drop 실행
//
// 사전 조건: scripts/db/backup.mjs 로 로컬 백업을 먼저 떠 둘 것.
import { getDb } from './client.mjs';

const TARGETS = ['backups', 'backup_logs'];
const confirmed = process.argv.includes('--confirm');

const { db, close } = await getDb();
try {
  const existing = (await db.listCollections().toArray()).map((c) => c.name);
  const stats = [];
  for (const name of TARGETS.filter((t) => existing.includes(t))) {
    const s = await db.command({ collStats: name }).catch(() => null);
    stats.push({
      collection: name,
      count: s?.count ?? (await db.collection(name).estimatedDocumentCount()),
      sizeMB: s ? +(s.size / 1048576).toFixed(2) : null,
    });
  }
  console.log(JSON.stringify({ targets: stats, confirmed }, null, 2));

  if (!stats.length) {
    console.log('정리할 컬렉션이 없습니다.');
  } else if (!confirmed) {
    console.log('\n위 컬렉션을 삭제하려면 --confirm 플래그를 추가하세요.');
  } else {
    for (const { collection } of stats) {
      await db.collection(collection).drop();
      console.log(`  ✗ dropped: ${collection}`);
    }
  }
} finally {
  await close();
}
