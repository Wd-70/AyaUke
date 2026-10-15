'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { loadDetail, changeRange } from './range-client';
import { rangeButton } from './RangeControls';
import type { ClipRange } from '@/domains/archive/clip-range.policy';
import { validRange, roundTime } from '@/domains/archive/clip-range.policy';
import { formatPreciseTime } from '@/shared/utils/clip-time';

export default function AdminRangePanel({ clipId, draft, onImport, onSaved, onBusy, preview, disabled = false }: {
  clipId: string; draft: ClipRange; onImport: (range: ClipRange) => void;
  onSaved: (clip: Record<string, unknown>) => void; onBusy?: (busy: boolean) => void; preview?: (time: number) => void; disabled?: boolean;
}) {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['admin-clip-range', clipId], queryFn: () => loadDetail(clipId), staleTime: 0, refetchOnWindowFocus: false });
  const [selected, setSelected] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const data = query.data;
  const save = async () => {
    if (!data) return;
    setBusy(true); onBusy?.(true); setMessage('');
    try {
      const result = await changeRange(clipId, { action: 'publish', sourceVersion: data.sourceVersion,
        baseVersion: data.rangeVersion, range: draft, proposalId: selected });
      client.setQueryData(['admin-clip-range', clipId], result.range);
      await client.invalidateQueries({ queryKey: ['admin-clips'] });
      await client.invalidateQueries({ queryKey: ['clip-range'] });
      if (result.clip) onSaved(result.clip);
      setSelected(undefined); setMessage('공식 구간 저장 및 검증 완료');
    } catch(e) { setMessage((e as Error).message); }
    finally { setBusy(false); onBusy?.(false); }
  };
  return <section className="space-y-3 rounded-xl border border-purple-200 p-3 dark:border-purple-800">
    <div className="flex items-center justify-between gap-2"><h4 className="text-sm font-semibold">사용자 제안 · 공식 검증</h4>
      <button className={rangeButton} disabled={busy || query.isFetching} onClick={() => { setSelected(undefined); query.refetch(); }}>최신 구간 조회</button></div>
    {query.isError && <p role="alert" className="text-sm">구간 조회에 실패했습니다. 다시 조회해주세요.</p>}
    {data && <>
      <p className="text-sm">현재 공식값 {formatPreciseTime(data.official.startTime)} ~ {data.official.endTime === null ? '미설정' : formatPreciseTime(data.official.endTime)} · {data.isVerified ? '검증됨' : '미검증'}</p>
      {!data.proposals.length && <p className="text-sm opacity-70">활성 제안이 없습니다. 현재 편집값을 공식 저장할 수 있습니다.</p>}
      {data.proposals.map(p => <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-purple-50 p-2 text-sm dark:bg-purple-900/20">
        <span>{data.recommendationId === p.id ? '추천 · ' : ''}시작 {roundTime(p.startTime - data.official.startTime)}초 / 끝 {data.official.endTime === null ? '신규' : `${roundTime(p.endTime! - data.official.endTime)}초`} · 확인 {p.support} / 문제 {p.objections}</span>
        <button className={rangeButton} disabled={disabled || busy} onClick={() => { setSelected(p.id); onImport({ startTime: p.startTime, endTime: p.endTime }); }}>편집값으로 가져오기{selected === p.id ? ' ✓' : ''}</button>
        <button className={rangeButton} disabled={!preview || busy} onClick={() => preview?.(p.startTime)}>시작 듣기</button>
        <button className={rangeButton} disabled={!preview || busy} onClick={() => preview?.(Math.max(p.startTime, p.endTime! - 10))}>끝 직전 듣기</button>
      </div>)}
      <button className={rangeButton} disabled={disabled || busy || query.isFetching || draft.endTime === null || !validRange(draft)} onClick={save}>
        {busy ? '공식 구간 저장 중…' : '현재 편집 구간 공식 저장 및 검증 완료'}
      </button>
      <p className="text-xs opacity-70">시작·종료 구간과 검증 표시를 함께 저장합니다. 설명·날짜·영상 URL 변경은 기존 저장 버튼을 사용해주세요.</p>
    </>}
    {message && <p role="status" className="text-sm">{message}</p>}
  </section>;
}
