'use client';
import { useEffect, useRef, useState } from 'react';
import { youtubeMRVideoId } from '@/domains/catalog/mr-search';

import { loadMRMetadata, peekMRMetadata, type MRMetadata as Metadata } from '@/lib/mr-metadata-client';
export default function MRVideoPreview({ url }: { url: string }) {
  const id = youtubeMRVideoId(url);
  const [state, setState] = useState<{ id: string; data?: Metadata; failed?: boolean } | null>(null);
  const initialId = useRef(id);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!id) return;
    let active = true;
    const cached = peekMRMetadata(id);
    if (cached) { setState({ id, data: cached }); return; }
    const timer = window.setTimeout(() => {
      loadMRMetadata(id).then(data => { if (active) setState({ id, data }); })
        .catch(() => { if (active) setState({ id, failed: true }); });
    }, initialId.current === id ? 0 : 350);
    return () => { active = false; window.clearTimeout(timer); };
  }, [id, retry]);
  if (!id) return null;
  const current = state?.id === id ? state : { data: peekMRMetadata(id), failed: false };
  return <div className="flex min-w-0 gap-3 rounded-xl bg-slate-100 p-3 text-slate-900 dark:bg-slate-900 dark:text-slate-100" aria-label="등록 MR 영상 정보">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={`https://i.ytimg.com/vi/${id}/mqdefault.jpg`} alt="" className="aspect-video h-14 w-24 shrink-0 rounded-lg object-cover" loading="lazy" />
    <div className="min-w-0 flex-1 text-sm">
      <p className="break-words font-semibold" aria-live="polite">{current?.data?.title || (current?.failed ? '영상 정보를 불러올 수 없습니다' : '영상 정보 불러오는 중…')}</p>
      {current?.data?.channelTitle && <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{current.data.channelTitle}</p>}
      <div className="mt-1 flex flex-wrap gap-3 text-xs"><a href={`https://www.youtube.com/watch?v=${id}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-8 items-center underline">YouTube에서 확인</a>
        {current?.failed && <button type="button" className="min-h-8 underline" onClick={() => { setState(null); setRetry(n => n + 1); }}>다시 불러오기</button>}</div>
    </div>
  </div>;
}
