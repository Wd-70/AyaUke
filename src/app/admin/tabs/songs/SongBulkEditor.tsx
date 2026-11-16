"use client";
import { useQueryClient } from '@tanstack/react-query';
import { cacheBulkSongs } from './song-queries';
import { useState } from 'react';
import { LANGUAGE_LABELS, SONG_LANGUAGES, displaySongTitle, type SongLibraryItem } from '@/domains/catalog/song-workspace';
import { SongDialog, Field, Notice, control, primary, secondary, muted, songRequest } from './SongWorkspaceUI';
export default function SongBulkEditor({ songs, scope, onClose, onSaved }: { songs: SongLibraryItem[]; scope: string; onClose: () => void; onSaved: (message: string) => void }) {
  const client = useQueryClient();
  const [field, setField] = useState('searchTags'), [tags, setTags] = useState(''), [language, setLanguage] = useState('Korean'), [key, setKey] = useState('');
  const [saving, setSaving] = useState(false), [error, setError] = useState('');
  const save = async () => {
    const value = field === 'searchTags' ? tags.split(',').map(t => t.trim()).filter(Boolean) : field === 'language' ? language : key === '' ? null : Number(key);
    if (Array.isArray(value) && !value.length) { setError('추가할 태그를 입력해주세요.'); return; }
    setSaving(true); setError('');
    try {
      const result = await songRequest<{ changed: string[]; conflicts: string[]; updated: SongLibraryItem[] }>('/api/admin/song-library/bulk', { method: 'POST', body: JSON.stringify({ targets: songs.map(song => ({ id: song.id, updatedAt: song.updatedAt })), change: { field, value } }) });
      await cacheBulkSongs(client, scope, result);
      onSaved(`${result.changed.length}곡을 수정했습니다.${result.conflicts.length ? ` 다른 작업에서 변경된 ${result.conflicts.length}곡은 건너뛰었습니다. 최신 목록에서 다시 선택해주세요.` : ''}`);
      onClose();
    } catch (e) { setError((e as Error).message); } finally { setSaving(false); }
  };
  return <SongDialog title={`${songs.length}곡 일괄 수정`} subtitle="선택한 항목 하나만 변경합니다." onClose={() => { if (!saving) onClose(); }}
    footer={<div className="flex justify-end gap-2"><button disabled={saving} className={secondary} onClick={onClose}>취소</button><button disabled={saving} className={primary} onClick={save}>{saving ? '반영 중…' : `${songs.length}곡에 적용`}</button></div>}>
    <div className="space-y-5">{error && <Notice error>{error}</Notice>}
      <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-900"><p className="mb-2 text-xs font-semibold text-slate-500">변경 대상 확인</p><ul className="space-y-1 text-sm">{songs.slice(0, 6).map(song => <li key={song.id} className="truncate">{displaySongTitle(song)}</li>)}</ul>{songs.length > 6 && <p className={`mt-2 ${muted}`}>외 {songs.length - 6}곡</p>}</div>
      <Field label="변경할 항목"><select className={control} value={field} disabled={saving} onChange={e => setField(e.target.value)}><option value="searchTags">검색 태그 추가</option><option value="language">언어 변경</option><option value="keyAdjustment">키 조절 변경</option></select></Field>
      {field === 'searchTags' ? <Field label="추가할 태그" hint="쉼표로 구분 · 기존 태그는 유지하며 중복은 추가하지 않습니다."><input disabled={saving} className={control} value={tags} onChange={e => setTags(e.target.value)} placeholder="발라드, 애니메이션" /></Field>
        : field === 'language' ? <Field label="언어"><select disabled={saving} className={control} value={language} onChange={e => setLanguage(e.target.value)}>{SONG_LANGUAGES.map(lang => <option key={lang} value={lang}>{LANGUAGE_LABELS[lang]}</option>)}</select></Field>
        : <Field label="키 조절"><select disabled={saving} className={control} value={key} onChange={e => setKey(e.target.value)}><option value="">키 조절 해제</option>{Array.from({ length: 25 }, (_, i) => i - 12).map(n => <option key={n} value={n}>{n === 0 ? '원본키' : `${n > 0 ? '+' : ''}${n}키`}</option>)}</select></Field>}
      <p className={`text-xs leading-relaxed ${muted}`}>변경된 값은 선택한 모든 곡에 적용됩니다. 그동안 다른 관리자가 수정한 곡은 덮어쓰지 않고 건너뜁니다.</p>
    </div>
  </SongDialog>;
}
