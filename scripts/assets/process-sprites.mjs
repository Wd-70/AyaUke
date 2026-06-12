/**
 * 생성된 AI 스프라이트(마젠타 크로마키 배경)를 게임용 스프라이트 시트로 가공한다.
 *
 *  1. 마젠타(#FF00FF 근처) 배경 → 투명 처리
 *  2. 가로로 늘어선 프레임들을 "빈 열" 기준으로 자동 분할
 *  3. 각 프레임의 실제 바운딩박스를 구해 → 발(아래)·가로중앙 정렬로 균등 셀에 재배치
 *  4. public/game/super-honeyz/ 에 PNG로 저장 + 메타(JSON) 기록
 *
 * 사용법:
 *   node scripts/assets/process-sprites.mjs <입력png> <출력이름> [기대프레임수]
 *   예) node scripts/assets/process-sprites.mjs asset-src/generated/aya-base-walk-sheet.png aya-walk 4
 */
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT_DIR = path.join(ROOT, 'public/game/super-honeyz');

// 마젠타로 간주할 거리 임계값 (대상: 255,0,255)
const MAGENTA = [255, 0, 255];
const KEY_DIST = 130; // 이 거리 이내면 배경으로 보고 투명화

function isMagenta(r, g, b) {
  const dr = r - MAGENTA[0];
  const dg = g - MAGENTA[1];
  const db = b - MAGENTA[2];
  return Math.sqrt(dr * dr + dg * dg + db * db) < KEY_DIST;
}

async function main() {
  const [, , inRel, outName, framesArg] = process.argv;
  if (!inRel || !outName) {
    console.error('usage: process-sprites.mjs <input> <outName> [expectedFrames]');
    process.exit(1);
  }
  const expectedFrames = framesArg ? parseInt(framesArg, 10) : 1;
  const inPath = path.resolve(ROOT, inRel);

  const img = sharp(inPath).ensureAlpha();
  const { width, height } = await img.metadata();
  const raw = await img.raw().toBuffer(); // RGBA, width*height*4

  // 1) 마젠타 → 투명 + 알파 마스크/열 점유도 계산
  const colOccupied = new Array(width).fill(0);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = raw[i], g = raw[i + 1], b = raw[i + 2];
      if (isMagenta(r, g, b)) {
        raw[i + 3] = 0; // 투명
      } else {
        colOccupied[x]++;
      }
    }
  }

  // 2) 빈 열(점유 픽셀이 거의 없는 열)을 경계로 프레임 분할
  const MIN_COL = Math.max(2, Math.floor(height * 0.01));
  const segments = [];
  let start = -1;
  for (let x = 0; x < width; x++) {
    const filled = colOccupied[x] > MIN_COL;
    if (filled && start < 0) start = x;
    if (!filled && start >= 0) {
      segments.push([start, x - 1]);
      start = -1;
    }
  }
  if (start >= 0) segments.push([start, width - 1]);

  // 너무 좁은 조각(노이즈) 제거
  const minSegW = Math.floor(width / (expectedFrames * 4 + 1));
  let frames = segments.filter(([a, b]) => b - a + 1 >= minSegW);

  console.log(`감지된 프레임 구간: ${frames.length}개 (기대 ${expectedFrames})`);
  frames.forEach(([a, b], idx) => console.log(`  #${idx}: x ${a}~${b} (w=${b - a + 1})`));

  // 3) 각 프레임의 정밀 바운딩박스 (행/열 모두)
  const boxes = frames.map(([x0, x1]) => {
    let top = height, bottom = -1, left = x1, right = x0;
    for (let y = 0; y < height; y++) {
      for (let x = x0; x <= x1; x++) {
        if (raw[(y * width + x) * 4 + 3] > 16) {
          if (y < top) top = y;
          if (y > bottom) bottom = y;
          if (x < left) left = x;
          if (x > right) right = x;
        }
      }
    }
    return { left, right, top, bottom, w: right - left + 1, h: bottom - top + 1 };
  });

  // 4) 균등 셀 크기 = 최대폭/최대높이 + 여백, 발(아래)·가로중앙 정렬로 재배치
  const pad = 2;
  const cellW = Math.max(...boxes.map((b) => b.w)) + pad * 2;
  const cellH = Math.max(...boxes.map((b) => b.h)) + pad * 2;

  const outW = cellW * boxes.length;
  const outBuf = Buffer.alloc(outW * cellH * 4, 0);

  boxes.forEach((box, fi) => {
    const cellX = fi * cellW;
    const dx = cellX + Math.floor((cellW - box.w) / 2) - box.left; // 가로 중앙
    const dy = cellH - pad - box.bottom; // 발을 셀 바닥(여백 위)에 정렬
    for (let y = box.top; y <= box.bottom; y++) {
      for (let x = box.left; x <= box.right; x++) {
        const si = (y * width + x) * 4;
        if (raw[si + 3] <= 16) continue;
        const ox = x + dx;
        const oy = y + dy;
        if (ox < 0 || ox >= outW || oy < 0 || oy >= cellH) continue;
        const di = (oy * outW + ox) * 4;
        outBuf[di] = raw[si];
        outBuf[di + 1] = raw[si + 1];
        outBuf[di + 2] = raw[si + 2];
        outBuf[di + 3] = raw[si + 3];
      }
    }
  });

  // 게임은 16px 타일 기준이라 원본(수백 px)을 그대로 쓰면 과도한 다운스케일.
  // sharp의 고품질 리샘플로 프레임 높이를 적당히 줄여둔다.
  const TARGET_FRAME_H = 96;
  const scale = cellH > TARGET_FRAME_H ? TARGET_FRAME_H / cellH : 1;
  const sCellW = Math.round(cellW * scale);
  const sCellH = Math.round(cellH * scale);
  const sOutW = sCellW * boxes.length;

  await fs.mkdir(OUT_DIR, { recursive: true });
  const outPng = path.join(OUT_DIR, `${outName}.png`);
  await sharp(outBuf, { raw: { width: outW, height: cellH, channels: 4 } })
    .resize(sOutW, sCellH, { fit: 'fill', kernel: 'lanczos3' })
    .png()
    .toFile(outPng);

  const meta = { image: `${outName}.png`, frameWidth: sCellW, frameHeight: sCellH, frames: boxes.length };
  await fs.writeFile(path.join(OUT_DIR, `${outName}.json`), JSON.stringify(meta, null, 2));

  console.log(`✔ 저장: ${path.relative(ROOT, outPng)}  (${sCellW}x${sCellH} × ${boxes.length}프레임)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
