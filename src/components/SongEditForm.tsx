'use client';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { Song } from '@/types';
import { SongFields, emptySongFields, SONG_LANGUAGES, type SongFieldsValue } from '@/domains/catalog/song-workspace';
import { compactMRLinks } from '@/domains/catalog/mr-search';
import SongEditorFields from './song-editor/SongEditorFields';
import { Notice, primary, secondary, muted } from './song-editor/SongEditorUI';
import { useToast } from './Toast';

export interface SongEditFormHandle { requestCancel: () => void }
interface Props {
  song: Song; isVisible: boolean;
  onSave: (song: Song) => void; onCancel: () => void;
}
const sections = [{ id: 'info', label: '기본 정보' }, { id: 'mr', label: 'MR · 재생' }, { id: 'lyrics', label: '가사 · 메모' }] as const;
type Section = typeof sections[number]['id'];
function initialValues(song: Song): SongFieldsValue {
  return { ...emptySongFields(), titleAlias: song.titleAlias || '', artistAlias: song.artistAlias || '',
    language: SONG_LANGUAGES.includes(song.language as typeof SONG_LANGUAGES[number]) ? song.language as SongFieldsValue['language'] : '',
    lyrics: song.lyrics || '', personalNotes: song.personalNotes || '', imageUrl: song.imageUrl || '',
    searchTags: [...(song.searchTags || [])], keyAdjustment: song.keyAdjustment ?? null,
    mrLinks: (song.mrLinks || []).map(link => ({ url: link.url, skipSeconds: link.skipSeconds || 0, label: link.label || '', duration: link.duration || '' })),
    selectedMRIndex: song.selectedMRIndex || 0 };
}
const SongEditForm = forwardRef<SongEditFormHandle, Props>(function SongEditForm({ song, isVisible, onSave, onCancel }, ref) {
  const { showSuccess } = useToast();
  // Snapshot once per edit session, not whenever a background song object changes.
  const [baseline] = useState(() => initialValues(song));
  const [values, setValues] = useState(baseline);
  const [tags, setTags] = useState(baseline.searchTags.join(', '));
  const [section, setSection] = useState<Section>('info');
  const [saving, setSaving] = useState(false), [error, setError] = useState('');
  const saveLock = useRef(false), scrollRef = useRef<HTMLDivElement>(null);
  const normalized = { ...values, searchTags: tags.split(',').map(tag => tag.trim()).filter(Boolean) };
  const dirty = JSON.stringify(normalized) !== JSON.stringify(baseline);
  const requestCancel = () => {
    if (!saveLock.current && (!dirty || window.confirm('저장하지 않은 변경을 버리고 보기로 돌아갈까요?'))) onCancel();
  };
  useImperativeHandle(ref, () => ({ requestCancel }));
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: 0 }); }, [section]);
  const save = async () => {
    if (saveLock.current || !dirty || !song.id) return;
    const compact = { ...normalized, ...compactMRLinks(normalized.mrLinks, normalized.selectedMRIndex) };
    const parsed = SongFields.safeParse(compact);
    if (!parsed.success) {
      const issue = parsed.error.issues[0], field = String(issue.path[0]);
      setError(`입력 내용을 확인해주세요: ${issue.message}`);
      setSection(['mrLinks', 'selectedMRIndex', 'keyAdjustment'].includes(field) ? 'mr' : ['lyrics', 'personalNotes'].includes(field) ? 'lyrics' : 'info');
      return;
    }
    saveLock.current = true; setSaving(true); setError('');
    try {
      // clipDuration is not available in the public Song model: never clear it when editing here.
      const { clipDuration: _duration, ...editable } = parsed.data;
      const response = await fetch(`/api/songdetails/${song.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editable,
          titleAlias: editable.titleAlias === song.title.trim() ? null : editable.titleAlias || null,
          artistAlias: editable.artistAlias === song.artist.trim() ? null : editable.artistAlias || null }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success || !result.data?.song) throw new Error(result?.error?.message || '저장하지 못했습니다. 잠시 후 다시 시도해주세요.');
      onSave(result.data.song);
      showSuccess('수정 완료', '변경 내용을 저장했습니다.');
    } catch (e) { setError((e as Error).message); }
    finally { saveLock.current = false; setSaving(false); }
  };
  if (!isVisible) return null;
  const query = encodeURIComponent(`${values.titleAlias || song.title} ${values.artistAlias || song.artist} 가사`);
  return <div aria-label="곡 정보 수정" className="flex h-full min-h-0 flex-col text-slate-900 dark:text-slate-100">
    <nav aria-label="노래책 편집 항목" className="mx-2 mt-2 grid shrink-0 grid-cols-3 gap-1 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800 sm:mx-3 sm:mt-2">
      {sections.map(tab => <button type="button" key={tab.id} autoFocus={tab.id === 'info'} disabled={saving} aria-current={tab.id === section ? 'page' : undefined} onClick={() => setSection(tab.id)}
        className={`min-h-11 rounded-xl px-2 text-sm font-semibold ${tab.id === section ? 'bg-white text-purple-800 shadow-sm dark:bg-slate-950 dark:text-purple-200' : 'text-slate-600 dark:text-slate-400'}`}>{tab.label}</button>)}
    </nav>
    <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-2 sm:p-3">
      {error && <Notice error>{error}</Notice>}
      {section === 'lyrics' && <div className="flex flex-wrap items-center justify-between gap-2"><p className={muted}>줄바꿈을 유지해 가사를 입력하세요.</p><a href={`https://www.google.com/search?q=${query}`} target="_blank" rel="noopener noreferrer" className={secondary}>가사 검색 ↗</a></div>}
      <SongEditorFields section={section} values={values} setValues={setValues} title={song.title} artist={song.artist} setTitle={() => {}} setArtist={() => {}} tags={tags} setTags={setTags} disabled={saving} showDefaultDuration={false} />
    </div>
    <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-2 pt-2 pb-[max(.75rem,env(safe-area-inset-bottom))] dark:border-slate-800 dark:bg-slate-900 sm:px-3">
      <p role="status" className="text-xs text-slate-600 dark:text-slate-400">{saving ? '저장 중…' : dirty ? '저장하지 않은 변경이 있습니다' : '변경한 내용이 없습니다'}</p>
      <div className="ml-auto flex gap-2"><button type="button" disabled={saving} className={secondary} onClick={requestCancel}>취소</button><button type="button" disabled={saving || !dirty} className={primary} onClick={save}>{saving ? '저장 중…' : '변경 저장'}</button></div>
    </footer>
  </div>;
});
export default SongEditForm;
