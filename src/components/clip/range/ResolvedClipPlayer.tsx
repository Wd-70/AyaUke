'use client';

import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import ClipPlayer, { type ClipPlayerHandle, type ClipPlayerProps } from '../ClipPlayer';
import type { ClipRangeDTO } from '@/domains/archive/clip-range.policy';
import { useClipRangeEditor } from './ClipRangeProvider';
import { loadRanges, rangeKey } from './range-client';

type Props = ClipPlayerProps & { rangeSessionId?: string };

const PlaybackSession = forwardRef<ClipPlayerHandle, Props & { owner: string }>(function PlaybackSession(props, ref) {
  const editor = useClipRangeEditor();
  const generatedId = useId();
  const sessionId = props.rangeSessionId ?? generatedId;
  const id = props.trackPlayClipId!;
  const query = useQuery({ queryKey: rangeKey(props.owner, id), queryFn: async ({ signal }) => {
    const [result] = await loadRanges([id], signal); if (!result) throw new Error('클립을 찾을 수 없습니다.'); return result;
  }, staleTime: 15_000, refetchOnWindowFocus: false });
  const [snapshot, setSnapshot] = useState<ClipRangeDTO | null>(null);
  const snapshotRef = useRef(snapshot); snapshotRef.current = snapshot;
  const [revision, setRevision] = useState(0);
  const [resume, setResume] = useState<{ position: number; play: boolean } | null>(null);
  const player = useRef<ClipPlayerHandle | null>(null);
  const reportedError = useRef(false);
  useEffect(() => {
    if (query.isError && !snapshot && !reportedError.current) {
      reportedError.current = true;
      props.onPlaybackError?.();
    }
  }, [query.isError, snapshot, props.onPlaybackError]);
  // Resolve once per playback/account session. External votes must not seek a playing clip.
  useEffect(() => {
    if (snapshot || !query.data || query.isFetching) return;
    const applied = editor.applied(id);
    setSnapshot(props.owner === 'guest' && applied?.sourceVersion === query.data.sourceVersion && applied.videoId === query.data.videoId
      ? { ...query.data, effective: applied.effective } : query.data);
  }, [snapshot, query.data, query.isFetching, editor.applied, id, props.owner]);
  useEffect(() => editor.register(sessionId, {
    clipId: id, owner: props.owner, snapshot: () => snapshotRef.current,
    suspend: () => {
      const previous = snapshotRef.current;
      const position = player.current?.getCurrentTime?.() ?? previous?.effective.startTime ?? 0;
      const play = player.current?.isPlaying() ?? false;
      player.current?.pause();
      return value => {
        if (value) {
          const range = value.effective;
          const restoredPosition = previous?.sourceVersion === value.sourceVersion && position >= range.startTime && (range.endTime === null || position < range.endTime)
            ? position : range.startTime;
          snapshotRef.current = value; setSnapshot(value);
          setResume({ position: restoredPosition, play }); setRevision(n => n + 1);
        } else if (play) player.current?.play();
      };
    },
  }), [editor.register, sessionId, id, props.owner]);
  useImperativeHandle(ref, () => ({ play: () => { if (!editor.isOpen) player.current?.play(); }, pause: () => player.current?.pause(),
    toggle: () => { if (!editor.isOpen) player.current?.toggle(); }, isPlaying: () => player.current?.isPlaying() ?? false,
    getCurrentTime: () => player.current?.getCurrentTime?.() ?? 0,
    getDuration: () => player.current?.getDuration?.() ?? 0,
    seekTo: position => { if (!editor.isOpen) player.current?.seekTo?.(position); },
  }));
  if (!snapshot) return <div className="flex aspect-video items-center justify-center bg-black p-4 text-sm text-white">
    {query.isError ? <button onClick={() => query.refetch()}>구간 조회 실패 · 다시 시도</button> : '재생 구간 확인 중…'}
  </div>;
  return <ClipPlayer {...props} key={revision} ref={player} platform={snapshot.platform} videoId={snapshot.videoId}
        startTime={snapshot.effective.startTime} endTime={snapshot.effective.endTime}
        autoplay={!editor.isOpen && props.autoplay}
        initialPlayback={editor.isOpen ? { position: player.current?.getCurrentTime?.() ?? snapshot.effective.startTime, play: false } : resume}
        onEnded={() => { if (!editor.isOpen) props.onEnded?.(); }} />;
});

export default forwardRef<ClipPlayerHandle, Props>(function ResolvedClipPlayer(props, ref) {
  const { data: session, status } = useSession();
  const client = useQueryClient();
  const owner = session?.user.userId || 'guest';
  const previousOwner = useRef(owner);
  useEffect(() => {
    if (previousOwner.current !== owner) client.removeQueries({ queryKey: ['clip-range', previousOwner.current] });
    previousOwner.current = owner;
  }, [client, owner]);
  if (!props.trackPlayClipId) return <ClipPlayer {...props} ref={ref} />;
  if (status === 'loading') return <div className="aspect-video bg-black" />;
  return <PlaybackSession key={`${owner}:${props.trackPlayClipId}`} {...props} owner={owner} ref={ref} />;
});
