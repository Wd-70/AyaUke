// 일회성: 유튜브 클립 생성 작업 범위 분석.
// 범위: 치지직 영상 publishDate가 (2025-09-27, 2026-03-09) 사이 — 두 경계 미포함.
// 이 범위의 치지직 영상/타임라인 댓글/유튜브 매핑·오프셋 현황을 집계한다.
import { getDb } from './client.mjs';

const LOWER = new Date('2025-09-27T00:00:00.000Z'); // 미포함 (이 날짜 이후)
const UPPER = new Date('2026-03-09T00:00:00.000Z'); // 미포함 (이 날짜 이전)

const { db, close } = await getDb();
try {
  const cv = db.collection('chzzkvideos');
  const cc = db.collection('chzzkcomments');
  const pt = db.collection('parsedtimelines');

  // publishDate는 ISO 문자열로 저장됨 → 문자열 비교 대신 Date 변환 후 필터
  const all = await cv.find({}).project({
    videoNo: 1, videoTitle: 1, publishDate: 1, timelineComments: 1, totalComments: 1,
    youtubeVideoId: 1, youtubeUrl: 1, timeOffset: 1, isDeleted: 1,
  }).toArray();

  const inRange = all.filter((v) => {
    const d = new Date(v.publishDate);
    return d > LOWER && d < UPPER;
  }).sort((a, b) => new Date(a.publishDate) - new Date(b.publishDate));

  const videoNos = inRange.map((v) => v.videoNo);

  // 실제 수집된 타임라인 댓글 수 (chzzkcomments 기준, 스키마 통계와 별개로 실측)
  const tlAgg = await cc.aggregate([
    { $match: { videoNo: { $in: videoNos }, isTimeline: true } },
    { $group: { _id: '$videoNo', n: { $sum: 1 } } },
  ]).toArray();
  const tlByVideo = new Map(tlAgg.map((r) => [r._id, r.n]));

  // 이미 파싱된 ParsedTimeline (platform=chzzk) — videoId=String(videoNo)
  const ptAgg = await pt.aggregate([
    { $match: { platform: 'chzzk', videoId: { $in: videoNos.map(String) } } },
    { $group: { _id: '$videoId', n: { $sum: 1 } } },
  ]).toArray();
  const ptByVideo = new Map(ptAgg.map((r) => [r._id, r.n]));

  // 이미 등록된 유튜브 클립(SongVideo)의 최신 날짜 확인 — 하한 경계 검증용
  const sv = db.collection('songvideos');
  const ytClips = await sv.find({ platform: 'youtube' }).project({ sungDate: 1 }).sort({ sungDate: -1 }).limit(1).toArray();
  const chzzkClips = await sv.find({ platform: 'chzzk' }).project({ sungDate: 1 }).sort({ sungDate: 1 }).limit(1).toArray();

  let totalTl = 0, withYtId = 0, withOffset = 0, fullyMapped = 0, alreadyParsed = 0, deleted = 0;
  console.log('━━━━━━━━━━ 유튜브 클립 작업 범위 분석 ━━━━━━━━━━');
  console.log(`범위: ${LOWER.toISOString().slice(0,10)} < publishDate < ${UPPER.toISOString().slice(0,10)} (경계 미포함)\n`);
  console.log(`대상 치지직 영상: ${inRange.length}개\n`);
  console.log('영상별 현황 (날짜순):');
  console.log('  날짜       vNo       타임라인  파싱됨  YT매핑 오프셋  제목');
  for (const v of inRange) {
    const tl = tlByVideo.get(v.videoNo) || 0;
    const parsed = ptByVideo.get(String(v.videoNo)) || 0;
    const ytId = v.youtubeVideoId ? 'O' : '·';
    const off = (v.timeOffset !== null && v.timeOffset !== undefined) ? 'O' : '·';
    totalTl += tl;
    if (v.youtubeVideoId) withYtId++;
    if (v.timeOffset !== null && v.timeOffset !== undefined) withOffset++;
    if (v.youtubeVideoId && v.timeOffset !== null && v.timeOffset !== undefined) fullyMapped++;
    if (parsed > 0) alreadyParsed++;
    if (v.isDeleted) deleted++;
    const date = new Date(v.publishDate).toISOString().slice(0, 10);
    console.log(
      `  ${date}  ${String(v.videoNo).padEnd(9)} ${String(tl).padStart(6)}   ${String(parsed).padStart(5)}    ${ytId}      ${off}     ${(v.videoTitle||'').slice(0, 32)}`
    );
  }

  console.log('\n━━━━━━━━━━ 요약 ━━━━━━━━━━');
  console.log(`치지직 영상:            ${inRange.length}개 (삭제표시 ${deleted}개)`);
  console.log(`수집된 타임라인 댓글:   ${totalTl}개`);
  console.log(`이미 파싱된 영상:       ${alreadyParsed}개 (ParsedTimeline 존재)`);
  console.log(`유튜브 영상ID 매핑됨:   ${withYtId}개`);
  console.log(`시간 오프셋 설정됨:     ${withOffset}개`);
  console.log(`완전 매핑(ID+오프셋):   ${fullyMapped}개  ← 바로 클립 생성 가능`);
  console.log(`매핑 필요:              ${inRange.length - fullyMapped}개  ← 유튜브 영상 찾고 오프셋 맞춰야 함`);
  console.log('\n참고 경계:');
  console.log(`  기존 유튜브 클립 최신 sungDate: ${ytClips[0]?.sungDate?.toISOString?.().slice(0,10) || '없음'}`);
  console.log(`  기존 치지직 클립 최오래 sungDate: ${chzzkClips[0]?.sungDate?.toISOString?.().slice(0,10) || '없음'}`);
} finally {
  await close();
}
