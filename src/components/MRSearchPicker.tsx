'use client';

import { seedMRMetadata } from '@/lib/mr-metadata-client';
import { useEffect, useId, useRef, useState } from 'react';
import { MagnifyingGlassIcon, ArrowTopRightOnSquareIcon, PlusIcon } from '@heroicons/react/24/outline';
import { defaultMRQuery, hasMRCandidate, type EditableMR, type MRCandidate, type MRSearchResults } from '@/domains/catalog/mr-search';

const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700';
function decodeTitle(value: string) {
  // Decode YouTube's text entities without inserting remote HTML into the DOM.
  return value.replace(/&(?:amp|quot|apos|lt|gt|#39|#\d+|#x[\da-f]+);/gi, entity => {
    const named: Record<string, string> = { '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>' };
    if (named[entity.toLowerCase()]) return named[entity.toLowerCase()];
    const hex = /^&#x/i.test(entity), code = parseInt(entity.slice(hex ? 3 : 2, -1), hex ? 16 : 10);
    return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
  });
}

/** Inline disclosure shares its parent's scroll region; no nested modal or scroll trap. */
export default function MRSearchPicker({ title, artist, language, links, onSelect, disabled = false }: {
  title: string; artist: string; language: string; links: EditableMR[];
  onSelect: (candidate: MRCandidate) => void; disabled?: boolean;
}) {
  const id = useId(), abort = useRef<AbortController | null>(null);
  const [open, setOpen] = useState(false), [query, setQuery] = useState(() => defaultMRQuery(title, artist));
  const [data, setData] = useState<MRSearchResults | null>(null), [loading, setLoading] = useState(false);
  const [error, setError] = useState(''), [message, setMessage] = useState('');
  useEffect(() => {
    abort.current?.abort(); setLoading(false); setData(null); setError(''); setMessage('');
    setQuery(defaultMRQuery(title, artist));
    return () => abort.current?.abort();
  }, [title, artist, language]);
  const search = async (searchQuery = query) => {
    setOpen(true);
    if (disabled || !title.trim() || !artist.trim() || !searchQuery.trim()) return;
    abort.current?.abort();
    const controller = new AbortController(); abort.current = controller;
    setOpen(true); setLoading(true); setData(null); setError(''); setMessage('');
    try {
      const response = await fetch('/api/youtube-search', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ title, artist, language, ...(searchQuery.trim() !== defaultMRQuery(title, artist) ? { query: searchQuery.trim() } : {}) }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.success) throw new Error(typeof body?.error === 'string' ? body.error : '검색에 실패했습니다. 다시 시도해주세요.');
      if (!controller.signal.aborted) setData(body as MRSearchResults);
    } catch (e) { if (!controller.signal.aborted) setError((e as Error).message); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  };
  const close = () => { abort.current?.abort(); setLoading(false); setOpen(false); };
  const full = links.length >= 30 && !links.some(link => !link.url.trim() && !link.label?.trim() && !link.duration?.trim() && !link.skipSeconds);
  return <section className="my-2 min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-900 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100 sm:p-3" aria-label="YouTube MR 후보 검색">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h4 className="text-sm font-semibold">YouTube에서 MR 찾기</h4><p className="sr-only">후보를 확인하고 원하는 영상만 추가하세요.</p></div>
      <button type="button" className={button} disabled={disabled} aria-expanded={open} aria-controls={id} onClick={() => {
        if (open) close(); else { const initial = defaultMRQuery(title, artist); setQuery(initial); void search(initial); }
      }}><MagnifyingGlassIcon className="h-4 w-4" />{open ? '검색 접기' : 'MR 검색'}</button>
    </div>
    {open && <div id={id} className="mt-4 space-y-3">
      <p className="text-xs leading-5 text-slate-600 dark:text-slate-400">{language === 'Japanese' ? '떡뮤 채널 후보를 맨 위에 표시합니다. 추가 후 앞부분 스킵 시간을 꼭 확인하세요.' : language === 'Korean' ? '금영·TJ 등 공식 노래방 채널의 영상은 제외합니다.' : '영상의 곡·버전·키를 확인한 뒤 선택해주세요.'}</p>
      <label className="block text-xs font-semibold" htmlFor={`${id}-query`}>검색어</label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input id={`${id}-query`} value={query} maxLength={500} disabled={disabled} onChange={e => { abort.current?.abort(); setLoading(false); setQuery(e.target.value); setData(null); setError(''); }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); void search(); } }}
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
        <button type="button" disabled={disabled || loading || !title.trim() || !artist.trim() || !query.trim()} className={button} onClick={() => void search()}>{loading ? '검색 중…' : '다시 검색'}</button>
      </div>
      {(!title.trim() || !artist.trim()) && <p className="text-xs text-amber-700 dark:text-amber-300">곡 제목과 가수를 먼저 입력해주세요.</p>}
      {loading && <p role="status" className="py-4 text-center text-sm">YouTube 후보를 찾고 있습니다…</p>}
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
      {data && <>
        <p role="status" className="text-xs text-slate-600 dark:text-slate-400">후보 {data.results.length}개{data.excludedCount > 0 && ` · 공식 노래방 ${data.excludedCount}개 제외`}</p>
        {data.warnings.map(warning => <p key={warning} role="status" className="text-xs text-amber-700 dark:text-amber-300">{warning}</p>)}
        {!data.results.length && <p className="py-5 text-center text-sm text-slate-600 dark:text-slate-400">표시할 후보가 없습니다. 원제·가수명으로 검색어를 바꾸거나 링크를 직접 입력해주세요.</p>}
        <ul className="space-y-2">
          {data.results.map(item => {
            const candidate = { ...item, title: decodeTitle(item.title), channelTitle: decodeTitle(item.channelTitle) };
            const added = hasMRCandidate(links, candidate);
            return <li key={candidate.videoId} className={`min-w-0 rounded-xl border bg-white p-3 dark:bg-slate-800 ${candidate.preferred ? 'border-purple-300 dark:border-purple-600' : 'border-slate-200 dark:border-slate-700'}`}>
              <div className="flex min-w-0 gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={candidate.thumbnail} alt="" loading="lazy" className="aspect-video h-14 w-24 shrink-0 rounded-lg object-cover sm:h-20 sm:w-36" />
                <div className="min-w-0 flex-1">
                  {candidate.preferred && <span className="mb-1 inline-block rounded-md bg-purple-100 px-2 py-1 text-[11px] font-semibold text-purple-800 dark:bg-purple-950 dark:text-purple-200">떡뮤 · 우선 후보</span>}
                  <p className="break-words text-sm font-semibold leading-5">{candidate.title}</p>
                  <p className="mt-1 break-words text-xs text-slate-600 dark:text-slate-400">{candidate.channelTitle}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                <a href={candidate.url} target="_blank" rel="noopener noreferrer" className={button} aria-label={`${candidate.title} 영상 확인`}>영상 확인<ArrowTopRightOnSquareIcon className="h-4 w-4" /></a>
                <button type="button" className={button} disabled={disabled || added || full} aria-label={`${candidate.title} ${added ? '추가됨' : 'MR 추가'}`} onClick={() => { seedMRMetadata(candidate.videoId, { title: candidate.title, channelTitle: candidate.channelTitle }); onSelect(candidate); setMessage('편집 목록에 추가했습니다. 스킵 시간을 확인한 뒤 곡을 저장해주세요.'); }}><PlusIcon className="h-4 w-4" />{added ? '추가됨' : 'MR 추가'}</button>
              </div>
            </li>;
          })}
        </ul>
      </>}
      {full && <p className="text-xs text-amber-700 dark:text-amber-300">MR은 최대 30개까지 추가할 수 있습니다.</p>}
      <p role="status" className="text-xs leading-5 text-purple-700 dark:text-purple-300">{message || '선택만으로 저장되지는 않습니다. 기존 대표 MR은 유지됩니다.'}</p>
    </div>}
  </section>;
}
