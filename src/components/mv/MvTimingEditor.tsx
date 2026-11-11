'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '@/components/Toast';
import MvStage, { type MvStageHandle, type MvStageProps } from './MvStage';
import { fromLines } from './lyrics-doc';
import { loadMv } from './registry';
import type { MvCue, MvLyricLine } from './types';

type StageClip = MvStageProps['clip'];

/** 선택 위치: 줄 i의 j번째 덩어리. j === 덩어리 수 이면 그 줄의 "끝" */
interface Sel {
  i: number;
  j: number;
}

const round = (n: number) => Math.round(n * 1000) / 1000;
const fmt = (t: number) => t.toFixed(2);

function timeAt(lines: MvLyricLine[], s: Sel) {
  const l = lines[s.i];
  return s.j < l.ja.length ? l.ja[s.j].t : l.end;
}

/** 선택 항목(과 옵션에 따라 그 이후 전부)의 시각을 바꾼다. 줄 시작은 첫 덩어리와 맞춘다 */
function applyTime(lines: MvLyricLine[], s: Sel, next: (t: number) => number, following: boolean): MvLyricLine[] {
  return lines.map((l, i) => {
    if (i < s.i || (!following && i > s.i)) return l;
    const hit = (j: number) => (i === s.i ? (following ? j >= s.j : j === s.j) : true);
    const ja = l.ja.map((c, j) => (hit(j) ? { ...c, t: round(next(c.t)) } : c));
    const end = hit(l.ja.length) ? round(next(l.end)) : l.end;
    return { ...l, t: ja[0].t, ja, end };
  });
}

function step(lines: MvLyricLine[], s: Sel, dir: 1 | -1): Sel {
  if (dir === 1) {
    if (s.j < lines[s.i].ja.length) return { i: s.i, j: s.j + 1 };
    return s.i + 1 < lines.length ? { i: s.i + 1, j: 0 } : s;
  }
  if (s.j > 0) return { i: s.i, j: s.j - 1 };
  return s.i > 0 ? { i: s.i - 1, j: lines[s.i - 1].ja.length } : s;
}

/** 지금 재생 시각에 화면에 나와 있는 덩어리(가장 최근에 등장한 것) */
function chunkAt(lines: MvLyricLine[], now: number): Sel | null {
  let best: Sel | null = null;
  let bestT = -Infinity;
  lines.forEach((l, i) =>
    l.ja.forEach((c, j) => {
      if (c.t <= now && c.t >= bestT) {
        best = { i, j };
        bestT = c.t;
      }
    }),
  );
  return best;
}

/** 지금 재생 시각 직전에 지나간 효과 */
function cueAt(cues: MvCue[], now: number) {
  let best = -1;
  cues.forEach((c, k) => {
    if (!c.offset && c.t <= now && (best < 0 || c.t >= cues[best].t)) best = k;
  });
  return best;
}

/** 장면 경계는 정의 순서대로 시각이 커져야 한다 — 뒤집힌 경계들 */
function badCues(cues: MvCue[]) {
  const bad = new Set<number>();
  let lastK = -1;
  cues.forEach((c, k) => {
    if (!c.section) return;
    if (lastK >= 0 && c.t <= cues[lastK].t) {
      bad.add(k);
      bad.add(lastK);
    }
    lastK = k;
  });
  return bad;
}

/**
 * 박자 탭들로 비트 보정값을 잰다 — 각 탭이 보정 전 그리드에서 얼마나 늦은지(±반 박)의 원형 평균.
 * 반 박 넘게 어긋난 탭이 섞여도 각도로 평균하므로 한쪽으로 쏠리지 않는다.
 */
function measureBeatOffset(taps: number[], beat: { period: number; phase: number }) {
  let x = 0;
  let y = 0;
  for (const t of taps) {
    const a = (((t - beat.phase) / beat.period) % 1) * 2 * Math.PI;
    x += Math.cos(a);
    y += Math.sin(a);
  }
  return round((Math.atan2(y, x) / (2 * Math.PI)) * beat.period);
}

const fmtCue = (c: MvCue) => (c.offset ? `${c.t >= 0 ? '+' : ''}${fmt(c.t)}` : fmt(c.t));

const cueValues = (cues: MvCue[]) => Object.fromEntries(cues.map((c) => [c.id, c.t]));
const snapshot = (lines: MvLyricLine[] | null, cues: MvCue[]) => JSON.stringify([lines, cueValues(cues)]);

/** 줄 안 시각이 거꾸로이거나 끝이 마지막 덩어리보다 앞이면 문제 */
function lineProblem(l: MvLyricLine) {
  const ts = l.ja.map((c) => c.t);
  return ts.some((t, k) => k > 0 && t < ts[k - 1]) || l.end <= ts[ts.length - 1];
}

/**
 * 로컬 전용 타이밍 편집기(가사 / 효과). 재생하며 탭으로 찍고 미세조정하면 위 MV에 바로 반영되고,
 * 저장하면 레포의 lyrics.json · cues.json이 바뀐다(커밋해서 배포).
 */
export default function MvTimingEditor({ clip }: { clip: StageClip }) {
  const { showSuccess, showError } = useToast();
  const stage = useRef<MvStageHandle>(null);
  const [mode, setMode] = useState<'lyrics' | 'cues'>('lyrics');
  const [lines, setLines] = useState<MvLyricLine[] | null>(null);
  const [cues, setCues] = useState<MvCue[]>([]);
  const [saved, setSaved] = useState<string>('');
  const [history, setHistory] = useState<{ lines: MvLyricLine[]; cues: MvCue[] }[]>([]);
  const [sel, setSel] = useState<Sel>({ i: 0, j: 0 });
  const [cueSel, setCueSel] = useState(0);
  const [now, setNow] = useState<number | null>(null);
  const [tapLag, setTapLag] = useState(0.05);
  const [following, setFollowing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [beatTaps, setBeatTaps] = useState<number[]>([]);
  const [beat, setBeat] = useState<{ period: number; phase: number } | null>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const cueRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    loadMv(clip)?.then((w) => {
      setLines(w.lyrics);
      setCues(w.cues ?? []);
      setBeat(w.beat ?? null);
      setSaved(snapshot(w.lyrics, w.cues ?? []));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clip.shareId]);

  // 재생 위치 표시(초당 20회)
  useEffect(() => {
    const id = setInterval(() => setNow(stage.current?.getTime() ?? null), 50);
    return () => clearInterval(id);
  }, []);

  const dirty = lines !== null && snapshot(lines, cues) !== saved;
  const cueProblems = useMemo(() => badCues(cues), [cues]);
  const liveCues = useMemo(() => cueValues(cues), [cues]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // 상태 갱신 함수 안에서 다른 상태를 바꾸지 않는다(개발 모드 StrictMode가 두 번 실행해 되돌리기가 꼬임)
  const remember = useCallback(() => {
    if (lines) setHistory((h) => [...h.slice(-299), { lines, cues }]);
  }, [lines, cues]);

  const commit = useCallback((next: MvLyricLine[]) => {
    remember();
    setLines(next);
  }, [remember]);

  const commitCues = useCallback((next: MvCue[]) => {
    remember();
    setCues(next);
  }, [remember]);

  const undo = useCallback(() => {
    if (!history.length) return;
    const prev = history[history.length - 1];
    setLines(prev.lines);
    setCues(prev.cues);
    setHistory(history.slice(0, -1));
  }, [history]);

  const save = useCallback(async () => {
    if (!lines) return;
    const bad = lines.findIndex(lineProblem);
    if (bad >= 0) {
      showError('저장할 수 없습니다', `${bad + 1}번째 줄의 시각 순서를 확인하세요.`);
      return;
    }
    if (cueProblems.size) {
      showError('저장할 수 없습니다', '효과 탭에서 빨간 장면 경계의 순서를 확인하세요.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/dev/mv-timing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ songId: clip.songId, ...fromLines(lines), ...(cues.length ? { cues: liveCues } : {}) }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? '저장 실패');
      setSaved(snapshot(lines, cues));
      const written: string[] = json.data.files;
      showSuccess('저장했습니다', written.length ? `${written.join(', ')} — 커밋하면 배포에 반영됩니다.` : '바뀐 내용이 없습니다.');
    } catch (e) {
      showError('저장 실패', e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [lines, cues, liveCues, cueProblems, clip.songId, showSuccess, showError]);

  const listen = useCallback((t: number) => {
    stage.current?.seek(Math.max(0, t - 1.5));
    stage.current?.play();
  }, []);

  /** 선택한 효과의 시각을 바꾼다 — "이후 전체"면 그 시각 이후의 효과도 함께 */
  const shiftCues = useCallback((next: (t: number) => number, all: boolean) => {
    const sel = cues[cueSel];
    if (!sel) return cues;
    if (sel.offset) return cues.map((c, k) => (k === cueSel ? { ...c, t: round(Math.max(-2, Math.min(2, next(c.t)))) } : c));
    return cues.map((c, k) =>
      k === cueSel || (all && !c.offset && c.t >= sel.t) ? { ...c, t: round(Math.max(0, next(c.t))) } : c,
    );
  }, [cues, cueSel]);

  // 단축키 — 방향키와 WASD는 같은 동작
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!lines) return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const ctrl = e.ctrlKey || e.metaKey;
      const lyricsMode = mode === 'lyrics';
      if (ctrl && k === 's') {
        e.preventDefault();
        void save();
        return;
      }
      if (ctrl && k === 'z') {
        e.preventDefault();
        undo();
        return;
      }
      if (ctrl || e.altKey) return;
      const nudge = k === 'ArrowLeft' || k === 'a' ? -1 : k === 'ArrowRight' || k === 'd' ? 1 : 0;
      const move = k === 'ArrowUp' || k === 'w' ? -1 : k === 'ArrowDown' || k === 's' ? 1 : 0;
      if (k === ' ') {
        e.preventDefault();
        if (stage.current?.isPlaying()) stage.current.pause();
        else stage.current?.play();
      } else if (k === 'Enter' || k === 't') {
        // 탭: 지금 시각(반응 지연 보정)을 선택 항목에 찍고 다음으로
        e.preventDefault();
        const t = stage.current?.getTime();
        if (t == null) return;
        const at = round(Math.max(0, t - tapLag));
        if (lyricsMode) {
          commit(applyTime(lines, sel, () => at, false));
          setSel(step(lines, sel, 1));
        } else if (cues[cueSel]?.offset) {
          // 박자에 맞춰 여러 번 두드리면 평균으로 보정(2초 넘게 쉬면 새로 잰다, 최근 16번까지)
          if (!beat) return;
          const taps = [...(beatTaps.length && at - beatTaps[beatTaps.length - 1] > 2 ? [] : beatTaps), at].slice(-16);
          setBeatTaps(taps);
          if (taps.length >= 4) {
            const off = measureBeatOffset(taps, beat);
            if (off !== cues[cueSel].t) commitCues(shiftCues(() => off, false));
          }
        } else if (cues.length) {
          commitCues(shiftCues(() => at, false));
          setCueSel(Math.min(cueSel + 1, cues.length - 1));
        }
      } else if (nudge) {
        e.preventDefault();
        const d = nudge * (e.shiftKey ? 0.01 : 0.05);
        if (lyricsMode) commit(applyTime(lines, sel, (t) => Math.max(0, t + d), following));
        else if (cues.length) commitCues(shiftCues((t) => t + d, following));
      } else if (move) {
        e.preventDefault();
        if (lyricsMode) setSel(step(lines, sel, move === 1 ? 1 : -1));
        else setCueSel(Math.max(0, Math.min(cues.length - 1, cueSel + move)));
      } else if (k === 'f') {
        // 지금 재생 중인 위치의 항목 선택
        e.preventDefault();
        const t = stage.current?.getTime();
        if (t == null) return;
        if (lyricsMode) {
          const hit = chunkAt(lines, t);
          if (hit) setSel(hit);
        } else {
          const hit = cueAt(cues, t);
          if (hit >= 0) setCueSel(hit);
        }
      } else if (k === 'r') {
        e.preventDefault();
        const c = cues[cueSel];
        if (lyricsMode) listen(timeAt(lines, sel));
        else if (c && !c.offset) listen(c.t);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, lines, sel, cues, cueSel, tapLag, following, beat, beatTaps, commit, commitCues, shiftCues, undo, save, listen]);

  // 선택한 항목이 보이도록 스크롤
  useEffect(() => {
    if (mode === 'lyrics') rowRefs.current[sel.i]?.scrollIntoView({ block: 'nearest' });
  }, [sel.i, mode]);

  useEffect(() => {
    if (mode === 'cues') cueRefs.current[cueSel]?.scrollIntoView({ block: 'nearest' });
  }, [cueSel, mode]);

  const playingLine = useMemo(() => {
    if (!lines || now == null) return -1;
    for (let i = lines.length - 1; i >= 0; i--) if (now >= lines[i].t) return now <= lines[i].end ? i : -1;
    return -1;
  }, [lines, now]);

  const passedCue = useMemo(() => (now == null ? -1 : cueAt(cues, now)), [cues, now]);

  return (
    <div className="space-y-4">
      <MvStage ref={stage} clip={clip} lyrics={lines ?? undefined} cues={cues.length ? liveCues : undefined} />

      <div className="mx-auto max-w-6xl rounded-xl border border-white/10 bg-black/40 p-4 text-sm text-white">
        <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex overflow-hidden rounded-lg border border-white/15">
            {(['lyrics', 'cues'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={(e) => {
                  setMode(m);
                  // 효과 탭은 지금 재생 위치의 효과부터
                  const t = stage.current?.getTime();
                  if (m === 'cues' && t != null) {
                    const hit = cueAt(cues, t);
                    if (hit >= 0) setCueSel(hit);
                  }
                  // 포커스가 남으면 Space가 버튼을 눌러 버린다
                  e.currentTarget.blur();
                }}
                className={`px-3 py-1 font-semibold ${mode === m ? 'bg-white/20' : 'text-white/60 hover:bg-white/10'}`}
              >
                {m === 'lyrics' ? '가사' : `효과${cueProblems.size ? ' ⚠' : ''}`}
              </button>
            ))}
          </div>
          <span className="font-mono text-lg tabular-nums text-lime-300">t = {now == null ? '—' : fmt(now)}</span>
          <label className="flex items-center gap-2">
            탭 보정
            <input
              type="number"
              step={0.01}
              value={tapLag}
              onChange={(e) => setTapLag(Number(e.target.value) || 0)}
              className="w-20 rounded bg-white/10 px-2 py-1 font-mono"
            />
            초
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={following} onChange={(e) => setFollowing(e.target.checked)} />
            미세조정 시 이후 전체 함께 이동
          </label>
          <div className="flex-1" />
          <span className={dirty ? 'text-amber-300' : 'text-white/50'}>{dirty ? '저장 안 됨' : '저장됨'}</span>
          <button
            type="button"
            onClick={() => void save()}
            disabled={!dirty || saving}
            className="rounded-lg bg-dark-primary px-4 py-1.5 font-semibold disabled:opacity-40"
          >
            {saving ? '저장 중…' : '저장 (Ctrl+S)'}
          </button>
        </div>
        <p className="mb-3 text-xs leading-relaxed text-white/60">
          <b>Space</b> 재생/정지 · <b>Enter</b>/<b>T</b> 지금 시각을 선택 항목에 찍고 다음으로 · <b>←/→</b>·<b>A/D</b> ±0.05초
          (<b>Shift</b> ±0.01초) · <b>↑/↓</b>·<b>W/S</b> 이전/다음 항목 · <b>F</b> 지금 재생 위치의 항목 선택 ·{' '}
          <b>R</b> 선택 항목 1.5초 전부터 듣기 · 항목 더블클릭도 듣기 · <b>Ctrl+Z</b> 되돌리기
          {mode === 'cues' && (
            <>
              <br />
              효과는 시작 시각만 바뀌고 연출 길이는 그대로입니다. 가사에 붙은 효과(「サムライハート」 칼베기, 「勘違いだよ」 정적,
              빠른 구간 단어)는 가사 탭에서 그 가사를 옮기면 따라갑니다. <b>장면 경계</b>끼리 순서가 뒤집히면 빨갛게 표시됩니다.
            </>
          )}
        </p>

        {mode === 'cues' && (
          <div className="max-h-[50vh] space-y-1 overflow-y-auto pr-1">
            {cues.map((c, k) => (
              <button
                key={c.id}
                ref={(el) => {
                  cueRefs.current[k] = el;
                }}
                type="button"
                onClick={(e) => {
                  setCueSel(k);
                  e.currentTarget.blur();
                }}
                onDoubleClick={() => !c.offset && listen(c.t)}
                className={`flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left ${k === passedCue ? 'bg-white/10' : ''} ${
                  cueSel === k ? 'ring-2 ring-lime-300' : cueProblems.has(k) ? 'ring-1 ring-red-500' : ''
                }`}
              >
                <span className="w-16 shrink-0 rounded-md bg-white/10 px-2 py-0.5 text-right font-mono text-xs text-lime-200/80">
                  {fmtCue(c)}
                </span>
                <span className={c.section ? 'font-semibold' : 'text-white/85'}>{c.label}</span>
                {c.section && <span className="rounded bg-white/10 px-1.5 text-[10px] text-white/60">장면 경계</span>}
                {c.offset && (
                  <span className="text-xs text-white/50">
                    선택하고 재생하며 박자에 맞춰 <b>T</b>를 4번 이상 두드리면 자동으로 맞춥니다
                    {cueSel === k && beatTaps.length > 0 && ` · 탭 ${beatTaps.length}회`}
                  </span>
                )}
                <span className="ml-auto font-mono text-[10px] text-white/30">{c.id}</span>
              </button>
            ))}
          </div>
        )}

        <div className={`max-h-[50vh] space-y-1 overflow-y-auto pr-1 ${mode === 'lyrics' ? '' : 'hidden'}`}>
          {lines?.map((l, i) => {
            const bad = lineProblem(l);
            return (
              <div
                key={i}
                ref={(el) => {
                  rowRefs.current[i] = el;
                }}
                className={`rounded-lg px-2 py-1.5 ${i === playingLine ? 'bg-white/10' : ''} ${bad ? 'ring-1 ring-red-500' : ''}`}
              >
                <div className="flex flex-wrap items-center gap-1">
                  <span className="w-7 shrink-0 text-right font-mono text-xs text-white/40">{i + 1}</span>
                  {[...l.ja.map((c) => ({ t: c.t, text: c.text })), { t: l.end, text: '⏹ 끝' }].map((c, j) => {
                    const selected = sel.i === i && sel.j === j;
                    const isEnd = j === l.ja.length;
                    const active = !isEnd && now != null && i === playingLine && now >= c.t && (j + 1 >= l.ja.length || now < l.ja[j + 1].t);
                    return (
                      <button
                        key={j}
                        type="button"
                        onClick={(e) => {
                          setSel({ i, j });
                          e.currentTarget.blur();
                        }}
                        onDoubleClick={() => listen(c.t)}
                        className={`rounded-md px-2 py-0.5 text-left transition-colors ${
                          selected ? 'ring-2 ring-lime-300' : ''
                        } ${active ? 'bg-dark-primary/70' : isEnd ? 'bg-white/5 text-white/50' : 'bg-white/10'}`}
                      >
                        <span className="mr-1.5 font-mono text-xs text-lime-200/80">{fmt(c.t)}</span>
                        {c.text.trim()}
                      </button>
                    );
                  })}
                </div>
                {l.ko && <p className="ml-8 mt-0.5 text-xs text-white/40">{l.ko}</p>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
