// 치지직 타임라인 댓글 → ParsedTimeline 파싱 (앱의 parseChzzkTimelineComments 재현).
//
// 앱(댓글 분석 탭 '치지직 댓글 파싱' 버튼 → SSE parse-chzzk-timeline-stream)과
// 동일한 로직으로, 스크립트에서 직접 파싱/저장한다. 진단 및 일회 보정용.
//
// 사용법:
//   node scripts/db/parse-chzzk-timelines.mjs                 # 미파싱 전체 dry-run
//   node scripts/db/parse-chzzk-timelines.mjs --videoNo=13678535
//   node scripts/db/parse-chzzk-timelines.mjs --apply
import { getDb } from './client.mjs';

const apply = process.argv.includes('--apply');
const vnoArg = process.argv.find((a) => a.startsWith('--videoNo='));
const onlyVideoNo = vnoArg ? parseInt(vnoArg.split('=')[1], 10) : null;

// ── 파싱 로직 (chzzk-timeline.ts / timeline-parser.ts 포팅) ──
const LINE_TIMESTAMP_REGEX = /^\s*(\d{1,2}:\d{2}(?::\d{2})?)\s+(.+)$/;
const SONG_SEPARATORS = [' - ', ' – ', ' — ', ' | ', ' / '];

function parseTimeToSeconds(t) {
  const hms = t.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
  if (hms) return +hms[1] * 3600 + +hms[2] * 60 + +hms[3];
  const ms = t.match(/^(\d{1,2}):(\d{2})$/);
  if (ms) return +ms[1] * 60 + +ms[2];
  return 0;
}
function parseSongInfo(text) {
  const clean = text.trim();
  for (const sep of SONG_SEPARATORS) {
    if (clean.includes(sep)) {
      const parts = clean.split(sep);
      if (parts.length >= 2 && parts[0].trim() && parts[1].trim()) {
        return { artist: parts[0].trim(), songTitle: parts.slice(1).join(sep).trim() };
      }
    }
  }
  return { artist: '알 수 없음', songTitle: clean };
}
function parseChzzkTimelineComment(content) {
  const raw = [];
  for (const line of content.split('\n')) {
    const m = line.match(LINE_TIMESTAMP_REGEX);
    if (!m) continue;
    const text = m[2].trim();
    if (!text) continue;
    const s = parseSongInfo(text);
    raw.push({ timeSeconds: parseTimeToSeconds(m[1]), artist: s.artist, songTitle: s.songTitle, isRelevant: s.artist !== '알 수 없음' });
  }
  raw.sort((a, b) => a.timeSeconds - b.timeSeconds);
  return raw.map((cur, i) => {
    const next = raw[i + 1];
    return {
      startTimeSeconds: cur.timeSeconds,
      endTimeSeconds: next ? next.timeSeconds : null,
      duration: next ? next.timeSeconds - cur.timeSeconds : null,
      artist: cur.artist,
      songTitle: cur.songTitle,
      isRelevant: cur.isRelevant,
    };
  });
}
function toOriginalDateString(d) {
  const date = new Date(d);
  if (isNaN(date.getTime())) return undefined;
  return `${String(date.getFullYear()).slice(2)}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}
const buildChzzkVideoUrl = (no) => `https://chzzk.naver.com/video/${no}`;

const { db, close } = await getDb();
try {
  const cc = db.collection('chzzkcomments');
  const cv = db.collection('chzzkvideos');
  const pt = db.collection('parsedtimelines');
  const tc = db.collection('timelinecomments');

  const filter = { isTimeline: true };
  if (onlyVideoNo) filter.videoNo = onlyVideoNo;
  const comments = await cc.find(filter).toArray();

  const videoNos = [...new Set(comments.map((c) => c.videoNo))];
  const videos = await cv.find({ videoNo: { $in: videoNos } }).toArray();
  const videoMap = new Map(videos.map((v) => [v.videoNo, v]));

  // 기존 chzzk 타임라인 (videoId → 시작시간들)
  const existing = await pt.find({ platform: 'chzzk' }, { projection: { videoId: 1, startTimeSeconds: 1 } }).toArray();
  const known = new Map();
  for (const it of existing) {
    const l = known.get(it.videoId) ?? [];
    l.push(it.startTimeSeconds);
    known.set(it.videoId, l);
  }

  const docs = [];
  const commentUpserts = [];
  const seen = new Set();
  let processed = 0, skipped = 0, noVideo = 0;
  const perVideo = new Map();

  for (const comment of comments) {
    const video = videoMap.get(comment.videoNo);
    if (!video) { noVideo++; continue; }
    const entries = parseChzzkTimelineComment(comment.content);
    if (entries.length === 0) continue;

    const cid = String(comment.commentId);
    if (!seen.has(cid)) {
      seen.add(cid);
      commentUpserts.push({
        updateOne: {
          filter: { commentId: cid },
          update: { $set: { platform: 'chzzk', text: comment.content, author: comment.authorName, publishedAt: comment.publishedAt } },
          upsert: true,
        },
      });
    }

    const vidStr = String(comment.videoNo);
    const videoUrl = buildChzzkVideoUrl(comment.videoNo);
    const uploadedDate = new Date(video.publishDate);
    const ods = toOriginalDateString(video.publishDate);
    const kt = known.get(vidStr) ?? [];

    for (const e of entries) {
      if (kt.some((t) => Math.abs(t - e.startTimeSeconds) <= 10)) { skipped++; continue; }
      kt.push(e.startTimeSeconds);
      docs.push({
        id: `chzzk_${comment.commentId}_${e.startTimeSeconds}`,
        platform: 'chzzk', videoId: vidStr, videoNo: comment.videoNo,
        videoTitle: video.videoTitle, uploadedDate, videoPublishedAt: uploadedDate,
        originalDateString: ods, artist: e.artist, songTitle: e.songTitle, videoUrl,
        startTimeSeconds: e.startTimeSeconds, endTimeSeconds: e.endTimeSeconds, duration: e.duration,
        commentAuthor: comment.authorName, commentId: cid, commentPublishedAt: comment.publishedAt,
        isRelevant: e.isRelevant, isExcluded: false, createdAt: new Date(), updatedAt: new Date(),
      });
      perVideo.set(comment.videoNo, (perVideo.get(comment.videoNo) || 0) + 1);
    }
    known.set(vidStr, kt);
    processed++;
  }

  console.log('━━━ 치지직 타임라인 파싱 ━━━');
  console.log(`대상 댓글: ${comments.length} (영상 ${videoNos.length}개)`);
  console.log(`  처리 댓글: ${processed} | 영상정보 없음: ${noVideo} | 중복 스킵: ${skipped}`);
  console.log(`  신규 생성 예정: ${docs.length}개`);
  console.log('  영상별 신규:');
  for (const [vno, n] of [...perVideo.entries()].sort((a, b) => b[0] - a[0])) {
    console.log(`    videoNo=${vno}: ${n}개 (${videoMap.get(vno)?.videoTitle?.slice(0, 30) || ''})`);
  }

  if (!apply) { console.log('\n[dry-run] 변경 없음. --apply 로 저장.'); await close(); process.exit(0); }

  if (commentUpserts.length) await tc.bulkWrite(commentUpserts, { ordered: false }).catch(() => {});
  let inserted = 0;
  if (docs.length) {
    const r = await pt.insertMany(docs, { ordered: false }).catch((e) => ({ insertedCount: e.result?.nInserted ?? 0 }));
    inserted = r.insertedCount ?? docs.length;
  }
  console.log(`\n✅ 적용 완료: ${inserted}개 ParsedTimeline 생성`);
} finally {
  await close();
}
