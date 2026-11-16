'use client';
import type { Dispatch, SetStateAction } from 'react';
import { PlusIcon, TrashIcon, MusicalNoteIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { removeMR, mrPlaybackUrl, type SongFieldsValue } from '@/domains/catalog/song-workspace';
import { addMRCandidate } from '@/domains/catalog/mr-search';
import MRSearchPicker from '@/components/MRSearchPicker';
import MRVideoPreview from '@/components/MRVideoPreview';
import { LanguageSelector, SongTagInput, KeyAdjustmentControl, CoverImageField } from './SongMetadataControls';
import { Field, control, secondary, muted } from './SongEditorUI';
export default function SongEditorFields({ section, values, setValues, title, artist, setTitle, setArtist, tags, setTags, disabled = false, isNew = false, showDefaultDuration = true }: {
 section: string; values: SongFieldsValue; setValues: Dispatch<SetStateAction<SongFieldsValue>>;
 title: string; artist: string; setTitle: (value: string) => void; setArtist: (value: string) => void;
 tags: string; setTags: (value: string) => void; disabled?: boolean; isNew?: boolean; showDefaultDuration?: boolean;
}) {
 const update = <K extends keyof SongFieldsValue>(key: K, value: SongFieldsValue[K]) => setValues(current => ({ ...current, [key]: value }));
 return <fieldset disabled={disabled} className="min-w-0">
          {section === 'info' && <div className="space-y-4">
            {isNew && <div className="grid gap-4 rounded-2xl bg-purple-50 p-4 dark:bg-purple-950/30 sm:grid-cols-2">
              <Field label="원본 제목 (필수)"><input aria-label="원본 제목" required className={control} value={title} maxLength={200} onChange={e => setTitle(e.target.value)} placeholder="곡 제목" /></Field>
              <Field label="원본 가수 (필수)"><input aria-label="원본 가수" required className={control} value={artist} maxLength={200} onChange={e => setArtist(e.target.value)} placeholder="가수 이름" /></Field>
              <p className={`sm:col-span-2 text-xs ${muted}`}>새 곡은 DB에 등록됩니다. Google 시트에는 추가되지 않으며, 표시명은 아래에서 선택적으로 지정할 수 있습니다.</p>
            </div>}
            <p className="text-xs text-slate-500 dark:text-slate-400">표시명을 비우면 원본 제목·가수를 사용합니다.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="표시 제목" hint={title ? `원본: ${title}` : undefined}><input className={control} value={values.titleAlias} maxLength={200} onChange={e => update('titleAlias', e.target.value)} placeholder="원본 제목 사용" /></Field>
              <Field label="표시 가수" hint={artist ? `원본: ${artist}` : undefined}><input className={control} value={values.artistAlias} maxLength={200} onChange={e => update('artistAlias', e.target.value)} placeholder="원본 가수 사용" /></Field>
            </div>
            <div className="space-y-3 border-t border-slate-100 pt-3 dark:border-slate-800 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0">
              <LanguageSelector value={values.language} onChange={value => update('language', value)} />
              <SongTagInput value={tags} onChange={setTags} />
            </div>
            <CoverImageField value={values.imageUrl} onChange={value => update('imageUrl', value)} />
            {!isNew && <details className="group rounded-xl border border-slate-100 px-4 py-3 dark:border-slate-800">
              <summary className="cursor-pointer text-xs font-medium text-slate-500 transition hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200">원본 식별 정보<span className="ml-2 text-[10px] font-normal text-slate-400">읽기 전용</span></summary>
              <p className={`mt-1 mb-4 text-xs leading-relaxed ${muted}`}>원본 제목과 가수는 연결을 위해 유지됩니다. 표기 변경은 위의 표시명을 사용하세요.</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="원본 제목"><input required readOnly={!isNew} className={control} value={title} maxLength={200} onChange={e => setTitle(e.target.value)} /></Field>
                <Field label="원본 가수"><input required readOnly={!isNew} className={control} value={artist} maxLength={200} onChange={e => setArtist(e.target.value)} /></Field>
              </div>
            </details>}
          </div>}
          {section === 'mr' && <div className="space-y-4">
            <div className={`grid items-start gap-4 rounded-xl border border-slate-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-900/50 ${showDefaultDuration ? 'sm:grid-cols-2' : 'sm:max-w-md'}`}>
              {showDefaultDuration && <Field label="기본 클립 길이 (초)" hint="클립 만들기에서 종료 = 시작 + 기본 길이에 사용 · 비우면 해제"><input type="number" step="any" min="0.01" max="86400" className={`${control} !h-11 !text-base font-semibold tabular-nums placeholder:!text-sm placeholder:font-normal`} value={values.clipDuration ?? ''} onChange={e => update('clipDuration', e.target.value === '' ? null : Number(e.target.value))} placeholder="예: 240" /></Field>}
              <KeyAdjustmentControl value={values.keyAdjustment} onChange={value => update('keyAdjustment', value)} />
            </div>
            <div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold">MR 링크 <span className="ml-1 text-purple-600">{values.mrLinks.length}</span></h3><p className={`mt-1 text-xs ${muted}`}>대표 MR이 노래책에서 재생됩니다.</p></div><button type="button" disabled={values.mrLinks.length >= 30} className={`${secondary} shrink-0 whitespace-nowrap`} onClick={() => update('mrLinks', [...values.mrLinks, { url: '', skipSeconds: 0, label: '', duration: '' }])}><PlusIcon className="h-4 w-4" />MR 추가</button></div>
            <MRSearchPicker title={title} artist={artist} language={values.language} links={values.mrLinks} disabled={disabled} onSelect={candidate => { setValues(current => ({ ...current, mrLinks: addMRCandidate(current.mrLinks, candidate) }));  }} />
            {!values.mrLinks.length && <div className="rounded-2xl border border-dashed border-slate-300 p-5 text-center dark:border-slate-700"><MusicalNoteIcon className="mx-auto mb-3 h-7 w-7 text-slate-400" /><p className={muted}>아직 MR이 없습니다. 링크를 추가해 주세요.</p></div>}
            <div className="grid items-start gap-4 xl:grid-cols-2">
            {values.mrLinks.map((link, index) => <div key={index} className={`space-y-3 rounded-xl border p-3 ${index === values.selectedMRIndex ? 'border-purple-300 bg-purple-50/40 dark:border-purple-700 dark:bg-purple-950/20' : 'border-slate-200 dark:border-slate-700'}`}>
              <div className="flex items-center justify-between"><label className="flex min-h-11 items-center gap-2 text-sm font-semibold"><input type="radio" name="selectedMR" value={index} checked={index === values.selectedMRIndex} onChange={() => update('selectedMRIndex', index)} className="h-4 w-4 accent-purple-600" />MR {index + 1}{index === values.selectedMRIndex && <span className="rounded-full bg-purple-100 px-2 py-1 text-[10px] text-purple-800 dark:bg-purple-900 dark:text-purple-200">대표</span>}</label>
                <button type="button" aria-label={`MR ${index + 1} 삭제`} className={`${secondary} !px-3`} onClick={() => setValues(current => removeMR(current, index))}><TrashIcon className="h-4 w-4" /></button></div>
              <MRVideoPreview url={link.url} />
              <Field label={`MR ${index + 1} 주소`}><input type="url" className={control} value={link.url} placeholder="https://youtu.be/…" onChange={e => update('mrLinks', values.mrLinks.map((m, i) => i === index ? { ...m, url: e.target.value } : m))} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="앞부분 스킵 (초)"><input aria-label={`MR ${index + 1} 스킵 초`} type="number" min="0" max="86400" step="any" className={control} value={link.skipSeconds} onChange={e => update('mrLinks', values.mrLinks.map((m, i) => i === index ? { ...m, skipSeconds: Number(e.target.value) } : m))} /></Field>
                <Field label="버전 이름"><input aria-label={`MR ${index + 1} 버전 이름`} className={control} value={link.label} placeholder="예: 원곡 키" onChange={e => update('mrLinks', values.mrLinks.map((m, i) => i === index ? { ...m, label: e.target.value } : m))} /></Field>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2"><p className={`text-xs ${muted}`}>0초도 정상값입니다. 도입부가 있는 영상만 조정하세요.</p>{mrPlaybackUrl(link.url, link.skipSeconds) && <a href={mrPlaybackUrl(link.url, link.skipSeconds)} target="_blank" rel="noopener noreferrer" className={`${secondary} text-xs`}>스킵 위치에서 열기<ArrowTopRightOnSquareIcon className="h-4 w-4" /></a>}</div>
            </div>)}
            </div>
          </div>}
          {section === 'lyrics' && <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Field label="가사" hint={`${values.lyrics.length.toLocaleString()}자 · 입력한 줄바꿈을 유지합니다.`}><textarea rows={13} maxLength={100000} className={`${control} resize-y leading-7`} value={values.lyrics} onChange={e => update('lyrics', e.target.value)} placeholder="가사를 입력하거나 붙여넣으세요." /></Field>
            <Field label="참고 메모" hint="공개 데이터 응답에도 포함되는 항목입니다. 개인정보나 비밀 정보는 적지 마세요."><textarea rows={4} maxLength={5000} className={control} value={values.personalNotes} onChange={e => update('personalNotes', e.target.value)} placeholder="버전 차이, 주의할 구간 등" /></Field>
          </div>}
 </fieldset>;
}
