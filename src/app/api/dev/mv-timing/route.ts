import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { withApi, ok, fail } from '@/shared/api/handler';
import { TIMING_FILES } from '@/components/mv/timing-files';
import { type LyricsDoc, formatLyricsDoc } from '@/components/mv/lyrics-doc';

const Chunk = z.object({
  t: z.number().min(0),
  text: z.string().min(1),
  x: z.number().optional(),
  y: z.number().optional(),
  punch: z.boolean().optional(),
});

const Body = z.object({
  songId: z.string().min(1),
  lines: z
    .array(z.object({ end: z.number().min(0), ko: z.string().optional(), chunks: z.array(Chunk).min(1) }))
    .min(1),
  cues: z.record(z.string(), z.number().min(0)).optional(),
});

/** 타이밍(t, end) 외의 모든 내용 — 저장 전후로 같아야 한다 */
const contentOf = (lines: LyricsDoc['lines']) =>
  JSON.stringify(lines.map((l) => [l.ko ?? null, l.chunks.map((c) => [c.text, c.x ?? null, c.y ?? null, !!c.punch])]));

const round = (n: number) => Math.round(n * 1000) / 1000;

/** 내용이 바뀐 경우에만 쓴다(dev 서버 재컴파일을 줄이려고) */
async function writeIfChanged(file: string, text: string) {
  const before = await fs.readFile(file, 'utf8');
  if (before.replace(/\r\n/g, '\n') === text) return false;
  await fs.writeFile(file, text, 'utf8');
  return true;
}

/**
 * 로컬 전용 — MV 가사·효과 타이밍을 레포의 lyrics.json / cues.json에 저장한다(저장 후 커밋해서 배포).
 * 운영에서는 존재하지 않는 것처럼 404. 등록된 곡의 파일만, 타이밍 값만 바꿀 수 있다.
 */
export const POST = withApi({ schema: Body }, async ({ input }) => {
  if (process.env.NODE_ENV !== 'development') return fail('NOT_FOUND', 'Not found', 404);

  const files = TIMING_FILES[input.songId];
  if (!files) return fail('NOT_FOUND', '타이밍 파일이 등록되지 않은 곡입니다.', 404);

  for (const [i, line] of input.lines.entries()) {
    const times = line.chunks.map((c) => c.t);
    if (times.some((t, k) => k > 0 && t < times[k - 1])) {
      return fail('VALIDATION', `${i + 1}번째 줄: 덩어리 시각이 앞뒤로 뒤집혀 있습니다.`, 400);
    }
    if (line.end <= times[times.length - 1]) {
      return fail('VALIDATION', `${i + 1}번째 줄: 줄 끝이 마지막 덩어리보다 앞에 있습니다.`, 400);
    }
  }

  const lyricsFile = path.join(process.cwd(), files.lyrics);
  const current = JSON.parse(await fs.readFile(lyricsFile, 'utf8')) as LyricsDoc;
  if (contentOf(current.lines) !== contentOf(input.lines)) {
    return fail('CONFLICT', '가사 내용이 파일과 다릅니다. 편집기를 새로고침한 뒤 다시 시도하세요.', 409);
  }

  // 효과 시각: 항목 이름은 그대로(추가·삭제 불가), 값만 바꾼다. 파일의 항목 순서를 유지
  let cuesText: string | null = null;
  const cuesFile = files.cues ? path.join(process.cwd(), files.cues) : null;
  if (input.cues) {
    if (!cuesFile) return fail('NOT_FOUND', '효과 타이밍 파일이 등록되지 않은 곡입니다.', 404);
    const currentCues = JSON.parse(await fs.readFile(cuesFile, 'utf8')) as Record<string, number>;
    const keys = Object.keys(currentCues);
    if (keys.length !== Object.keys(input.cues).length || keys.some((k) => !(k in input.cues!))) {
      return fail('CONFLICT', '효과 항목이 파일과 다릅니다. 편집기를 새로고침한 뒤 다시 시도하세요.', 409);
    }
    cuesText = `${JSON.stringify(Object.fromEntries(keys.map((k) => [k, round(input.cues![k])])), null, 2)}\n`;
  }

  const written: string[] = [];
  if (await writeIfChanged(lyricsFile, formatLyricsDoc({ lines: input.lines }))) written.push(files.lyrics);
  if (cuesFile && cuesText !== null && (await writeIfChanged(cuesFile, cuesText))) written.push(files.cues!);
  return ok({ files: written });
});
