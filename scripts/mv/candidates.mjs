// MV 적용 후보 클립 조회 (읽기 전용 — DB 쓰기 없음)
//
// 사용법: npm run mv:candidates [-- --tolerance=5]
//
// src/components/mv/approved-clips.json의 곡마다 같은 곡 클립을 훑어
//   - 승인됨: 승인 당시 범위 그대로인지(바뀌었으면 MV가 꺼져 있으니 재검수 필요)
//   - 후보: 길이가 기준 ±tolerance초 이내인데 아직 승인/제외되지 않은 클립
// 을 보여준다. 후보는 화면(솔로·구도)과 싱크를 검수한 뒤 승인 목록에 올린다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb } from '../db/client.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const approved = JSON.parse(fs.readFileSync(path.join(root, 'src/components/mv/approved-clips.json'), 'utf8'));
const tolArg = process.argv.find((a) => a.startsWith('--tolerance='));
const tolerance = tolArg ? Number(tolArg.split('=')[1]) : 5;
const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.ayauke.com';

const kstDate = (d) => (d ? new Date(d).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }) : '?');

const { db, close } = await getDb();
try {
  for (const [songId, song] of Object.entries(approved)) {
    const clips = await db
      .collection('songvideos')
      .find({ songId }, { projection: { shareId: 1, platform: 1, startTime: 1, endTime: 1, sungDate: 1, sourceUnavailable: 1 } })
      .sort({ sungDate: -1 })
      .toArray();
    const ok = new Map(song.clips.map((c) => [c.shareId, c]));
    const rejected = new Map((song.rejected ?? []).map((c) => [c.shareId, c]));
    console.log(`\n■ ${song.title} (${songId}) — 기준 ${song.duration}s ±${tolerance}s, 같은 곡 클립 ${clips.length}개`);

    for (const c of clips) {
      const len = (c.endTime ?? 0) - (c.startTime ?? 0);
      const line = `${kstDate(c.sungDate)}  ${(c.platform ?? 'youtube').padEnd(7)} ${c.shareId}  ${String(len).padStart(4)}s  ${base}/clip/${c.shareId}`;
      const a = ok.get(c.shareId);
      if (a) {
        const same = a.startTime === c.startTime && a.endTime === c.endTime;
        console.log(`  ${same ? '✓ 승인됨  ' : '⚠ 범위변경'} ${line}${same ? '' : `  (승인 당시 ${a.startTime}~${a.endTime})`}`);
      } else if (rejected.has(c.shareId)) {
        console.log(`  ✗ 제외    ${line}  — ${rejected.get(c.shareId).reason}`);
      } else if (c.endTime != null && Math.abs(len - song.duration) <= tolerance) {
        console.log(`  ? 후보    ${line}${c.sourceUnavailable ? '  (원본 재생 불가)' : ''}`);
      }
    }
  }
} finally {
  await close();
}
