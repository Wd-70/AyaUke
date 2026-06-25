// 방종셀카: 수집한 X status URL 목록을 syndication API로 훑어 메타데이터만 받아온다(이미지 다운로드 X).
// 방종셀카(채팅창 포함 와이드 셀카)는 가로세로비가 큰 편이라, 비율·사진수·날짜로 후보를 좁히는 데 쓴다.
// 입력: selfie-archive/_x/media-urls.json ([{id,url}]).  출력: selfie-archive/_x/probe.json
// 사용: node scripts/selfie/x-probe.mjs [--max-id=1857792403681456419] [--min-ratio=1.9]
import fs from 'node:fs';
import path from 'node:path';

const arg = (k) => { const m = process.argv.find((a) => a.startsWith(`--${k}=`)); return m ? m.slice(k.length + 3) : undefined; };
const maxId = arg('max-id');
const minRatio = parseFloat(arg('min-ratio') || '1.9');

const DIR = path.join(process.cwd(), 'selfie-archive', '_x');
const items = JSON.parse(fs.readFileSync(path.join(DIR, 'media-urls.json'), 'utf8'));
const list = maxId ? items.filter((i) => BigInt(i.id) <= BigInt(maxId)) : items;
console.error(`프로브 대상 ${list.length}개 (전체 ${items.length})`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tokenOf = (id) => ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, '');

async function probe(id) {
  const url = `https://cdn.syndication.twimg.com/tweet-result?id=${id}&token=${tokenOf(id)}&lang=ko`;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' } });
      if (r.status === 429) { await sleep(4000 * (attempt + 1)); continue; }
      if (!r.ok) return { id, error: `HTTP ${r.status}` };
      const t = await r.json();
      if (!t || t.__typename === 'TweetTombstone') return { id, error: 'tombstone' };
      const photos = (t.mediaDetails || []).filter((m) => m.type === 'photo');
      const dims = photos.map((m) => ({ w: m.original_info?.width || 0, h: m.original_info?.height || 0 }));
      const ratios = dims.map((d) => (d.h ? +(d.w / d.h).toFixed(3) : 0));
      const date = new Date(t.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
      return {
        id, date, screen: t.user?.screen_name,
        photoCount: photos.length,
        firstRatio: ratios[0] || 0,
        maxRatio: ratios.length ? Math.max(...ratios) : 0,
        ratios, dims,
        text: (t.text || '').replace(/\s+/g, ' ').slice(0, 60),
      };
    } catch (e) { await sleep(1500); }
  }
  return { id, error: 'failed' };
}

const out = [];
let done = 0;
for (const it of list) {
  out.push(await probe(it.id));
  if (++done % 25 === 0) process.stderr.write(`\r  ${done}/${list.length}`);
  await sleep(250);
}
process.stderr.write(`\r  ${done}/${list.length}\n`);

fs.writeFileSync(path.join(DIR, 'probe.json'), JSON.stringify(out, null, 0), 'utf8');
const ok = out.filter((o) => !o.error);
const wide = ok.filter((o) => o.maxRatio >= minRatio);
const errs = out.filter((o) => o.error);
console.error(`완료: 성공 ${ok.length} · 실패 ${errs.length}`);
console.error(`와이드(maxRatio>=${minRatio}) 후보: ${wide.length}개`);
// 날짜별 와이드 후보 요약(최신→과거)
const byDate = {};
for (const w of wide) (byDate[w.date] ||= []).push(w);
for (const d of Object.keys(byDate).sort().reverse()) {
  console.log(`${d}  ${byDate[d].length}건  ${byDate[d].map((w) => `${w.firstRatio}(${w.photoCount}장)`).join(' ')}`);
}
