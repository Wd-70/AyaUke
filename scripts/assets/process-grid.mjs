/**
 * AI로 생성한 "동작 그리드 시트"(마젠타 배경)를 게임용 스프라이트들로 분해한다.
 *
 *  1. 마젠타(#FF00FF 근처) → 투명
 *  2. 행(빈 가로줄) → 칸(빈 세로줄) 순으로 2D 분할
 *  3. 전체 프레임 공통 셀 크기로 통일(발 바닥 정렬 + 가로 중앙) → 모든 출력이 같은
 *     frameWidth/Height 를 가져 게임에서 단일 스케일로 사용 가능
 *  4. public/game/super-honeyz/ 에 PNG + JSON 저장
 *
 * 사용법:
 *   node scripts/assets/process-grid.mjs <입력png> "<행스펙>"
 *   행스펙: 행은 ';' 로 구분.
 *     - 단일포즈 행: 쉼표로 이름 나열   예) stand,skid,jump,death
 *     - 다중프레임 행: 이름:프레임수     예) walk:4
 *   예) node scripts/assets/process-grid.mjs asset-src/generated/aya-actions-grid.png \
 *         "stand,skid,jump,death;walk:4;run:4;prun:4"
 */
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT_DIR = path.join(ROOT, 'public/game/super-honeyz');
const TARGET_FRAME_H = 96;
const MAGENTA = [255, 0, 255];
const KEY_DIST = 130;
const PAD = 3;

function isMagenta(r, g, b) {
  const dr = r - MAGENTA[0], dg = g - MAGENTA[1], db = b - MAGENTA[2];
  return Math.sqrt(dr * dr + dg * dg + db * db) < KEY_DIST;
}

function parseSpec(spec) {
  return spec.split(';').map((rowStr) => {
    const s = rowStr.trim();
    if (s.includes(':')) {
      const [name, n] = s.split(':');
      return { type: 'packed', name: name.trim(), frames: parseInt(n, 10) };
    }
    return { type: 'singles', names: s.split(',').map((x) => x.trim()) };
  });
}

/** [start,end] 구간들을 점유 배열에서 추출 */
function segments(occ, minRun) {
  const segs = [];
  let start = -1;
  for (let i = 0; i < occ.length; i++) {
    const on = occ[i] > minRun;
    if (on && start < 0) start = i;
    if (!on && start >= 0) {
      segs.push([start, i - 1]);
      start = -1;
    }
  }
  if (start >= 0) segs.push([start, occ.length - 1]);
  return segs;
}

async function main() {
  const [, , inRel, specStr] = process.argv;
  if (!inRel || !specStr) {
    console.error('usage: process-grid.mjs <input> "<rowSpec>"');
    process.exit(1);
  }
  const spec = parseSpec(specStr);
  const inPath = path.resolve(ROOT, inRel);

  const img = sharp(inPath).ensureAlpha();
  const { width, height } = await img.metadata();
  const raw = await img.raw().toBuffer();

  // 1) 마젠타 → 투명
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    if (isMagenta(raw[o], raw[o + 1], raw[o + 2])) raw[o + 3] = 0;
  }
  const alphaAt = (x, y) => raw[(y * width + x) * 4 + 3] > 16;

  // 2) 행 분할
  const rowOcc = new Array(height).fill(0);
  for (let y = 0; y < height; y++) {
    let c = 0;
    for (let x = 0; x < width; x++) if (alphaAt(x, y)) c++;
    rowOcc[y] = c;
  }
  const rowBands = segments(rowOcc, Math.max(2, Math.floor(width * 0.004))).filter(
    ([a, b]) => b - a + 1 >= height * 0.04,
  );
  console.log(`행 ${rowBands.length}개 감지 (스펙 ${spec.length}행)`);
  if (rowBands.length !== spec.length) {
    console.warn('⚠ 감지된 행 수가 스펙과 다릅니다. 결과를 확인하세요.');
  }

  // 3) 열 경계는 "전체 행을 합친 점유도"로 잡아 모든 행에 동일 격자를 적용한다.
  //    (행 하나에서 다리·먼지가 칸 사이 빈 열을 메워도, 다른 행들이 잡아줌)
  const nCols = Math.max(...spec.map((r) => (r.type === 'packed' ? r.frames : r.names.length)));
  const globalCol = new Array(width).fill(0);
  for (let x = 0; x < width; x++) {
    let c = 0;
    for (let y = 0; y < height; y++) if (alphaAt(x, y)) c++;
    globalCol[x] = c;
  }
  let xMin = 0;
  while (xMin < width && globalCol[xMin] === 0) xMin++;
  let xMax = width - 1;
  while (xMax > 0 && globalCol[xMax] === 0) xMax--;

  // [xMin,xMax] 안에서 점유도가 낮은 "골짜기" 구간들을 찾아, 넓은 순으로 nCols-1개를 칸 경계로 사용
  const peak = Math.max(...globalCol);
  const valleyThresh = peak * 0.12;
  const valleys = [];
  let vs = -1;
  for (let x = xMin; x <= xMax; x++) {
    const low = globalCol[x] <= valleyThresh;
    if (low && vs < 0) vs = x;
    if (!low && vs >= 0) {
      valleys.push([vs, x - 1]);
      vs = -1;
    }
  }
  if (vs >= 0) valleys.push([vs, xMax]);
  const cuts = valleys
    .map(([a, b]) => ({ mid: Math.round((a + b) / 2), w: b - a + 1 }))
    .sort((p, q) => q.w - p.w)
    .slice(0, nCols - 1)
    .map((c) => c.mid)
    .sort((a, b) => a - b);
  const colBands = [];
  let prev = xMin;
  for (const cut of cuts) {
    colBands.push([prev, cut]);
    prev = cut + 1;
  }
  colBands.push([prev, xMax]);
  console.log(`열 ${colBands.length}개 경계 (기대 ${nCols})`);

  // 각 행 × 각 열 밴드에서 bbox 계산
  const bbox = (x0, x1, y0, y1) => {
    let top = y1, bottom = y0 - 1, left = x1, right = x0 - 1;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (alphaAt(x, y)) {
          if (y < top) top = y;
          if (y > bottom) bottom = y;
          if (x < left) left = x;
          if (x > right) right = x;
        }
      }
    }
    if (bottom < top) return null; // 빈 칸
    return { left, right, top, bottom, w: right - left + 1, h: bottom - top + 1 };
  };

  const allFrames = [];
  const rowFrames = [];
  rowBands.forEach(([y0, y1], ri) => {
    const boxes = [];
    for (const [cx0, cx1] of colBands) {
      const b = bbox(cx0, cx1, y0, y1);
      if (b) boxes.push(b);
    }
    rowFrames[ri] = boxes;
    boxes.forEach((b) => allFrames.push(b));
    console.log(`  행 ${ri}: ${boxes.length}칸`);
  });

  // 4) 전체 공통 셀 크기 (발 정렬 + 가로 중앙)
  const cellW = Math.max(...allFrames.map((b) => b.w)) + PAD * 2;
  const cellH = Math.max(...allFrames.map((b) => b.h)) + PAD * 2;
  const scale = cellH > TARGET_FRAME_H ? TARGET_FRAME_H / cellH : 1;
  const sCellW = Math.round(cellW * scale);
  const sCellH = Math.round(cellH * scale);

  await fs.mkdir(OUT_DIR, { recursive: true });

  const blit = (dst, dstW, box, cellX) => {
    const dx = cellX + Math.floor((cellW - box.w) / 2) - box.left;
    const dy = cellH - PAD - box.bottom;
    for (let y = box.top; y <= box.bottom; y++) {
      for (let x = box.left; x <= box.right; x++) {
        const si = (y * width + x) * 4;
        if (raw[si + 3] <= 16) continue;
        const ox = x + dx, oy = y + dy;
        if (ox < 0 || ox >= dstW || oy < 0 || oy >= cellH) continue;
        const di = (oy * dstW + ox) * 4;
        dst[di] = raw[si];
        dst[di + 1] = raw[si + 1];
        dst[di + 2] = raw[si + 2];
        dst[di + 3] = raw[si + 3];
      }
    }
  };

  const writeSheet = async (name, boxes) => {
    const n = boxes.length;
    const outW = cellW * n;
    const buf = Buffer.alloc(outW * cellH * 4, 0);
    boxes.forEach((b, i) => blit(buf, outW, b, i * cellW));
    const sOutW = sCellW * n;
    await sharp(buf, { raw: { width: outW, height: cellH, channels: 4 } })
      .resize(sOutW, sCellH, { fit: 'fill', kernel: 'lanczos3' })
      .png()
      .toFile(path.join(OUT_DIR, `${name}.png`));
    await fs.writeFile(
      path.join(OUT_DIR, `${name}.json`),
      JSON.stringify({ image: `${name}.png`, frameWidth: sCellW, frameHeight: sCellH, frames: n }, null, 2),
    );
    console.log(`  ✔ ${name}.png (${sCellW}x${sCellH} × ${n})`);
  };

  // 5) 스펙대로 출력
  for (let ri = 0; ri < spec.length; ri++) {
    const row = spec[ri];
    const boxes = rowFrames[ri] || [];
    if (row.type === 'packed') {
      await writeSheet(row.name, boxes.slice(0, row.frames));
    } else {
      for (let i = 0; i < row.names.length; i++) {
        if (boxes[i]) await writeSheet(row.names[i], [boxes[i]]);
      }
    }
  }

  console.log(`완료: 공통 프레임 ${sCellW}x${sCellH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
