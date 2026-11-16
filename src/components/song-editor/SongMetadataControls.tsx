'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { PhotoIcon, PlusIcon, XMarkIcon, MinusIcon, CheckIcon, LinkIcon } from '@heroicons/react/24/outline';
import { SONG_LANGUAGES, LANGUAGE_LABELS, type SongFieldsValue } from '@/domains/catalog/song-workspace';
import { control } from './SongEditorUI';
import { coverPreviewUrl, mergeSongTags, parseSongTags, stepSongKey } from './song-metadata';

const legend = 'mb-2 block text-[13px] font-semibold tracking-tight text-slate-700 dark:text-slate-200';
const choice = 'relative flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl px-2 text-[13px] font-medium transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 disabled:opacity-40';
const active = 'bg-white text-purple-800 shadow-sm ring-1 ring-purple-200/70 dark:bg-slate-800 dark:text-purple-200 dark:ring-purple-500/30';
const idle = 'text-slate-500 hover:bg-white/60 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200';
const codes: Record<string, string> = { Korean: 'KO', Japanese: 'JA', English: 'EN', Chinese: 'ZH', Other: 'ETC' };
export function LanguageSelector({ value, onChange }: { value: SongFieldsValue['language']; onChange: (value: SongFieldsValue['language']) => void }) {
  return <fieldset className="min-w-0"><legend className={legend}>언어</legend><div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100/80 p-1 dark:bg-slate-950/50 sm:grid-cols-6">
    {SONG_LANGUAGES.map(language => <button key={language} type="button" aria-pressed={value === language} onClick={() => onChange(value === language ? '' : language)} className={`${choice} ${value === language ? active : idle}`}><span aria-hidden="true" className="text-[9px] font-semibold tracking-[.12em] opacity-60">{codes[language]}</span>{LANGUAGE_LABELS[language]}{value === language && <CheckIcon aria-hidden="true" className="absolute right-1.5 top-1.5 h-3 w-3 text-purple-500" />}</button>)}
    <button type="button" aria-pressed={!value} onClick={() => onChange('')} className={`${choice} ${!value ? active : idle}`}>미설정</button>
  </div></fieldset>;
}

export function SongTagInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const id = useId(), inputRef = useRef<HTMLInputElement>(null);
  const [tags, setTags] = useState(() => parseSongTags(value)), [draft, setDraft] = useState('');
  const emitted = useRef(value);
  useEffect(() => {
    if (value !== emitted.current) { setTags(parseSongTags(value)); setDraft(''); emitted.current = value; }
  }, [value]);
  const emit = (next: string[], text: string) => {
    setTags(next); setDraft(text);
    // Include the uncommitted input in parent state: Save, tab changes and dirty guards never drop it.
    const raw = mergeSongTags(next, text).join(', ');
    emitted.current = raw; onChange(raw);
  };
  const add = (text = draft) => { emit(mergeSongTags(tags, text), ''); inputRef.current?.focus(); };
  const all = mergeSongTags(tags, draft);
  const error = all.length > 50 ? '태그는 최대 50개까지 입력할 수 있습니다.' : all.some(tag => tag.length > 80) ? '태그 하나는 80자 이내로 입력해주세요.' : '';
  return <div className="min-w-0">
    <div className="mb-2 flex items-center justify-between"><label className="text-[13px] font-semibold text-slate-700 dark:text-slate-200" htmlFor={id}>검색 태그</label><span className="text-[10px] tabular-nums text-slate-400 dark:text-slate-500">{all.length} / 50</span></div>
    <div className={`min-w-0 rounded-xl border bg-white px-3 py-2 transition focus-within:border-purple-400 focus-within:ring-4 focus-within:ring-purple-500/5 dark:bg-slate-900 ${error ? 'border-rose-400' : 'border-slate-200 dark:border-slate-700'}`}>
    {tags.length > 0 && <ul aria-label="등록한 검색 태그" className="mb-1 flex max-w-full flex-wrap gap-1.5 border-b border-slate-100 pb-2 dark:border-slate-800">{tags.map(tag => <li key={tag} className="flex h-7 min-w-0 max-w-full items-center rounded-lg bg-purple-50 pl-2.5 text-xs font-medium text-purple-800 dark:bg-purple-500/10 dark:text-purple-200"><span className="break-all">{tag}</span><button type="button" aria-label={`${tag} 태그 삭제`} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-purple-400 transition hover:text-purple-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 dark:hover:text-purple-100" onClick={() => emit(tags.filter(item => item !== tag), draft)}><XMarkIcon className="h-3.5 w-3.5" /></button></li>)}</ul>}
    <div className="flex min-w-0 items-center gap-1"><input ref={inputRef} id={id} aria-describedby={`${id}-hint`} aria-invalid={!!error} className="min-h-11 min-w-0 flex-1 bg-transparent px-0.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-600" value={draft} maxLength={4000} placeholder={tags.length ? '태그 더 추가하기…' : '태그 입력 후 Enter'}
      onChange={e => emit(tags, e.target.value)} onPaste={e => {
        const text = e.clipboardData.getData('text');
        if (/[,，\n]/.test(text)) {
          e.preventDefault();
          const start = e.currentTarget.selectionStart ?? draft.length, end = e.currentTarget.selectionEnd ?? start;
          add(draft.slice(0, start) + text + draft.slice(end));
        }
      }} onKeyDown={e => {
        if (e.nativeEvent.isComposing) return;
        if (e.key === 'Enter' || e.key === ',' || e.key === '，') { e.preventDefault(); add(); }
        if (e.key === 'Backspace' && !draft && tags.length) { e.preventDefault(); emit(tags.slice(0, -1), ''); }
      }} /><button type="button" aria-label="검색 태그 추가" disabled={!draft.trim()} className="flex min-h-11 w-11 shrink-0 items-center justify-center rounded-xl text-purple-700 transition hover:bg-purple-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 disabled:text-slate-300 dark:text-purple-300 dark:hover:bg-purple-500/10 dark:disabled:text-slate-700" onClick={() => add()}><PlusIcon className="h-4 w-4" /></button></div></div>
    <p id={`${id}-hint`} className={`mt-1.5 text-[11px] leading-relaxed ${error ? 'text-rose-700 dark:text-rose-300' : 'text-slate-500 dark:text-slate-400'}`}>{error || 'Enter로 추가 · 쉼표로 여러 태그를 한 번에 입력할 수 있어요.'}</p>
  </div>;
}

export function KeyAdjustmentControl({ value, onChange }: { value: number | null; onChange: (value: number | null) => void }) {
  const id = useId();
  const [input, setInput] = useState(value == null ? '' : String(value)), emitted = useRef(value);
  useEffect(() => { if (value !== emitted.current) { setInput(value == null ? '' : String(value)); emitted.current = value; } }, [value]);
  const change = (next: number | null) => { emitted.current = next; setInput(next == null ? '' : String(next)); onChange(next); };
  return <fieldset className="min-w-0 sm:max-w-md"><legend className={legend}>키 조절</legend>
    <div className="flex flex-wrap items-center gap-2"><div className="flex min-w-[144px] flex-1 items-center gap-1 rounded-xl bg-slate-100/80 px-1 dark:bg-slate-950/50">
      <button type="button" aria-label="키 내리기" disabled={value === -12} onClick={() => change(stepSongKey(value, -1))} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm transition hover:text-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 disabled:opacity-30 dark:bg-slate-800 dark:text-slate-300 dark:hover:text-purple-200"><MinusIcon className="h-4 w-4" /></button>
      <div className="min-w-[40px] flex-1 text-center"><label htmlFor={id} className="sr-only">키 조절 값</label><input id={id} type="text" inputMode="text" role="spinbutton" aria-valuemin={-12} aria-valuemax={12} aria-valuenow={value ?? undefined} aria-valuetext={value == null ? '미설정' : `${value}키`} className="h-11 w-full min-w-[40px] rounded-lg bg-transparent text-center text-lg font-semibold tabular-nums tracking-tight text-slate-900 outline-none placeholder:text-base placeholder:font-normal placeholder:text-slate-400 focus:ring-2 focus:ring-purple-500 dark:text-white dark:placeholder:text-slate-500" value={input} placeholder="미설정" onChange={e => {
        const text = e.target.value;
        if (!/^-?\d{0,2}$/.test(text)) return;
        if (text === '-' || text === '') { setInput(text); emitted.current = null; onChange(null); }
        else { const number = Number(text); if (number >= -12 && number <= 12) { setInput(text); emitted.current = number; onChange(number); } }
      }} onBlur={() => setInput(value == null ? '' : String(value))} onKeyDown={e => {
        if (e.nativeEvent.isComposing) return;
        if (['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
          e.preventDefault(); change(e.key === 'Home' ? -12 : e.key === 'End' ? 12 : stepSongKey(value, e.key === 'ArrowUp' ? 1 : -1));
        }
      }} /></div>
      <button type="button" aria-label="키 올리기" disabled={value === 12} onClick={() => change(stepSongKey(value, 1))} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm transition hover:text-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 disabled:opacity-30 dark:bg-slate-800 dark:text-slate-300 dark:hover:text-purple-200"><PlusIcon className="h-4 w-4" /></button>
    </div><div className="inline-flex shrink-0 rounded-xl bg-slate-100/70 p-0.5 dark:bg-slate-950/40"><button type="button" aria-pressed={value === 0} onClick={() => change(0)} className={`min-h-11 rounded-lg px-3 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${value === 0 ? active : idle}`}>원본 키</button><button type="button" aria-pressed={value === null} onClick={() => change(null)} className={`min-h-11 rounded-lg px-3 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${value === null ? active : idle}`}>미설정</button></div><span role="status" className="sr-only">{value == null ? '키 조절 없음' : value === 0 ? '원본키' : `${value > 0 ? '+' : ''}${value}키`}</span></div>
  </fieldset>;
}

function CoverThumbnail({ url }: { url: string }) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  return <a href={url} target="_blank" rel="noopener noreferrer" aria-label="커버 이미지 원본 확인" className="relative flex h-14 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-200 shadow-sm ring-1 ring-black/5 transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 dark:bg-slate-800 dark:ring-white/10 sm:w-20">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {status !== 'error' && <img src={url} alt="커버 이미지 미리보기" className={`absolute inset-0 h-full w-full object-cover ${status === 'loaded' ? 'opacity-100' : 'opacity-0'}`} onLoad={() => setStatus('loaded')} onError={() => setStatus('error')} />}
    {status !== 'loaded' && <span className="px-1 text-center text-[10px] text-slate-600 dark:text-slate-400">{status === 'error' ? '이미지 로드 실패' : '불러오는 중…'}</span>}
  </a>;
}
export function CoverImageField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const id = useId(), [settled, setSettled] = useState(value);
  useEffect(() => { const timer = setTimeout(() => setSettled(value), 350); return () => clearTimeout(timer); }, [value]);
  const current = coverPreviewUrl(value), url = value === settled ? current : null;
  return <div className="min-w-0"><div className="mb-2 flex items-center gap-2"><label htmlFor={id} className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">커버 이미지 주소</label><span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">선택</span></div>
    <div className="flex min-w-0 items-center gap-2.5 rounded-xl bg-slate-50 p-2 dark:bg-slate-950/40 sm:gap-3">
    {url ? <CoverThumbnail key={url} url={url} /> : <div aria-hidden="true" className="flex h-14 w-16 shrink-0 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white/60 text-slate-300 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-600 sm:w-20"><PhotoIcon className="h-7 w-7" /></div>}
    <div className="min-w-0 flex-1"><div className="relative"><LinkIcon aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><input id={id} aria-describedby={`${id}-hint`} type="url" className={`${control} min-w-0 !pl-9 !text-xs`} value={value} onChange={e => onChange(e.target.value)} placeholder="https://…" /></div>
    <p id={`${id}-hint`} className={`mt-1 text-[10px] leading-relaxed ${value.trim() && !current ? 'text-rose-700 dark:text-rose-300' : 'text-slate-500 dark:text-slate-400'}`}>{value.trim() && !current ? 'http 또는 https 이미지 주소를 입력해주세요.' : '노래책 카드의 배경 · 비우면 기본 이미지 사용'}</p></div>
  </div></div>;
}
