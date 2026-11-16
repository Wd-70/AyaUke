"use client";
import SongEditorFields from '@/components/song-editor/SongEditorFields';
import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { detailKey, detailQuery, statsQuery } from './song-queries';
import { ArrowTopRightOnSquareIcon, CheckIcon } from '@heroicons/react/24/outline';
import { SongFields, SongCreate, emptySongFields, mrPlaybackUrl, durationLabel, LANGUAGE_LABELS, type SongFieldsValue, type SongLibraryDetail } from '@/domains/catalog/song-workspace';
import { SongDialog, Field, Notice, control, primary, secondary, muted, songRequest, SongRequestError } from './SongWorkspaceUI';

const sections = [{ id: 'info', label: '기본 정보' }, { id: 'mr', label: 'MR · 재생' }, { id: 'lyrics', label: '가사 · 메모' }, { id: 'preview', label: '표시 미리보기' }] as const;
type Section = typeof sections[number]['id'];
export default function SongEditor({ id, scope, canEdit, canDelete, onClose, onSaved }: {
  id: string | null; scope: string; canEdit: boolean; canDelete: boolean; onClose: () => void; onSaved: (saved: SongLibraryDetail) => Promise<void>;
}) {
  const client = useQueryClient();
  const cached = id ? client.getQueryData<SongLibraryDetail>(detailKey(scope, id)) : undefined;
  const [record, setRecord] = useState<SongLibraryDetail | null>(cached || null), [values, setValues] = useState(() => cached?.values || emptySongFields());
  const [title, setTitle] = useState(cached?.title || ''), [artist, setArtist] = useState(cached?.artist || ''), [tags, setTags] = useState(cached?.values.searchTags.join(', ') || '');
  const [section, setSection] = useState<Section>('info'), [loading, setLoading] = useState(!!id && !cached), [saving, setSaving] = useState(false);
  const [error, setError] = useState(''), [message, setMessage] = useState(''), [conflict, setConflict] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'archive' | 'restore' | null>(null), [reason, setReason] = useState('');
  const [reload, setReload] = useState(0);
  const normalized = { ...values, searchTags: tags.split(',').map(t => t.trim()).filter(Boolean) };
  const baseline = record?.values || emptySongFields();
  const dirty = JSON.stringify(normalized) !== JSON.stringify(baseline) || (!record && !!(title || artist));
  const archived = record?.status === 'deleted';
  const disabled = !canEdit || saving || !!archived;
  const dirtyRef = useRef(dirty), savingRef = useRef(saving);
  dirtyRef.current = dirty; savingRef.current = saving;
  const stats = useQuery({ ...statsQuery(scope, record?.id || ''), enabled: !!record && section === 'preview' });
  const apply = (data: SongLibraryDetail) => { setRecord(data); setValues(data.values); setTags(data.values.searchTags.join(', ')); setTitle(data.title); setArtist(data.artist); };
  useEffect(() => {
    if (!id) return;
    let active = true;
    setError(''); setConflict(false);
    client.fetchQuery(detailQuery(scope, id)).then(data => {
      if (active && !dirtyRef.current && !savingRef.current) apply(data);
    }).catch(e => { if (active && !savingRef.current) setError(e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [client, scope, id, reload]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const close = () => { if (!saving && (!dirty || window.confirm('저장하지 않은 변경을 버리고 닫을까요?'))) onClose(); };
  const save = async () => {
    const parsed = record ? SongFields.safeParse(normalized) : SongCreate.safeParse({ title, artist, values: normalized });
    if (!parsed.success) {
      const issue = parsed.error.issues[0], field = String(issue.path[0] === 'values' ? issue.path[1] : issue.path[0]);
      setError(`입력 내용을 확인해주세요 (${issue.path.join('.') || '필수 정보'}): ${issue.message}`);
      setSection(field === 'mrLinks' || field === 'selectedMRIndex' || field === 'clipDuration' || field === 'keyAdjustment' ? 'mr' : field === 'lyrics' || field === 'personalNotes' ? 'lyrics' : 'info');
      return;
    }
    setSaving(true); setError(''); setMessage('');
    try {
      const data = await songRequest<SongLibraryDetail>(record ? `/api/admin/song-library/${record.id}` : '/api/admin/song-library', {
        method: record ? 'PATCH' : 'POST',
        body: JSON.stringify(record ? { action: 'edit', expectedUpdatedAt: record.updatedAt, values: normalized } : { title, artist, values: normalized }),
      });
      apply(data); setConflict(false); setMessage('저장했습니다. 노래책을 새로 열면 변경된 내용이 표시됩니다.'); await onSaved(data);
    } catch (e) { setError((e as Error).message); setConflict(e instanceof SongRequestError && e.status === 409); }
    finally { setSaving(false); }
  };
  const changeStatus = async () => {
    if (!record || !confirmAction || dirty || !canDelete) return;
    setSaving(true); setError('');
    try {
      const data = await songRequest<SongLibraryDetail>(`/api/admin/song-library/${record.id}`, { method: 'PATCH', body: JSON.stringify({ action: confirmAction, expectedUpdatedAt: record.updatedAt, reason }) });
      apply(data); setConfirmAction(null); setMessage(confirmAction === 'archive' ? '보관함으로 옮겼습니다. 연결된 클립은 그대로 유지됩니다.' : '노래책에 복원했습니다.'); await onSaved(data);
    } catch (e) { setError((e as Error).message); setConflict(e instanceof SongRequestError && e.status === 409); }
    finally { setSaving(false); }
  };
  const mr = values.mrLinks[values.selectedMRIndex];
  const playbackUrl = mr ? mrPlaybackUrl(mr.url, mr.skipSeconds) : '';
  return <SongDialog wide title={record ? (values.titleAlias || record.title) : '새 노래 등록'} subtitle={record ? `${record.artist} · ${archived ? '보관 중' : '등록곡 편집'}` : '원본 정보부터 MR까지, 한 번에 등록하세요.'} onClose={close}
    footer={<div className="flex flex-wrap items-center justify-between gap-2">
      <p aria-live="polite" className={`${muted} text-xs`}>{saving ? '저장 중…' : dirty ? '저장하지 않은 변경이 있습니다' : record ? '모든 변경이 저장되어 있습니다' : '필수 항목: 원본 제목 · 원본 가수'}</p>
      <div className="flex gap-2"><button type="button" onClick={close} disabled={saving} className={secondary}>닫기</button>
        {!archived && <button type="button" onClick={save} disabled={disabled || loading || (!!id && !record) || (!dirty && !!record)} className={primary}>{saving ? '저장 중…' : record ? '변경 저장' : '노래 등록'}</button>}</div>
    </div>}>
    <div className="space-y-5">
      {error && <Notice error>{error}{conflict && record && <button type="button" className="ml-2 min-h-11 underline" onClick={async () => {
        if (dirty && !window.confirm('입력 중인 내용을 버리고 최신 정보를 불러올까요?')) return;
        setLoading(true);
        try { const fresh = await songRequest<SongLibraryDetail>(`/api/admin/song-library/${record.id}`); await onSaved(fresh); apply(fresh); setError(''); setConflict(false); }
        catch (e) { setError((e as Error).message); } finally { setLoading(false); }
      }}>최신 정보 불러오기</button>}</Notice>}
      {message && <Notice>{message}</Notice>}
      {loading ? <p role="status" className="py-16 text-center text-slate-500">곡 정보를 불러오고 있습니다…</p> : id && !record ? <button className={secondary} onClick={() => { void client.invalidateQueries({ queryKey: detailKey(scope, id) }); setLoading(true); setReload(x => x + 1); }}>다시 시도</button> : <>
        {archived && <Notice>노래책에서 제외된 곡입니다. 복원하면 다시 표시됩니다.{record?.deleteReason && <span className="mt-1 block text-xs">보관 사유: {record.deleteReason}</span>}</Notice>}
        <nav aria-label="곡 편집 항목" className="grid grid-cols-4 gap-1 rounded-2xl bg-slate-100 p-1 dark:bg-slate-900">
          {sections.map(tab => <button type="button" key={tab.id} aria-current={section === tab.id ? 'page' : undefined} onClick={() => setSection(tab.id)}
            className={`min-h-11 rounded-xl px-1 text-xs font-semibold transition sm:text-sm ${section === tab.id ? 'bg-white text-purple-800 shadow-sm dark:bg-slate-800 dark:text-purple-200' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}>{tab.label}</button>)}
        </nav>
        <SongEditorFields section={section} values={values} setValues={next => { setMessage(''); setValues(next); }} title={title} artist={artist} setTitle={setTitle} setArtist={setArtist} tags={tags} setTags={next => { setMessage(''); setTags(next); }} disabled={disabled} isNew={!record} />
        {section === 'preview' && <div className="space-y-5">
          <p className={muted}>노래책과 동일한 표시명 우선순위를 적용한 미리보기입니다. 공식 등록 표시는 실제 Google 시트 포함 여부에 따라 달라집니다.</p>
          <div className="overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800">
            <div className="relative min-h-44 overflow-hidden bg-gradient-to-br from-purple-800 via-violet-600 to-indigo-700 p-7 text-white">
              {/^https?:\/\//.test(values.imageUrl) && <img alt="" src={values.imageUrl} className="absolute inset-0 h-full w-full object-cover" />}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 to-slate-950/10" />
              <div className="relative"><div className="mb-5 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-white/20 px-3 py-1">{LANGUAGE_LABELS[values.language] || '미설정'}</span>{values.keyAdjustment != null && <span className="rounded-full bg-white/20 px-3 py-1">{values.keyAdjustment === 0 ? '원본키' : `${values.keyAdjustment > 0 ? '+' : ''}${values.keyAdjustment}키`}</span>}</div>
                <h3 className="break-words text-3xl font-bold tracking-tight">{values.titleAlias || title || '노래 제목'}</h3><p className="mt-2 text-white/80">{values.artistAlias || artist || '가수'}</p></div>
            </div>
            <div className="space-y-4 bg-white p-5 dark:bg-slate-900"><div className="flex flex-wrap gap-2">{normalized.searchTags.map((tag, i) => <span key={i} className="rounded-lg bg-slate-100 px-2 py-1 text-xs dark:bg-slate-800">#{tag}</span>)}</div>
              <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold">{mr ? mr.label || `대표 MR ${values.selectedMRIndex + 1}` : 'MR 미등록'}</p><p className={`mt-1 text-xs ${muted}`}>스킵 {mr?.skipSeconds || 0}초 · 기본 클립 {durationLabel(values.clipDuration)}</p></div>{playbackUrl && <a target="_blank" rel="noopener noreferrer" href={playbackUrl} className={primary}>MR 열기<ArrowTopRightOnSquareIcon className="h-4 w-4" /></a>}</div>
            </div>
          </div>
          {record && <dl className="grid grid-cols-3 gap-3 rounded-2xl bg-slate-50 p-4 text-sm dark:bg-slate-900"><div><dt className={muted}>연결 클립</dt><dd className="mt-1 text-xl font-semibold">{stats.data?.clips ?? (stats.isError ? '조회 실패' : '…')}</dd></div><div><dt className={muted}>검증 클립</dt><dd className="mt-1 text-xl font-semibold">{stats.data?.verifiedClips ?? (stats.isError ? '조회 실패' : '…')}</dd></div><div><dt className={muted}>좋아요</dt><dd className="mt-1 text-xl font-semibold">{record.likeCount}</dd></div></dl>}
        </div>}
        {record && section === 'info' && <div className="flex flex-wrap items-start justify-between gap-4 border-t border-slate-100 pt-5 dark:border-slate-800">
          <div className={`text-xs leading-6 ${muted}`}><p>DB 등록 경로: {record.sourceType === 'admin' ? '관리자 추가' : '시트 기반 / 기존 데이터'}</p><p>최근 수정: {record.updatedAt ? new Date(record.updatedAt).toLocaleString('ko-KR') : '기록 없음'}</p><p className="break-all text-[10px]">ID {record.id}</p></div>
          {canDelete && <button type="button" disabled={saving || dirty} className={secondary} title={dirty ? '변경을 먼저 저장하거나 취소해주세요.' : undefined} onClick={() => setConfirmAction(archived ? 'restore' : 'archive')}>{archived ? '노래책에 복원' : '보관함으로 이동'}</button>}
        </div>}
        {confirmAction && <div className="space-y-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
          <h3 className="font-semibold">{confirmAction === 'archive' ? '노래책에서 이 곡을 제외할까요?' : '이 곡을 노래책에 복원할까요?'}</h3><p className={muted}>곡 데이터와 연결된 클립은 삭제하지 않습니다. 보관함에서 다시 복원할 수 있습니다.</p>
          {confirmAction === 'archive' && <Field label="보관 사유 (선택)"><input className={control} value={reason} maxLength={500} onChange={e => setReason(e.target.value)} /></Field>}
          <div className="flex gap-2"><button disabled={saving} type="button" className={secondary} onClick={() => setConfirmAction(null)}>취소</button><button disabled={saving || dirty || !canDelete} type="button" className={primary} onClick={changeStatus}><CheckIcon className="h-4 w-4" />{confirmAction === 'archive' ? '보관 확인' : '복원 확인'}</button></div>
        </div>}
      </>}
    </div>
  </SongDialog>;
}
