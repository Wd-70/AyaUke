// 곡 제목(songTitle)의 형식을 일반 항목에 맞춰 정리한다.
//
// 합방 댓글에서 새어든 군더더기만 제거하고, 버전/OST/읽기 괄호 등 정상 주석은 보존:
//   - "// 참여자..." 꼬리 제거 (합방 참여자 표기)
//   - 참여자/하트 이모지가 든 괄호 제거: (아야💜 + 🧡🩵❤), (디용, 카린🧡❤)
//   - 끝 리스트 번호 제거: " 12.", " 72, 73."
//   - 떠다니는 장식 이모지(하트/꽃 등) 제거
// 결과가 비거나 과도하게 짧아지면 원본을 유지(안전).
//
// 사용법:
//   node scripts/db/clean-title-format.mjs           # dry-run (before→after 전체 출력)
//   node scripts/db/clean-title-format.mjs --apply
import { getDb } from './client.mjs';

const apply = process.argv.includes('--apply');

const PARTICIPANT = '(아야|카린|에리스|디용|화요|띠용|망내|전원|허츄|유이|주주주령|디디디용|류시호|담유이|오화요)';
const HEART_OR_DECO = /[❤❥\u{2764}\u{1F493}-\u{1F49F}\u{1F90D}\u{1F90E}\u{1F5A4}\u{1FA70}-\u{1FAFF}\u{1F300}-\u{1F5FF}\u{2600}-\u{27BF}\u{2728}\u{2705}\u{2620}\u{2190}-\u{21FF}]/u;

function cleanTitle(raw) {
  let t = raw || '';
  // 1) "// ..." 꼬리 제거
  t = t.split('//')[0];
  // 2) 참여자/이모지가 든 괄호 제거
  t = t.replace(/[(（]([^)）]*)[)）]/g, (m, inner) => {
    if (new RegExp(PARTICIPANT).test(inner) || HEART_OR_DECO.test(inner)) return ' ';
    return m; // 정상 주석(버전/OST/읽기)은 보존
  });
  // 3) 떠다니는 장식 이모지 제거
  t = t.replace(new RegExp(HEART_OR_DECO.source, 'gu'), ' ');
  // 4) 끝 리스트 번호 제거: " 12." / " 72, 73."
  //    (끝의 ?, ~ 는 제목 일부일 수 있어 건드리지 않는다: "What is love?", "~君がくれたもの~")
  t = t.replace(/\s*\d+(\s*,\s*\d+)*\s*\.\s*$/, ' ');
  // 5) 공백/잔여 구두점 정리 (끝의 ?,~ 보존)
  t = t.replace(/\s+/g, ' ').replace(/\s*\(\s*\)\s*/g, ' ').trim();
  t = t.replace(/[\s,]+$/, '').replace(/\s+\+$/, '').trim();
  return t;
}

const { db, close } = await getDb();
try {
  const pt = db.collection('parsedtimelines');
  const items = await pt.find({ isRelevant: true }).project({ id: 1, songTitle: 1 }).toArray();

  const changes = [];
  for (const it of items) {
    const cleaned = cleanTitle(it.songTitle);
    // 한글 1글자 곡명(와/멍/썸 등)도 허용. 단 결과가 한글/영숫자를 포함해야 함(장식만 남는 것 방지)
    if (cleaned && cleaned !== it.songTitle && cleaned.length >= 1 && /[\w가-힣]/.test(cleaned)) {
      changes.push({ id: it.id, from: it.songTitle, to: cleaned });
    }
  }

  console.log(`━━━ 제목 형식 정리 ━━━`);
  console.log(`관련 항목 ${items.length} → 변경 대상 ${changes.length}개\n`);
  for (const c of changes) console.log(`  "${c.from.slice(0, 50)}"\n   → "${c.to.slice(0, 50)}"`);

  if (!apply) { console.log('\n[dry-run] 변경 없음. --apply 로 적용.'); await close(); process.exit(0); }

  const ops = changes.map((c) => ({ updateOne: { filter: { id: c.id }, update: { $set: { songTitle: c.to, updatedAt: new Date() } } } }));
  let modified = 0;
  for (let i = 0; i < ops.length; i += 500) { const r = await pt.bulkWrite(ops.slice(i, i + 500), { ordered: false }); modified += r.modifiedCount || 0; }
  console.log(`\n✅ 적용 완료: ${modified}개 제목 정리`);
} finally {
  await close();
}
