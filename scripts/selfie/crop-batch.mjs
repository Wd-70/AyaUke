// 방종셀카: 여러 세션 폴더의 채팅 크롭을 한 번에 처리(sharp 단일 프로세스).
// 대상: selfie-archive/ 아래 세션 폴더(YYYY-MM-DD 또는 YYYY-MM-DD_HHMM) 중 _chat 이 없는 것.
// 사용: node scripts/selfie/crop-batch.mjs [--source=x|all] [--ratio=0.82] [--scale=2] [--force]
import path from 'node:path';
import fs from 'node:fs/promises';
import sharp from 'sharp';

const arg = (k, d) => { const m = process.argv.find((a) => a.startsWith(`--${k}=`)); return m ? m.slice(k.length + 3) : d; };
const source = arg('source', 'x');         // x = _HHMM 접미사 세션만, all = 전부
const ratio = Number(arg('ratio', '0.82'));
const scale = Number(arg('scale', '2'));
const force = process.argv.includes('--force');

const ROOT = path.join(process.cwd(), 'selfie-archive');
const isSession = (n) => (source === 'x' ? /^\d{4}-\d{2}-\d{2}_\d{4}b*$/.test(n) : /^\d{4}-\d{2}-\d{2}(_\d{4}b*)?$/.test(n));

const entries = await fs.readdir(ROOT, { withFileTypes: true });
const sessions = entries.filter((e) => e.isDirectory() && isSession(e.name)).map((e) => e.name).sort();
console.error(`크롭 대상 후보 ${sessions.length}개 (source=${source})`);

let processed = 0, cropped = 0, skipped = 0;
for (const s of sessions) {
  const srcDir = path.join(ROOT, s);
  const dstDir = path.join(srcDir, '_chat');
  if (!force) { try { const ex = await fs.readdir(dstDir); if (ex.length) { skipped++; continue; } } catch {} }
  const files = (await fs.readdir(srcDir).catch(() => [])).filter((f) => /\.(png|jpe?g|webp)$/i.test(f));
  if (!files.length) continue;
  await fs.mkdir(dstDir, { recursive: true });
  for (const f of files) {
    try {
      const img = sharp(path.join(srcDir, f));
      const meta = await img.metadata();
      const W = meta.width || 0, H = meta.height || 0;
      const left = Math.round(W * ratio), width = W - left;
      if (width <= 0) continue;
      let pipe = img.extract({ left, top: 0, width, height: H });
      if (scale !== 1) pipe = pipe.resize(Math.round(width * scale), Math.round(H * scale), { kernel: 'lanczos3' });
      await pipe.toFile(path.join(dstDir, f));
      cropped++;
    } catch (e) { console.error(`  실패 ${s}/${f}: ${e.message}`); }
  }
  processed++;
  if (processed % 20 === 0) process.stderr.write(`\r  ${processed}/${sessions.length} 세션 · ${cropped}장`);
}
process.stderr.write('\n');
console.error(`완료: 처리 ${processed}세션 · 크롭 ${cropped}장 · 스킵(이미 있음) ${skipped}`);
