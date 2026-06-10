// 읽기 전용 DB 인스펙션 CLI — 쓰기 연산 없음
//
// 사용법:
//   node scripts/db/inspect.mjs collections
//   node scripts/db/inspect.mjs sample <collection> [n=3]
//   node scripts/db/inspect.mjs query <collection> '<json filter>' [--limit=20] [--project='{"field":1}']
//   node scripts/db/inspect.mjs count <collection> ['<json filter>']
//   node scripts/db/inspect.mjs indexes <collection>
//   node scripts/db/inspect.mjs schema <collection> [n=100]   # 필드 빈도/타입 리포트
import { getDb } from './client.mjs';

const [, , command, ...rest] = process.argv;
const args = rest.filter((a) => !a.startsWith('--'));
const flag = (name, def) => {
  const f = rest.find((a) => a.startsWith(`--${name}=`));
  return f ? f.slice(name.length + 3) : def;
};

const print = (v) => console.log(JSON.stringify(v, null, 2));

function parseFilter(raw) {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`필터 JSON 파싱 실패: ${raw}`);
  }
}

const { db, close } = await getDb();
try {
  switch (command) {
    case 'collections': {
      const cols = await db.listCollections().toArray();
      const rows = [];
      for (const c of cols.sort((a, b) => a.name.localeCompare(b.name))) {
        const stats = await db.command({ collStats: c.name }).catch(() => null);
        rows.push({
          name: c.name,
          count: stats?.count ?? (await db.collection(c.name).estimatedDocumentCount()),
          sizeMB: stats ? +(stats.size / 1048576).toFixed(2) : null,
          avgDocKB: stats?.avgObjSize ? +(stats.avgObjSize / 1024).toFixed(2) : null,
        });
      }
      print(rows);
      break;
    }
    case 'sample': {
      const [coll, n = '3'] = args;
      if (!coll) throw new Error('컬렉션 이름이 필요합니다.');
      const docs = await db.collection(coll).aggregate([{ $sample: { size: Number(n) } }]).toArray();
      print(docs);
      break;
    }
    case 'query': {
      const [coll, rawFilter] = args;
      if (!coll) throw new Error('컬렉션 이름이 필요합니다.');
      const cursor = db.collection(coll).find(parseFilter(rawFilter), {
        limit: Number(flag('limit', '20')),
        projection: flag('project') ? JSON.parse(flag('project')) : undefined,
      });
      print(await cursor.toArray());
      break;
    }
    case 'count': {
      const [coll, rawFilter] = args;
      if (!coll) throw new Error('컬렉션 이름이 필요합니다.');
      print({ collection: coll, count: await db.collection(coll).countDocuments(parseFilter(rawFilter)) });
      break;
    }
    case 'indexes': {
      const [coll] = args;
      if (!coll) throw new Error('컬렉션 이름이 필요합니다.');
      print(await db.collection(coll).indexes());
      break;
    }
    case 'schema': {
      const [coll, n = '100'] = args;
      if (!coll) throw new Error('컬렉션 이름이 필요합니다.');
      const docs = await db.collection(coll).aggregate([{ $sample: { size: Number(n) } }]).toArray();
      const fields = {};
      for (const doc of docs) {
        for (const [k, v] of Object.entries(doc)) {
          const type = v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v === 'object' && v?._bsontype === 'ObjectId' ? 'ObjectId' : v instanceof Date ? 'Date' : typeof v;
          fields[k] ??= { count: 0, types: {} };
          fields[k].count++;
          fields[k].types[type] = (fields[k].types[type] ?? 0) + 1;
        }
      }
      const report = Object.entries(fields)
        .sort((a, b) => b[1].count - a[1].count)
        .map(([name, info]) => ({
          field: name,
          presence: `${info.count}/${docs.length}`,
          types: info.types,
        }));
      print({ collection: coll, sampled: docs.length, fields: report });
      break;
    }
    default:
      console.log(`사용법:
  node scripts/db/inspect.mjs collections
  node scripts/db/inspect.mjs sample <collection> [n=3]
  node scripts/db/inspect.mjs query <collection> '<json filter>' [--limit=20] [--project='{...}']
  node scripts/db/inspect.mjs count <collection> ['<json filter>']
  node scripts/db/inspect.mjs indexes <collection>
  node scripts/db/inspect.mjs schema <collection> [n=100]`);
      process.exitCode = command ? 1 : 0;
  }
} finally {
  await close();
}
