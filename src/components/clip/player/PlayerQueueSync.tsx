'use client';

import { useEffect, useRef } from 'react';
import { useGlobalClipPlaylists } from '@/hooks/useGlobalClipPlaylists';
import { useClipPlayer } from './ClipPlayerProvider';
import { toPlayerClip, type PlayerClip } from './types';

/**
 * 재생 중인 플레이리스트의 클립이 바뀌면(갤러리에서 추가/제거 등) 플레이어 큐에 자동 반영.
 * 관리 화면은 직접 syncQueue를 부르지만, 훅(useGlobalClipPlaylists)을 거치는 변경은 여기서 감지한다.
 * syncQueue가 현재 재생 곡 clipId를 유지하므로 재생이 끊기지 않는다.
 * 레이아웃에 상주(렌더 없음).
 */
export default function PlayerQueueSync() {
  const { playlists } = useGlobalClipPlaylists();
  const { currentSourceId, syncQueue } = useClipPlayer();
  const lastSig = useRef<string>('');

  useEffect(() => {
    if (!currentSourceId) {
      lastSig.current = '';
      return;
    }
    const pl = playlists.find((p) => p._id === currentSourceId);
    if (!pl) return;
    const clips = [...pl.clips]
      .sort((a, b) => a.order - b.order)
      .map((e) => toPlayerClip(e.clipId))
      .filter((c): c is PlayerClip => !!c);
    const sig = clips.map((c) => c.clipId).join(',');
    if (sig === lastSig.current) return; // 실제 변화 없으면 재구성 안 함
    lastSig.current = sig;
    syncQueue(currentSourceId, clips);
  }, [playlists, currentSourceId, syncQueue]);

  return null;
}
