'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ClipPlayerHandle } from '../ClipPlayer';
import type { PlayerClip } from './types';

export type RepeatMode = 'off' | 'all' | 'one';

/**
 * 클립 플레이어 전역 상태. 루트 레이아웃에 마운트되어 페이지 전환에도 재생이 끊기지 않는다
 * (음악앱처럼 브라우징하며 계속 재생). 실제 미디어는 MiniPlayer가 렌더하는 ClipPlayer가 소유하고,
 * 여기서는 큐/재생순서/반복·셔플 상태와 next·prev·toggle 액션만 관리한다.
 *
 * 재생 순서는 order(큐 인덱스 순열) + pos(order상의 위치)로 표현한다.
 * 셔플을 켜고 꺼도 현재 곡을 유지하며 순서만 재구성한다.
 */
interface ClipPlayerContextValue {
  queue: PlayerClip[];
  /** 현재 재생 중 클립의 큐 인덱스 */
  currentIndex: number;
  current: PlayerClip | null;
  /** 다음에 재생될 클립 (프리로드/워밍용). 한곡반복이면 null */
  nextClip: PlayerClip | null;
  /** 재생 순서상 곧 나올 클립들(현재 제외, 최대 2개) — 근접 프리로드용. 한곡반복이면 빈 배열 */
  upcomingClips: PlayerClip[];
  isExpanded: boolean;
  playing: boolean;
  hasInteracted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  hasNext: boolean;
  hasPrev: boolean;
  /** 같은 곡을 강제로 다시 마운트/재생하기 위한 nonce (한곡반복용). ClipPlayer key에 포함 */
  playNonce: number;
  playQueue: (clips: PlayerClip[], startIndex?: number, opts?: { shuffle?: boolean; sourceId?: string }) => void;
  playAt: (queueIndex: number) => void;
  /** 현재 재생 중인 큐의 출처(플레이리스트) id. 라이브 반영 대상 판별용 */
  currentSourceId: string | null;
  /**
   * 재생 중인 큐를 새 클립 목록으로 즉시 갱신 (관리/추가 반영). sourceId가 현재 출처와 같을 때만 적용.
   * 현재 재생 중 clipId를 유지하므로 ClipPlayer가 remount되지 않아 재생이 끊기지 않는다.
   */
  syncQueue: (sourceId: string, clips: PlayerClip[]) => void;
  next: () => void;
  prev: () => void;
  handleEnded: () => void;
  toggle: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  close: () => void;
  setExpanded: (v: boolean) => void;
  playerRef: React.MutableRefObject<ClipPlayerHandle | null>;
  reportPlaying: (v: boolean) => void;
}

const ClipPlayerContext = createContext<ClipPlayerContextValue | null>(null);

/** startFirst를 맨 앞에 두고 나머지를 섞은 순열 (Fisher–Yates) */
function shuffledOrder(length: number, startFirst: number): number[] {
  const rest = [];
  for (let i = 0; i < length; i++) if (i !== startFirst) rest.push(i);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return [startFirst, ...rest];
}

const identityOrder = (length: number) => Array.from({ length }, (_, i) => i);

export function ClipPlayerProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<PlayerClip[]>([]);
  const [order, setOrder] = useState<number[]>([]);
  const [pos, setPos] = useState(0);
  const [isExpanded, setExpanded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>('off');
  const [playNonce, setPlayNonce] = useState(0);
  const playerRef = useRef<ClipPlayerHandle | null>(null);
  const [sourceId, setSourceId] = useState<string | null>(null);
  // handleEnded/syncQueue가 stale 없이 현재 상태를 읽도록 매 렌더 갱신하는 ref (deps 최소화)
  const clampedPosRef = useRef(0);
  const queueRef = useRef<PlayerClip[]>([]);
  const orderRef = useRef<number[]>([]);
  const shuffleRef = useRef(false);
  const sourceRef = useRef<string | null>(null);
  shuffleRef.current = shuffle;
  sourceRef.current = sourceId;

  // 셔플/반복 설정을 로컬에 저장·복원 (하이드레이션 불일치 방지 위해 마운트 후 로드)
  useEffect(() => {
    try {
      if (localStorage.getItem('clipPlayer.shuffle') === '1') setShuffle(true);
      const r = localStorage.getItem('clipPlayer.repeat');
      if (r === 'all' || r === 'one') setRepeat(r);
    } catch {
      /* localStorage 접근 불가(프라이빗 모드 등) */
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem('clipPlayer.shuffle', shuffle ? '1' : '0');
    } catch { /* 무시 */ }
  }, [shuffle]);
  useEffect(() => {
    try {
      localStorage.setItem('clipPlayer.repeat', repeat);
    } catch { /* 무시 */ }
  }, [repeat]);

  const playQueue = useCallback(
    (clips: PlayerClip[], startIndex = 0, opts?: { shuffle?: boolean; sourceId?: string }) => {
      if (clips.length === 0) return;
      const start = Math.max(0, Math.min(startIndex, clips.length - 1));
      const useShuffle = opts?.shuffle ?? shuffle;
      if (opts?.shuffle !== undefined && opts.shuffle !== shuffle) setShuffle(opts.shuffle);
      setHasInteracted(true);
      setSourceId(opts?.sourceId ?? null);
      setQueue(clips);
      setOrder(useShuffle ? shuffledOrder(clips.length, start) : identityOrder(clips.length));
      setPos(useShuffle ? 0 : start);
      setPlayNonce((n) => n + 1);
    },
    [shuffle],
  );

  // 재생 중인 큐를 즉시 갱신 (관리/추가 반영). 현재 재생 곡 clipId를 유지 → remount 없음.
  const syncQueue = useCallback((sid: string, newClips: PlayerClip[]) => {
    if (!sourceRef.current || sid !== sourceRef.current) return;
    const curOrder = orderRef.current;
    const curPos = curOrder.length > 0 ? Math.min(clampedPosRef.current, curOrder.length - 1) : 0;
    const curId = queueRef.current[curOrder[curPos]]?.clipId;

    let finalClips = newClips;
    // 현재 재생 곡이 새 목록에 없으면(현재 곡 제거) 재생 끊김 방지 위해 유지
    if (curId && !newClips.some((c) => c.clipId === curId)) {
      const cur = queueRef.current.find((c) => c.clipId === curId);
      if (cur) finalClips = [...newClips, cur];
    }
    if (finalClips.length === 0) {
      close();
      return;
    }
    const curIdx = curId ? Math.max(0, finalClips.findIndex((c) => c.clipId === curId)) : 0;
    setQueue(finalClips);
    if (shuffleRef.current) {
      setOrder(shuffledOrder(finalClips.length, curIdx));
      setPos(0);
    } else {
      setOrder(identityOrder(finalClips.length));
      setPos(curIdx);
    }
    // playNonce는 건드리지 않음 — 현재 곡 clipId가 같으면 ClipPlayer key 불변 → 재생 유지
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const playAt = useCallback(
    (queueIndex: number) => {
      setHasInteracted(true);
      setPos(() => {
        const p = order.indexOf(queueIndex);
        return p >= 0 ? p : 0;
      });
      setPlayNonce((n) => n + 1);
    },
    [order],
  );

  const next = useCallback(() => {
    setPos((p) => {
      if (p + 1 < order.length) return p + 1;
      return repeat === 'all' ? 0 : p; // 끝: 전곡반복이면 처음으로, 아니면 유지
    });
  }, [order.length, repeat]);

  const prev = useCallback(() => {
    setPos((p) => {
      if (p > 0) return p - 1;
      return repeat === 'all' ? Math.max(0, order.length - 1) : 0;
    });
  }, [order.length, repeat]);

  // 트랙 종료 시 자동 진행 (버튼 next와 달리 반복모드를 반영)
  const handleEnded = useCallback(() => {
    if (repeat === 'one') {
      setPlayNonce((n) => n + 1); // 같은 곡 재생 (remount)
      return;
    }
    const atEnd = clampedPosRef.current + 1 >= order.length;
    if (!atEnd) {
      setPos((p) => p + 1); // 다음 곡: clipId가 바뀌어 자연히 remount
      return;
    }
    if (repeat === 'all') {
      // 처음으로. 단일 트랙 등 곡이 그대로면 key가 안 바뀌므로 nonce로 재생 강제
      setPos(0);
      setPlayNonce((n) => n + 1);
    }
    // repeat === 'off' → 마지막 곡에서 정지
  }, [order.length, repeat]);

  const toggle = useCallback(() => {
    setHasInteracted(true);
    playerRef.current?.toggle();
  }, []);

  const toggleShuffle = useCallback(() => {
    const nowOn = !shuffle;
    // 현재 곡을 유지하며 순서만 재구성
    const currentQ = order[Math.min(pos, order.length - 1)] ?? 0;
    if (nowOn) {
      setOrder(shuffledOrder(queue.length, currentQ));
      setPos(0);
    } else {
      setOrder(identityOrder(queue.length));
      setPos(currentQ);
    }
    setShuffle(nowOn);
  }, [shuffle, order, pos, queue.length]);

  const cycleRepeat = useCallback(() => {
    setRepeat((r) => (r === 'off' ? 'all' : r === 'all' ? 'one' : 'off'));
  }, []);

  const close = useCallback(() => {
    setQueue([]);
    setOrder([]);
    setPos(0);
    setExpanded(false);
    setPlaying(false);
    setSourceId(null);
  }, []);

  const clampedPos = order.length > 0 ? Math.min(pos, order.length - 1) : 0;
  clampedPosRef.current = clampedPos;
  queueRef.current = queue;
  orderRef.current = order;
  const currentIndex = order[clampedPos] ?? 0;
  const current = queue[currentIndex] ?? null;
  const hasNext = clampedPos < order.length - 1 || repeat === 'all';
  const hasPrev = clampedPos > 0 || repeat === 'all';

  // 다음에 재생될 클립 (프리로드용). 한곡반복이면 프리로드 불필요 → null
  let nextIndex: number | null = null;
  if (repeat !== 'one' && order.length > 0) {
    if (clampedPos + 1 < order.length) nextIndex = order[clampedPos + 1];
    else if (repeat === 'all') nextIndex = order[0];
  }
  const nextClip = nextIndex != null ? queue[nextIndex] ?? null : null;

  // 곧 나올 클립 최대 2개 (현재 제외, 순서 순회 — 전곡반복이면 wrap). 한곡반복이면 프리로드 불필요.
  const upcomingClips = useMemo<PlayerClip[]>(() => {
    const list: PlayerClip[] = [];
    if (repeat !== 'one' && order.length > 1) {
      const span = Math.min(2, order.length - 1);
      for (let k = 1; k <= span; k++) {
        let p = clampedPos + k;
        if (p >= order.length) {
          if (repeat !== 'all') break;
          p -= order.length; // 전곡반복: 앞으로 되돌아 순회
        }
        const clip = queue[order[p]];
        if (clip) list.push(clip);
      }
    }
    return list;
  }, [queue, order, clampedPos, repeat]);

  const value = useMemo<ClipPlayerContextValue>(
    () => ({
      queue,
      currentIndex,
      current,
      nextClip,
      upcomingClips,
      isExpanded,
      playing,
      hasInteracted,
      shuffle,
      repeat,
      hasNext,
      hasPrev,
      playNonce,
      playQueue,
      playAt,
      currentSourceId: sourceId,
      syncQueue,
      next,
      prev,
      handleEnded,
      toggle,
      toggleShuffle,
      cycleRepeat,
      close,
      setExpanded,
      playerRef,
      reportPlaying: setPlaying,
    }),
    [
      queue, currentIndex, current, nextClip, upcomingClips, isExpanded, playing, hasInteracted, shuffle, repeat,
      hasNext, hasPrev, playNonce, playQueue, playAt, sourceId, syncQueue, next, prev, handleEnded,
      toggle, toggleShuffle, cycleRepeat, close,
    ],
  );

  return <ClipPlayerContext.Provider value={value}>{children}</ClipPlayerContext.Provider>;
}

export function useClipPlayer(): ClipPlayerContextValue {
  const ctx = useContext(ClipPlayerContext);
  if (!ctx) throw new Error('useClipPlayer must be used within ClipPlayerProvider');
  return ctx;
}
