// 방종셀카: 치지직 VOD 채팅 로그에서 닉네임 보조 사전을 만든다.
// 소스: clipnote 등에서 미리 수집한 CHZZK_*/chat.json ([{time,content,nickname,type}]).
// 출력: selfie-archive/_nick-dict.json  [{nickname, normalized, vodCount, msgCount}] (vodCount desc)
//   vodCount = 그 닉이 등장한 VOD 수(=단골 지표), msgCount = 총 메시지 수.
// 매칭은 정규화 기준이라 |, 공백, 문장부호 차이는 자동 흡수된다.
// 사용: node scripts/selfie/build-nick-dict.mjs "F:/Data/Git/Nextjs/clipnote/temp/queue-data" [--min=2]
import fs from 'node:fs';
import path from 'node:path';

const src = process.argv[2];
if (!src || !fs.existsSync(src)) { console.error('소스 경로가 필요합니다(CHZZK_*/chat.json 들이 있는 폴더).'); process.exit(1); }
const min = Number((process.argv.find((a) => a.startsWith('--min=')) || '--min=2').slice(6));

const normalize = (s) => (s || '').toLowerCase().trim().replace(/\s+/g, '').replace(/[-_.,!?()[\]{}]/g, '').replace(/[^\w가-힣]/g, '');

const dirs = fs.readdirSync(src).filter((d) => d.startsWith('CHZZK_') && fs.existsSync(path.join(src, d, 'chat.json')));
const agg = new Map(); // normalized -> { nickname(대표), variants:Map<disp,cnt>, vodCount, msgCount }

for (const d of dirs) {
  let arr;
  try { arr = JSON.parse(fs.readFileSync(path.join(src, d, 'chat.json'), 'utf8')); } catch { continue; }
  const seen = new Set();
  for (const m of arr) {
    const disp = (m.nickname || '').trim();
    const norm = normalize(disp);
    if (!norm) continue;
    let e = agg.get(norm);
    if (!e) { e = { normalized: norm, variants: new Map(), vodCount: 0, msgCount: 0 }; agg.set(norm, e); }
    e.msgCount += 1;
    e.variants.set(disp, (e.variants.get(disp) || 0) + 1);
    if (!seen.has(norm)) { seen.add(norm); e.vodCount += 1; }
  }
}

const out = [...agg.values()]
  .filter((e) => e.vodCount >= min)
  .map((e) => {
    // 대표 표시명 = 가장 많이 쓰인 변형
    const disp = [...e.variants.entries()].sort((a, b) => b[1] - a[1])[0][0];
    return { nickname: disp, normalized: e.normalized, vodCount: e.vodCount, msgCount: e.msgCount };
  })
  .sort((a, b) => b.vodCount - a.vodCount || b.msgCount - a.msgCount);

const dstDir = path.join(process.cwd(), 'selfie-archive');
fs.mkdirSync(dstDir, { recursive: true });
fs.writeFileSync(path.join(dstDir, '_nick-dict.json'), JSON.stringify(out));
console.log(`사전 생성: selfie-archive/_nick-dict.json  (${out.length}개, VOD ${dirs.length}개, min=${min})`);
console.log('상위 10:', out.slice(0, 10).map((e) => `${e.nickname}(${e.vodCount})`).join(', '));
