'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '@/components/Toast';
import MvStage, { type MvStageHandle, type MvStageProps } from './MvStage';
import { fromLines } from './lyrics-doc';
import { loadMv } from './registry';
import type { MvLyricLine } from './types';

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

/** 줄 안 시각이 거꾸로이거나 끝이 마지막 덩어리보다 앞이면 문제 */
function lineProblem(l: MvLyricLine) {
  const ts = l.ja.map((c) => c.t);
  return ts.some((t, k) => k > 0 && t < ts[k - 1]) || l.end <= ts[ts.length - 1];
}

/**
 * 로컬 전용 가사 타이밍 편집기. 재생하며 탭으로 찍고 미세조정하면 위 MV에 바로 반영되고,
 * 저장하면 레포의 lyrics.json이 바뀐다(커밋해서 배포).
 */
export default function MvTimingEditor({ clip }: { clip: StageClip }) {
  const { showSuccess, showError } = useToast();
  const stage = useRef<MvStageHandle>(null);
  const [lines, setLines] = useState<MvLyricLine[] | null>(null);
  const [saved, setSaved] = useState<string>('');
  const [history, setHistory] = useState<MvLyricLine[][]>([]);
  const [sel, setSel] = useState<Sel>({ i: 0, j: 0 });
  const [now, setNow] = useState<number | null>(null);
  const [tapLag, setTapLag] = useState(0.05);
  const [following, setFollowing] = useState(false);
  const [saving, setSaving] = useState(false);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    loadMv(clip)?.then((w) => {
      setLines(w.lyrics);
      setSaved(JSON.stringify(w.lyrics));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clip.shareId]);

  // 재생 위치 표시(초당 20회)
  useEffect(() => {
    const id = setInterval(() => setNow(stage.current?.getTime() ?? null), 50);
    return () => clearInterval(id);
  }, []);

  const dirty = lines !== null && JSON.stringify(lines) !== saved;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // 상태 갱신 함수 안에서 다른 상태를 바꾸지 않는다(개발 모드 StrictMode가 두 번 실행해 되돌리기가 꼬임)
  const commit = useCallback((next: MvLyricLine[]) => {
    if (lines) setHistory((h) => [...h.slice(-99), lines]);
    setLines(next);
  }, [lines]);

  const undo = useCallback(() => {
    if (!history.length) return;
    setLines(history[history.length - 1]);
    setHistory(history.slice(0, -1));
  }, [history]);

  const save = useCallback(async () => {
    if (!lines) return;
    const bad = lines.findIndex(lineProblem);
    if (bad >= 0) {
      showError('저장할 수 없습니다', `${bad + 1}번째 줄의 시각 순서를 확인하세요.`);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/dev/mv-timing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ songId: clip.songId, ...fromLines(lines) }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? '저장 실패');
      setSaved(JSON.stringify(lines));
      showSuccess('저장했습니다', `${json.data.file} — 커밋하면 배포에 반영됩니다.`);
    } catch (e) {
      showError('저장 실패', e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [lines, clip.songId, showSuccess, showError]);

  const listen = useCallback((t: number) => {
    stage.current?.seek(Math.max(0, t - 1.5));
    stage.current?.play();
  }, []);

  // 단축키
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!lines) return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      const k = e.key;
      if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 's') {
        e.preventDefault();
        void save();
      } else if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
      } else if (k === ' ') {
        e.preventDefault();
        if (stage.current?.isPlaying()) stage.current.pause();
        else stage.current?.play();
      } else if (k === 'Enter' || k.toLowerCase() === 't') {
        // 탭: 지금 시각(반응 지연 보정)을 선택 항목에 찍고 다음으로
        e.preventDefault();
        const t = stage.current?.getTime();
        if (t == null) return;
        const target = round(t - tapLag);
        commit(applyTime(lines, sel, () => target, false));
        setSel(step(lines, sel, 1));
      } else if (k === 'ArrowLeft' || k === 'ArrowRight') {
        e.preventDefault();
        const d = (k === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 0.01 : 0.05);
        commit(applyTime(lines, sel, (t) => Math.max(0, t + d), following));
      } else if (k === 'ArrowUp' || k === 'ArrowDown') {
        e.preventDefault();
        setSel(step(lines, sel, k === 'ArrowDown' ? 1 : -1));
      } else if (k.toLowerCase() === 'r') {
        e.preventDefault();
        listen(timeAt(lines, sel));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lines, sel, tapLag, following, commit, undo, save, listen]);

  // 선택한 줄이 보이도록 스크롤
  useEffect(() => {
    rowRefs.current[sel.i]?.scrollIntoView({ block: 'nearest' });
  }, [sel.i]);

  const playingLine = useMemo(() => {
    if (!lines || now == null) return -1;
    for (let i = lines.length - 1; i >= 0; i--) if (now >= lines[i].t) return now <= lines[i].end ? i : -1;
    return -1;
  }, [lines, now]);

  return (
    <div className="space-y-4">
      <MvStage ref={stage} clip={clip} lyrics={lines ?? undefined} />

      <div className="mx-auto max-w-6xl rounded-xl border border-white/10 bg-black/40 p-4 text-sm text-white">
        <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2">
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
          <b>Space</b> 재생/정지 · <b>Enter</b>/<b>T</b> 지금 시각을 선택 항목에 찍고 다음으로 · <b>←/→</b> ±0.05초
          (<b>Shift</b> ±0.01초) · <b>↑/↓</b> 이전/다음 항목 · <b>R</b> 선택 항목 1.5초 전부터 듣기 ·
          항목 더블클릭도 듣기 · <b>Ctrl+Z</b> 되돌리기
        </p>

        <div className="max-h-[50vh] space-y-1 overflow-y-auto pr-1">
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
                        onClick={() => setSel({ i, j })}
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
