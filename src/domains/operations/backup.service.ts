import mongoose from 'mongoose';

/**
 * DB 백업 내보내기 — 모든 컬렉션을 JSON으로 스트리밍한다.
 * 구 방식(운영 DB의 backups 컬렉션에 저장)은 폐기되었고,
 * 항상 다운로드 파일로만 내보낸다. DB에는 아무것도 쓰지 않는다.
 */

/** 시스템 컬렉션과 폐기된 백업 잔재는 제외 */
const EXCLUDED_COLLECTIONS = new Set(['backups', 'backup_logs']);

/**
 * 전체 컬렉션을 하나의 JSON 문서로 스트리밍하는 ReadableStream을 만든다.
 * 형식: { exportedAt, collections: { <name>: [docs...] } }
 */
export function createBackupStream(): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const db = mongoose.connection.db!;

  return new ReadableStream({
    async start(controller) {
      const send = (text: string) => controller.enqueue(encoder.encode(text));

      try {
        const collections = (await db.listCollections().toArray())
          .map((c) => c.name)
          .filter((name) => !EXCLUDED_COLLECTIONS.has(name) && !name.startsWith('system.'))
          .sort();

        send(`{"exportedAt":${JSON.stringify(new Date().toISOString())},"collections":{`);

        for (let i = 0; i < collections.length; i++) {
          const name = collections[i];
          send(`${i > 0 ? ',' : ''}${JSON.stringify(name)}:[`);

          let first = true;
          for await (const doc of db.collection(name).find()) {
            send(`${first ? '' : ','}${JSON.stringify(doc)}`);
            first = false;
          }

          send(']');
        }

        send('}}');
        controller.close();
      } catch (error) {
        console.error('백업 스트리밍 오류:', error);
        controller.error(error);
      }
    },
  });
}

/** 컬렉션별 문서 수/크기 요약 (유지보수 화면 표시용, 읽기 전용) */
export async function getCollectionSummary() {
  const db = mongoose.connection.db!;
  const collections = await db.listCollections().toArray();

  const summary = [];
  for (const c of collections.sort((a, b) => a.name.localeCompare(b.name))) {
    if (c.name.startsWith('system.')) continue;
    const stats = await db.command({ collStats: c.name }).catch(() => null);
    summary.push({
      name: c.name,
      count: stats?.count ?? (await db.collection(c.name).estimatedDocumentCount()),
      sizeMB: stats ? +(stats.size / 1048576).toFixed(2) : null,
    });
  }
  return summary;
}
