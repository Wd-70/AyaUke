"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { cacheSavedSong, detailQuery, libraryKey, libraryQuery } from './song-queries';
import { useSession } from 'next-auth/react';
import { MagnifyingGlassIcon, PlusIcon, ArrowPathIcon, ArrowTopRightOnSquareIcon, MusicalNoteIcon, ChevronRightIcon, CheckCircleIcon, ArchiveBoxIcon } from '@heroicons/react/24/outline';
import { Permission, hasPermission } from '@/lib/permissions';
import { FILTER_LABELS, SONG_LANGUAGES, LANGUAGE_LABELS, displaySongTitle, displaySongArtist, durationLabel, inSongFilter, searchLibrary, type SongFilter, type SongLibrary } from '@/domains/catalog/song-workspace';
import { Notice, control, primary, secondary, muted, songRequest } from './SongWorkspaceUI';
import SongEditor from './SongEditor';
import SongBulkEditor from './SongBulkEditor';
const pageSize = 24;
export default function SongManagementTab() {
  const { data: session } = useSession();
  const canEdit = hasPermission(session?.user, Permission.SONGS_EDIT), canCreate = hasPermission(session?.user, Permission.SONGS_CREATE), canDelete = hasPermission(session?.user, Permission.SONGS_DELETE);
  const client = useQueryClient();
  const scope = JSON.stringify([session?.user?.channelId, session?.user?.role, session?.user?.adminScopes]);
  const list = useQuery({ ...libraryQuery(scope), enabled: !!session?.user });
  const data = list.data, loading = list.isFetching, error = list.error?.message || '';
  const [notice, setNotice] = useState('');
  const prefetchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const prefetch = (id: string, delay = 120) => {
    clearTimeout(prefetchTimer.current);
    prefetchTimer.current = setTimeout(() => { void client.prefetchQuery(detailQuery(scope, id)); }, delay);
  };
  const cancelPrefetch = () => clearTimeout(prefetchTimer.current);
  useEffect(() => cancelPrefetch, []);
  const refreshList = async () => {
    await client.cancelQueries({ queryKey: libraryKey(scope) });
    await client.invalidateQueries({ queryKey: libraryKey(scope), refetchType: 'none' });
    try { await client.fetchQuery({ ...libraryQuery(scope), queryFn: ({ signal }) => songRequest<SongLibrary>('/api/admin/song-library?fresh=1', { signal }) }); }
    catch { /* query state renders the retry notice */ }
  };
  const [search, setSearch] = useState(''), [filter, setFilter] = useState<SongFilter>('all'), [language, setLanguage] = useState('all'), [source, setSource] = useState('all'), [sort, setSort] = useState('updated');
  const [page, setPage] = useState(1), [selected, setSelected] = useState<string[]>([]);
  const [editor, setEditor] = useState<{ id: string | null } | null>(null), [bulk, setBulk] = useState(false);
  useEffect(() => { setPage(1); setSelected([]); }, [search, filter, language, source, sort]);
  const songs = data?.songs || [];
  const counts = useMemo(() => Object.fromEntries(Object.keys(FILTER_LABELS).map(key => [key, songs.filter(song => inSongFilter(song, key as SongFilter)).length])) as Record<SongFilter, number>, [data]);
  const filtered = useMemo(() => searchLibrary(songs, search, filter, language, source).sort((a, b) => {
    if (sort === 'title') return displaySongTitle(a).localeCompare(displaySongTitle(b), 'ko');
    if (sort === 'artist') return displaySongArtist(a).localeCompare(displaySongArtist(b), 'ko') || displaySongTitle(a).localeCompare(displaySongTitle(b), 'ko');
    if (sort === 'clips') return b.clips - a.clips || a.id.localeCompare(b.id);
    return (b.updatedAt || '').localeCompare(a.updatedAt || '') || a.id.localeCompare(b.id);
  }), [data, search, filter, language, source, sort]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize)), currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const selectedSongs = songs.filter(song => selected.includes(song.id));
  const allSelected = visible.length > 0 && visible.every(song => selected.includes(song.id));
  const toggle = (id: string) => setSelected(current => current.includes(id) ? current.filter(v => v !== id) : [...current, id].slice(0, 100));
  const reset = () => { setSearch(''); setFilter('all'); setLanguage('all'); setSource('all'); setSort('updated'); };
  return <div className="min-w-0 space-y-5 text-slate-900 dark:text-slate-100">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-[11px] font-bold tracking-[.22em] text-purple-700 dark:text-purple-300">WORKSPACE / SONG LIBRARY</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">노래 라이브러리<span className="ml-3 align-middle text-sm font-normal text-slate-400">{data ? counts.all.toLocaleString() : '—'}</span></h2><p className={`mt-2 ${muted}`}>노래책의 표시 정보부터, 부르기 좋은 MR까지.</p></div>
      <div className="flex flex-wrap gap-2"><a href="/songbook" target="_blank" rel="noopener noreferrer" className={secondary}>노래책 보기<ArrowTopRightOnSquareIcon className="h-4 w-4" /></a>{canCreate && <button onClick={() => setEditor({ id: null })} className={primary}><PlusIcon className="h-4 w-4" />노래 추가</button>}</div>
    </header>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {(['all', 'missing-mr', 'missing-lyrics', 'missing-duration'] as SongFilter[]).map(key => <button key={key} onClick={() => setFilter(key)} aria-pressed={filter === key}
        className={`rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${filter === key ? 'border-purple-300 bg-purple-50 shadow-sm dark:border-purple-700 dark:bg-purple-950/40' : 'border-slate-200 bg-white hover:border-purple-300 dark:border-slate-800 dark:bg-slate-900/70'}`}>
        <span className={`text-xs ${filter === key ? 'font-semibold text-purple-800 dark:text-purple-200' : 'text-slate-500 dark:text-slate-400'}`}>{FILTER_LABELS[key]}</span><span className="mt-2 block text-2xl font-semibold tabular-nums">{data ? counts[key].toLocaleString() : '—'}</span>
      </button>)}
    </div>
    {!!counts['display-collision'] && <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"><p>표시명과 가수가 겹치는 {counts['display-collision']}곡이 있습니다. 노래책에서 일부가 숨겨질 수 있습니다.</p><button className="min-h-11 text-xs font-semibold underline" onClick={() => setFilter('display-collision')}>겹치는 곡 확인</button></div>}
    {notice && <Notice>{notice}<button className="ml-3 min-h-11 text-xs underline" onClick={() => setNotice('')}>알림 닫기</button></Notice>}
    {error && <Notice error>{error}<button className="ml-3 min-h-11 underline" onClick={() => void refreshList()}>다시 시도</button></Notice>}
    <section aria-label="노래 목록" className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
      <div className="space-y-3 border-b border-slate-100 p-4 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-0 flex-1 basis-60"><MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-slate-400" /><input aria-label="노래 검색" value={search} onChange={e => setSearch(e.target.value)} className={`${control} !pl-10`} placeholder="제목, 가수, 원제, 검색 태그" /></label>
          <button disabled={loading} aria-label="노래 목록 새로고침" className={`${secondary} !px-3`} onClick={() => { setSelected([]); void refreshList(); }}><ArrowPathIcon className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} /></button>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <select aria-label="작업 필터" className={`${control} sm:!w-auto`} value={filter} onChange={e => setFilter(e.target.value as SongFilter)}>{Object.entries(FILTER_LABELS).map(([key, label]) => <option key={key} value={key}>{label} ({counts[key as SongFilter] || 0})</option>)}</select>
          <select aria-label="언어 필터" className={`${control} sm:!w-auto`} value={language} onChange={e => setLanguage(e.target.value)}><option value="all">모든 언어</option><option value="">언어 미설정</option>{SONG_LANGUAGES.map(lang => <option key={lang} value={lang}>{LANGUAGE_LABELS[lang]}</option>)}</select>
          <select aria-label="등록 경로 필터" className={`${control} sm:!w-auto`} value={source} onChange={e => setSource(e.target.value)}><option value="all">모든 등록 경로</option><option value="sheet">시트 기반 / 기존</option><option value="admin">관리자 추가</option></select>
          <select aria-label="노래 정렬" className={`${control} sm:!w-auto sm:ml-auto`} value={sort} onChange={e => setSort(e.target.value)}><option value="updated">최근 수정순</option><option value="title">제목순</option><option value="artist">가수순</option><option value="clips">클립 많은 순</option></select>
        </div>
        {filter === 'zero-skip' && <p className={`text-xs ${muted}`}>스킵 0초는 오류가 아닙니다. 도입부 확인이 필요한 곡을 찾을 때 사용하세요.</p>}
        {filter === 'deleted' && <p className={`text-xs ${muted}`}>노래책에서 제외된 곡입니다. 곡을 열어 복원할 수 있으며 연결된 클립은 유지됩니다.</p>}
        <div className="flex min-h-8 flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span aria-live="polite">{loading ? '목록 갱신 중…' : `검색 결과 ${filtered.length.toLocaleString()}곡`}</span>
          <div className="flex items-center gap-4">{(search || filter !== 'all' || language !== 'all' || source !== 'all') && <button className="min-h-8 underline underline-offset-4" onClick={reset}>필터 초기화</button>}{canEdit && filter !== 'deleted' && <label className="flex min-h-8 items-center gap-2"><input aria-label="현재 페이지 전체 선택" type="checkbox" checked={allSelected} onChange={() => setSelected(current => allSelected ? current.filter(id => !visible.some(song => song.id === id)) : [...new Set([...current, ...visible.map(s => s.id)])].slice(0, 100))} className="h-4 w-4 accent-purple-600" />현재 페이지 선택</label>}</div>
        </div>
      </div>
      {selected.length > 0 && <div className="flex flex-wrap items-center justify-between gap-2 border-b border-purple-200 bg-purple-50 px-4 py-3 text-purple-900 dark:border-purple-800 dark:bg-purple-950/50 dark:text-purple-100">
        <p className="text-sm font-semibold">{selected.length}곡 선택 <span className="text-xs font-normal opacity-70">· 최대 100곡</span></p><div className="flex gap-2"><button className={secondary} onClick={() => setSelected([])}>선택 해제</button><button className={primary} onClick={() => setBulk(true)}>일괄 수정</button></div>
      </div>}
      {!data && loading ? <div role="status" className="space-y-3 p-5">{Array.from({ length: 5 }, (_, i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />)}<span className="sr-only">노래 목록 불러오는 중</span></div>
        : !visible.length ? <div className="px-5 py-16 text-center"><MusicalNoteIcon className="mx-auto mb-4 h-9 w-9 text-slate-300" /><h3 className="font-semibold">{error ? '목록을 불러오지 못했습니다' : '조건에 맞는 곡이 없습니다'}</h3><p className={`mt-2 mb-5 ${muted}`}>검색어나 필터를 바꾸어 다시 찾아보세요.</p><button className={secondary} onClick={reset}>전체 등록곡 보기</button></div>
        : <ul className="divide-y divide-slate-100 dark:divide-slate-800">{visible.map(song => <li key={song.id} className={`group flex items-center gap-2 px-3 py-2 transition sm:gap-3 sm:px-4 ${selected.includes(song.id) ? 'bg-purple-50/60 dark:bg-purple-950/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
          {canEdit && filter !== 'deleted' && <label className="flex min-h-11 w-8 shrink-0 items-center justify-center"><input aria-label={`${displaySongTitle(song)} 선택`} type="checkbox" checked={selected.includes(song.id)} onChange={() => toggle(song.id)} className="h-4 w-4 accent-purple-600" /></label>}
          <button id={`song-edit-${song.id}`} aria-label={`${displaySongTitle(song)} 편집`} onMouseEnter={() => prefetch(song.id)} onMouseLeave={cancelPrefetch} onFocus={() => prefetch(song.id, 0)} onBlur={cancelPrefetch} onTouchStart={() => prefetch(song.id, 0)} onClick={() => setEditor({ id: song.id })} className="flex min-h-24 min-w-0 flex-1 items-center gap-3 rounded-xl py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-purple-500 sm:gap-4">
            <span className="hidden h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-purple-100 to-indigo-100 text-lg font-semibold text-purple-500 dark:from-purple-950 dark:to-indigo-950 dark:text-purple-300 sm:flex">{song.imageUrl && /^https?:\/\//.test(song.imageUrl) ? <img src={song.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" /> : displaySongTitle(song).slice(0, 1)}</span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold sm:text-base">{displaySongTitle(song)}</span><span className={`mt-1 block truncate text-xs ${muted}`}>{displaySongArtist(song)}{song.titleAlias && <span className="text-slate-400"> · {song.title}</span>}</span>
              <span className="mt-2 flex flex-wrap gap-1.5 text-[10px]"><span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-600 dark:bg-slate-800 dark:text-slate-300">{LANGUAGE_LABELS[song.language] || '미설정'}</span>{!song.hasLyrics && <span className="rounded-md bg-amber-50 px-2 py-0.5 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">가사 없음</span>}{!song.mrCount && <span className="rounded-md bg-rose-50 px-2 py-0.5 text-rose-700 dark:bg-rose-950/50 dark:text-rose-200">MR 없음</span>}{!song.clipDuration && <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-500 dark:bg-slate-800 dark:text-slate-400">길이 미설정</span>}</span>
            </span>
            <span className="hidden w-28 shrink-0 text-xs xl:block"><span className="block font-medium">{song.mrCount ? `MR ${song.mrCount}개` : 'MR 미등록'}</span><span className={`mt-1 block truncate text-xs ${muted}`}>{song.selectedMR ? `스킵 ${song.selectedMR.skipSeconds}초` : '—'}</span></span>
            <span className="w-16 shrink-0 text-right text-xs sm:w-20"><span className="block font-medium tabular-nums">{durationLabel(song.clipDuration)}</span><span className={`mt-1 block text-[10px] ${muted}`}>클립 {song.clips}개</span></span>
            <ChevronRightIcon className="h-4 w-4 shrink-0 text-slate-300 group-hover:text-purple-500" />
          </button>
        </li>)}</ul>}
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 p-4 dark:border-slate-800">
        <p className={`text-xs ${muted}`}>{currentPage} / {pages} 페이지 · 페이지당 {pageSize}곡</p><div className="flex gap-2"><button className={secondary} disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>이전</button><button className={secondary} disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}>다음</button></div>
      </footer>
    </section>
    <div className={`flex flex-wrap items-center justify-between gap-2 px-1 text-xs ${muted}`}><p className="flex items-center gap-1.5"><CheckCircleIcon className="h-4 w-4" />원본 연결과 클립 기록을 유지하며 관리합니다.</p><button className="inline-flex min-h-11 items-center gap-1.5 underline-offset-4 hover:underline" onClick={() => setFilter('deleted')}><ArchiveBoxIcon className="h-4 w-4" />보관함 {counts.deleted || 0}</button></div>
    {editor && <SongEditor key={scope + ':' + (editor.id || 'new')} id={editor.id} scope={scope} canEdit={editor.id ? canEdit : canCreate} canDelete={canDelete} onClose={() => setEditor(null)} onSaved={async saved => { await cacheSavedSong(client, scope, saved); setSelected([]); }} />}
    {bulk && <SongBulkEditor scope={scope} songs={selectedSongs} onClose={() => setBulk(false)} onSaved={message => { setNotice(message); setSelected([]); }} />}
  </div>;
}
