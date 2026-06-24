// 방종셀카: 여러 글의 이미지를 격자(콘택트 시트) 한 장으로 합쳐 빠르게 훑어본다.
// peek 결과(글별 첫 이미지 URL)를 모아 stdin(JSON)으로 넘기면 라벨(articleid) 붙은 시트 PNG를 만든다.
// Claude가 그 시트를 Read(vision)로 보고 "채팅창 있는 방종셀카"만 골라낸다.
//
// 입력(stdin JSON): [{ "id": "107774", "imageUrl": "https://.../xxx.png" }, ...]
// 사용:
//   echo '[{"id":"107774","imageUrl":"https://..."}]' | node scripts/selfie/contact-sheet.mjs
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

let raw = '';
for await (const c of process.stdin) raw += c;
let items;
try { items = JSON.parse(raw || '[]'); } catch (e) { console.error('stdin JSON 파싱 실패:', e.message); process.exit(1); }
if (!Array.isArray(items) || items.length === 0) { console.error('입력이 비었습니다. [{id,imageUrl}] 배열 필요.'); process.exit(1); }

const COLS = Number(process.env.SHEET_COLS || 5), CW = 280, TH = 158, LH = 24, CH = TH + LH, PAD = 4;
const rows = Math.ceil(items.length / COLS);
const W = COLS * CW, H = rows * CH;

const esc = (s) => String(s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
const composites = [];
let ok = 0;
for (let i = 0; i < items.length; i++) {
  const it = items[i];
  const x = (i % COLS) * CW, y = Math.floor(i / COLS) * CH;
  const svg = `<svg width="${CW}" height="${LH}"><rect width="100%" height="100%" fill="#222"/><text x="6" y="17" font-size="13" font-family="sans-serif" fill="#fff">#${i + 1}  ${esc(it.id)}</text></svg>`;
  composites.push({ input: Buffer.from(svg), top: y, left: x });
  if (!it.imageUrl) continue;
  try {
    let buf;
    if (/^https?:/.test(it.imageUrl)) {
      const res = await fetch(it.imageUrl);
      if (!res.ok) continue;
      buf = Buffer.from(await res.arrayBuffer());
    } else {
      buf = fs.readFileSync(it.imageUrl); // 로컬 경로 지원
    }
    const thumb = await sharp(buf)
      .resize(CW - PAD * 2, TH - PAD * 2, { fit: 'contain', background: { r: 235, g: 235, b: 240 } })
      .png().toBuffer();
    composites.push({ input: thumb, top: y + LH + PAD, left: x + PAD });
    ok += 1;
  } catch (_) { /* skip */ }
}

const dir = path.join(process.cwd(), 'selfie-archive', '_sheets');
fs.mkdirSync(dir, { recursive: true });
const out = path.join(dir, `sheet-${new Date().toISOString().replace(/[:.]/g, '-')}.png`);
await sharp({ create: { width: W, height: H, channels: 3, background: { r: 255, g: 255, b: 255 } } })
  .composite(composites).png().toFile(out);
console.log(`작성: ${path.relative(process.cwd(), out).split(path.sep).join('/')}  (${items.length}칸, 이미지 ${ok}장, ${COLS}열x${rows}행)`);
