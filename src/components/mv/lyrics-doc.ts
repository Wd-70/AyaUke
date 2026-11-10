// 가사 타이밍 파일(lyrics.json) 형식 — MV 렌더러와 로컬 타이밍 편집기가 함께 쓴다.
// 줄 시작 시각은 첫 덩어리 시각과 같으므로 파일에는 저장하지 않는다.
import type { MvLyricChunk, MvLyricLine } from './types';

export interface LyricsDocLine {
  end: number;
  ko?: string;
  chunks: MvLyricChunk[];
}

export interface LyricsDoc {
  lines: LyricsDocLine[];
}

export function toLines(doc: LyricsDoc): MvLyricLine[] {
  return doc.lines.map((l) => ({ t: l.chunks[0].t, end: l.end, ko: l.ko, ja: l.chunks }));
}

export function fromLines(lines: MvLyricLine[]): LyricsDoc {
  return { lines: lines.map((l) => ({ end: l.end, ...(l.ko ? { ko: l.ko } : {}), chunks: l.ja })) };
}

const round = (n: number) => Math.round(n * 1000) / 1000;

/** 덩어리 하나당 한 줄 — 타이밍만 바꿨을 때 git diff가 그 줄만 바뀌도록 */
export function formatLyricsDoc(doc: LyricsDoc): string {
  const chunk = (c: MvLyricChunk) =>
    JSON.stringify({
      t: round(c.t),
      text: c.text,
      ...(c.x !== undefined ? { x: c.x } : {}),
      ...(c.y !== undefined ? { y: c.y } : {}),
      ...(c.punch ? { punch: true } : {}),
    });
  const line = (l: LyricsDocLine) => {
    const head = [`"end": ${round(l.end)}`, ...(l.ko ? [`"ko": ${JSON.stringify(l.ko)}`] : [])].join(', ');
    return `    { ${head}, "chunks": [\n${l.chunks.map((c) => `      ${chunk(c)}`).join(',\n')}\n    ] }`;
  };
  return `{\n  "lines": [\n${doc.lines.map(line).join(',\n')}\n  ]\n}\n`;
}
