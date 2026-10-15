'use client';

import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import ClipPlayer, { type ClipPlayerHandle } from '../ClipPlayer';
import type { ClipRange, ClipRangeDTO, RangeProposalDTO } from '@/domains/archive/clip-range.policy';
import { validRange, roundTime } from '@/domains/archive/clip-range.policy';
import { formatRelativeClipTime } from '@/shared/utils/clip-time';
import RangeControls, { rangeButton } from './RangeControls';
import { changeRange, loadDetail } from './range-client';
import { planRangeSave, sameRange } from './editor-policy';
import { clearLocalDraft, readLocalDraft, writeLocalDraft } from './local-draft';
import RangeTimeline from './RangeTimeline';
import { boundaryPreview, describeRangeChanges, type PreviewSegment } from './editor-experience';

export default function ClipRangeEditor({ initial, owner, loggedIn, onClose, onApply }: {
  initial: ClipRangeDTO; owner: string; loggedIn: boolean; onClose: () => void;
  onApply: (data: ClipRangeDTO) => void;
}) {
  const [data, setData] = useState(initial);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [sourceChanged, setSourceChanged] = useState<ClipRangeDTO | null>(null);
  const [draft, setDraft] = useState<ClipRange>(initial.effective);
  const [baseline, setBaseline] = useState<ClipRange>(initial.effective);
  const [inputValid, setInputValid] = useState(true);
  const [controlsRevision, setControlsRevision] = useState(0);
  // Keep zero fixed even when the draft, recommendation, or preview window changes.
  const [timeOrigin, setTimeOrigin] = useState(initial.effective.startTime);
  const [localAvailable, setLocalAvailable] = useState(true);
  const [restored, setRestored] = useState(false);
  const [history, setHistory] = useState<ClipRange[]>([]);
  const [windowRange, setWindowRange] = useState({ start: Math.max(0, draft.startTime - 15), end: (draft.endTime ?? draft.startTime + 240) + 15 });
  const [previewPlayback, setPreviewPlayback] = useState({ position: initial.effective.startTime, play: true });
  const [duration, setDuration] = useState(0);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [savePhase, setSavePhase] = useState<'saving' | 'sharing' | null>(null);
  const [shareFailure, setShareFailure] = useState<{ range: ClipRange; baseVersion: number; sourceVersion: number; personalSaved: boolean } | null>(null);
  const [previewStatus, setPreviewStatus] = useState('');
  const [pendingSave, setPendingSave] = useState<{ range: ClipRange; share: boolean } | null>(null);
  const [heard, setHeard] = useState<Record<string, boolean>>({});
  const player = useRef<ClipPlayerHandle | null>(null);
  const pending = useRef<PreviewSegment | null>(null);
  const activePreview = useRef<(PreviewSegment & { started: boolean; crossed: boolean }) | null>(null);
  const [currentTime, setCurrentTime] = useState(initial.effective.startTime);
  const savedPersonal = useRef<ClipRangeDTO | null>(null);
  const close = () => savedPersonal.current ? onApply(savedPersonal.current) : onClose();

  useEffect(() => {
    const local = readLocalDraft(owner, initial);
    setLocalAvailable(local.available);
    if (!local.draft) return;
    const { timeOrigin: origin, baseline: savedBaseline, ...range } = local.draft;
    setBaseline(savedBaseline ?? initial.effective);
    setDraft(range); setTimeOrigin(origin); setRestored(true);
    setWindowRange({ start: Math.max(0, range.startTime - 15), end: Math.max(range.startTime, range.endTime ?? range.startTime + 240) + 15 });
    setPreviewPlayback({ position: range.startTime, play: true });
  }, [owner, initial]);

  useEffect(() => {
    let live = true;
    loadDetail(initial.clipId).then(value => {
      if (!live) return;
      if (value.sourceVersion !== initial.sourceVersion) { clearLocalDraft(owner, initial); setSourceChanged(value); }
      else setData(value);
    }).catch(e => { if (live) setMessage(e.message); });
    return () => { live = false; };
  }, [initial.clipId, initial.sourceVersion, owner]);
  useEffect(() => {
    const timer = setInterval(() => {
      const p = player.current;
      const length = p?.getDuration?.() ?? 0;
      if (length > 0) {
        setDuration(length); setReady(true);
        if (pending.current) {
          const preview = pending.current; pending.current = null;
          p?.seekTo?.(preview.from); p?.play(); activePreview.current = { ...preview, started: false, crossed: false };
          setPreviewStatus(`${preview.label} 재생 중`);
          return; // A platform seek is asynchronous; do not inspect its old position.
        }
      }
      const now = p?.getCurrentTime?.() ?? initial.effective.startTime;
      setCurrentTime(now);
      const active = activePreview.current;
      if (active && !active.started && now >= active.from - 0.25 && now <= active.from + 2) active.started = true;
      if (active?.started && active.boundary !== undefined && !active.crossed && now >= active.boundary) {
        active.crossed = true;
        setPreviewStatus(`설정한 ${active.edge === 'start' ? '시작점' : '종료점'}을 지났습니다`);
      }
      if (active?.started && now >= active.to - 0.05) {
        p?.pause();
        const key = active.key;
        if (key) setHeard(prev => ({ ...prev, [key]: true }));
        setPreviewStatus(`${active.label} 완료`);
        activePreview.current = null;
      }
    }, 100);
    return () => { clearInterval(timer); player.current?.pause(); };
  }, [initial.effective.startTime]);

  const persistDraft = (next: ClipRange) => {
    setLocalAvailable(sameRange(next, baseline)
      ? clearLocalDraft(owner, initial) : writeLocalDraft(owner, initial, next, timeOrigin, baseline));
  };
  const cancelPreview = () => {
    if (pending.current || activePreview.current) player.current?.pause();
    pending.current = null; activePreview.current = null; setPreviewStatus('');
  };
  const updateDraft = (next: ClipRange) => {
    cancelPreview(); setShareFailure(null); setMessage('');
    setDraft(next); persistDraft(next);
    setPreviewPlayback({ position: player.current?.getCurrentTime?.() ?? next.startTime, play: player.current?.isPlaying() ?? false });
    setWindowRange(w => ({ start: Math.min(w.start, next.startTime), end: Math.max(w.end, next.endTime ?? w.end) }));
  };
  const edit = (next: ClipRange) => {
    if (busy || sameRange(next, draft)) return;
    setHistory(h => [...h.slice(-29), draft]); updateDraft(next);
  };
  const resetEditing = (range: ClipRange) => {
    cancelPreview(); setShareFailure(null);
    setDraft(range); setHistory([]); setRestored(false); setMessage('');
    setBaseline(range); setControlsRevision(revision => revision + 1); setInputValid(true);
    setTimeOrigin(range.startTime);
    setLocalAvailable(clearLocalDraft(owner, initial));
    setWindowRange({ start: Math.max(0, range.startTime - 15), end: (range.endTime ?? range.startTime + 240) + 15 });
    setPreviewPlayback({ position: range.startTime, play: false });
    player.current?.pause();
  };
  const expand = (edge: 'start' | 'end') => {
    cancelPreview();
    setPreviewPlayback({ position: player.current?.getCurrentTime?.() ?? draft.startTime, play: player.current?.isPlaying() ?? false });
    setReady(false);
    setWindowRange(w => edge === 'start' ? { ...w, start: Math.max(0, w.start - 30) } : { ...w, end: Math.min(w.end + 30, duration || Infinity) });
  };
  const startPreview = (segment: PreviewSegment) => {
    cancelPreview();
    const { from, to } = segment;
    pending.current = segment;
    setPreviewStatus(`${segment.label} 준비 중`);
    const needsExpansion = from < windowRange.start || to > windowRange.end;
    if (needsExpansion) { setPreviewPlayback({ position: from, play: true }); setReady(false); setWindowRange(w => ({ start: Math.min(w.start, from), end: Math.max(w.end, to) })); }
  };
  const preview = (value: ClipRange, edge: 'start' | 'end', key?: string, context = false) => {
    const segment = boundaryPreview(value, edge, context, duration || Infinity);
    if (segment) startPreview({ ...segment, key });
  };
  const playSelection = () => {
    if (inputValid && draft.endTime !== null && validRange(draft, duration || undefined)) {
      startPreview({ from: draft.startTime, to: draft.endTime, label: '편집 구간' });
    }
  };
  const act = async (action: object) => {
    if (!mounted.current) throw new Error('편집 세션이 종료되었습니다.');
    const result = await changeRange(data.clipId, action);
    if (mounted.current) setData(result.range);
    return result.range;
  };
  const save = async (input: ClipRange, share: boolean, pin = false) => {
    // Effective ranges and imported proposals may carry metadata; submit times only.
    const value: ClipRange = { startTime: input.startTime, endTime: input.endTime };
    if (busy || !inputValid) return;
    if (value.endTime === null || !validRange(value, duration || undefined)) { setMessage('시작보다 뒤에 있는 종료 시각을 지정해주세요.'); return; }
    if (!loggedIn) { clearLocalDraft(owner, initial); onApply({ ...data, effective: { ...value, origin: 'personal' } }); return; }
    const plan = planRangeSave(data, initial.effective, value, loggedIn, share);
    if (plan.confirmPin && !pin) {
      cancelPreview();
      player.current?.pause();
      setPendingSave({ range: { ...value }, share: plan.share });
      return;
    }
    setPendingSave(null);
    cancelPreview(); player.current?.pause();
    setBusy(true); setSavePhase('saving'); setShareFailure(null); setMessage('');
    try {
      let saved = data;
      if (plan.savePersonal || pin) {
        saved = await act({ action: 'personal', sourceVersion: data.sourceVersion, range: value, pin });
        if (!mounted.current) return;
        savedPersonal.current = saved;
      }
      if (plan.share) {
        setSavePhase('sharing');
        try { saved = await act({ action: 'propose', sourceVersion: data.sourceVersion, baseVersion: data.rangeVersion, range: value }); }
        catch (error) {
          setShareFailure({ range: { ...value }, sourceVersion: data.sourceVersion, baseVersion: data.rangeVersion, personalSaved: sameRange(saved.personal ?? saved.effective, value) });
          setMessage(`공유 실패: ${(error as Error).message}`); return;
        }
      }
      if (!mounted.current) return;
      clearLocalDraft(owner, initial);
      onApply(saved);
    } catch (e) { setMessage((e as Error).message); }
    finally { setBusy(false); setSavePhase(null); }
  };
  const retryShare = async () => {
    if (!shareFailure || busy) return;
    setBusy(true); setSavePhase('sharing'); setMessage('');
    try {
      const result = await act({ action: 'propose', range: shareFailure.range, sourceVersion: shareFailure.sourceVersion, baseVersion: shareFailure.baseVersion });
      if (!mounted.current) return;
      clearLocalDraft(owner, initial); setShareFailure(null); onApply(result);
    } catch (error) { setMessage(`공유 실패: ${(error as Error).message}`); }
    finally { setBusy(false); setSavePhase(null); }
  };
  const resetPersonal = async () => {
    if (!loggedIn) { clearLocalDraft(owner, initial); onApply({ ...data, effective: { ...data.official, origin: data.isVerified ? 'official' : 'original' } }); return; }
    setBusy(true);
    try {
      const result = await act({ action: 'personal', sourceVersion: data.sourceVersion, range: null });
      if (!mounted.current) return;
      clearLocalDraft(owner, initial); onApply(result);
    }
    catch (e) { setMessage((e as Error).message); } finally { setBusy(false); }
  };
  const vote = async (p: RangeProposalDTO, edge: 'start' | 'end', value: number) => {
    setBusy(true);
    try { await act({ action: 'vote', proposalId: p.id, start: p.vote?.start ?? 0, end: p.vote?.end ?? 0, [edge]: value }); }
    catch (e) { setMessage((e as Error).message); } finally { setBusy(false); }
  };
  const reload = async () => {
    setBusy(true);
    try {
      const latest = await loadDetail(data.clipId);
      if (latest.sourceVersion !== data.sourceVersion) { clearLocalDraft(owner, initial); setSourceChanged(latest); return; }
      setData(latest); resetEditing(latest.effective); setMessage('최신 구간을 불러왔습니다.');
    } catch (e) { setMessage((e as Error).message); }
    finally { setBusy(false); }
  };

  if (sourceChanged) return <Dialog open onClose={() => onApply(sourceChanged)} className="relative z-[200]">
    <div className="fixed inset-0 flex items-center justify-center bg-black/60 p-4">
      <DialogPanel className="rounded-xl bg-white p-6 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
        <DialogTitle>원본 영상이 변경되었습니다</DialogTitle>
        <p className="my-3 text-sm">이전 영상의 편집값은 저장하지 않습니다. 새 원본을 확인해주세요.</p>
        <button className={rangeButton} onClick={() => onApply(sourceChanged)}>새 원본으로 돌아가기</button>
      </DialogPanel>
    </div>
  </Dialog>;

  return <><Dialog open onClose={() => { if (!busy && !pendingSave) close(); }} className="relative z-[200]">
    <div className="fixed inset-0 bg-black/60" aria-hidden="true" />
    <div className="fixed inset-0 overflow-y-auto p-3 sm:p-6">
      <DialogPanel className="mx-auto max-w-3xl space-y-4 rounded-2xl bg-white p-4 text-gray-900 shadow-xl dark:bg-gray-900 dark:text-gray-100 sm:p-6">
        <div className="flex items-center justify-between gap-3"><div><DialogTitle className="text-lg font-bold">재생 구간 조정</DialogTitle><p className="text-xs">현재 적용: {{ personal: '내 구간', official: '공식 · 검증됨', community: '커뮤니티 추천', original: '기본 구간' }[initial.effective.origin]}</p></div><button className={rangeButton} disabled={busy} onClick={close}>닫기</button></div>
        <p className="text-sm">{data.isVerified ? '공식 검증된 클립입니다. 내 구간만 변경할 수 있어요.' : '미검증 클립의 불필요한 끝부분을 정리해주세요. 곡의 마지막 여운은 남겨주세요.'}</p>
        <ClipPlayer key={`${windowRange.start}:${windowRange.end}`} ref={player} platform={data.platform} videoId={data.videoId}
          displayTimeOrigin={timeOrigin}
          initialPlayback={previewPlayback}
          startTime={windowRange.start} endTime={Math.min(windowRange.end, duration || Infinity)} autoplay
          onEnded={() => { player.current?.pause(); }} />
        <RangeTimeline start={windowRange.start} end={Math.min(windowRange.end, duration || Infinity)} range={draft}
          current={currentTime} timeOrigin={timeOrigin} disabled={busy || !ready}
          ready={ready} inputValid={inputValid}
          onSeek={position => { cancelPreview(); player.current?.seekTo?.(position); }} />
        <fieldset disabled={busy} className="space-y-4">
          <RangeControls key={controlsRevision} compact value={draft} onChange={edit} onDraftChange={persistDraft} maxTime={duration || undefined} timeOrigin={timeOrigin}
            onInputValidityChange={setInputValid}
            capture={ready ? () => roundTime(player.current?.getCurrentTime?.() ?? currentTime) : undefined}
            preview={ready ? edge => preview(draft, edge) : undefined}
            previewContext={edge => { if (ready) preview(draft, edge, undefined, true); }} />
          <div className="flex flex-wrap gap-2">
            <button className={rangeButton} disabled={!ready || !inputValid || draft.endTime === null || !validRange(draft, duration || undefined)} onClick={playSelection}>편집 구간 재생</button>
            <button className={rangeButton} disabled={!pending.current && !activePreview.current} onClick={cancelPreview}>미리듣기 중지</button>
          </div>
          <p role="status" className="min-h-5 text-sm">{previewStatus || '경계 전후로 듣거나, 남길 구간만 재생해 확인하세요.'}</p>
          <details className="space-y-2 text-sm">
            <summary className="min-h-11 cursor-pointer py-3">탐색 범위 확장</summary>
            <p>현재 재생바 밖의 소리를 더 확인할 때 사용하세요. 저장할 시작·종료 시각은 바뀌지 않습니다.</p>
            <div className="flex flex-wrap gap-2">
              <button className={rangeButton} disabled={windowRange.start <= 0} onClick={() => expand('start')}>앞 30초 더 보기</button>
              <button className={rangeButton} disabled={duration > 0 && windowRange.end >= duration} onClick={() => expand('end')}>뒤 30초 더 보기</button>
            </div>
          </details>
          <div className="flex flex-wrap gap-2">
            <button className={rangeButton} disabled={!history.length} onClick={() => { updateDraft(history[history.length - 1]); setHistory(h => h.slice(0, -1)); }}>한 단계 되돌리기</button>
            <button className={rangeButton} onClick={() => resetEditing(initial.effective)}>편집 초기화</button>
            <button className={rangeButton} disabled={busy} onClick={reload}>최신 구간 불러오기 · 편집 초기화</button>
          </div>
        </fieldset>
        <p className="text-sm">편집 전 대비: {describeRangeChanges(draft, baseline)}</p>
        {!inputValid && <p role="alert" className="text-sm">시간 입력을 확인해주세요. 초 또는 분:초 형식으로 입력할 수 있습니다.</p>}
        {draft.endTime !== null && draft.startTime >= draft.endTime && <p role="alert" className="text-sm text-red-600 dark:text-red-300">종료 시각은 시작 시각보다 뒤여야 합니다. 시작을 바꿔도 종료 시각은 자동으로 이동하지 않습니다.</p>}
        <p role="status" className="text-xs">{localAvailable
          ? `${restored ? '이전 편집 복원 · ' : ''}이 브라우저에 자동 임시 저장 · 초기화하면 삭제됩니다.`
          : '자동 임시 저장 실패: 브라우저 저장 공간을 확인해주세요. 닫거나 새로고침하면 편집 내용이 사라질 수 있습니다.'}</p>
        {!loggedIn && <p className="text-sm">로그인 전에는 이번 재생에만 적용됩니다. 저장·공유하려면 로그인해주세요.</p>}
        {loggedIn && !data.isVerified && <p className="text-sm">저장하면 개선안도 함께 공유됩니다. 개인 저장만 하려면 ‘저장 옵션’을 열어주세요.</p>}
        {message && <p role="alert" className="break-keep text-sm text-red-600 dark:text-red-300">{message}</p>}
        {shareFailure && <div className="space-y-2 rounded-lg border border-current/20 p-3">
          <p role="status" className="text-sm">{shareFailure.personalSaved ? '내 구간 저장 완료. 개선안 공유만 다시 시도할 수 있습니다.' : '편집 내용은 유지됩니다. 개선안 공유를 다시 시도해주세요.'}</p>
          <button className={rangeButton} disabled={busy} onClick={retryShare}>{savePhase === 'sharing' ? '공유 중…' : '공유 다시 시도'}</button>
        </div>}
        <div className="flex flex-wrap gap-2">
          <button className={`${rangeButton} font-semibold ring-2 ring-purple-500`} disabled={busy || !inputValid || draft.endTime === null || !validRange(draft, duration || undefined)} onClick={() => save(draft, !data.isVerified)}>
            {savePhase === 'saving' ? '저장 중…' : savePhase === 'sharing' ? '공유 중…' : !loggedIn ? '이번 재생에 적용' : data.isVerified ? '나에게 저장' : sameRange(draft, data.official) ? '저장' : '저장하고 공유'}
          </button>
          {data.personal && <button className={rangeButton} disabled={busy} onClick={resetPersonal}>개인 설정 삭제 · 기본 구간 사용</button>}
        </div>
        {loggedIn && !data.isVerified && <details className="text-sm">
          <summary className="flex min-h-11 cursor-pointer items-center underline underline-offset-4">저장 옵션</summary>
          <div className="space-y-2 py-2">
            <p>개선안으로 공유하지 않고 내 재생에만 적용합니다. 이미 공유한 제안이 있다면 별도로 철회할 수 있습니다.</p>
            <button className={rangeButton} disabled={busy || !inputValid || draft.endTime === null || !validRange(draft, duration || undefined)} onClick={() => save(draft, false)}>공유 없이 나에게만 저장</button>
          </div>
        </details>}
        <details className="space-y-2 text-sm">
          <summary className="min-h-11 cursor-pointer py-3">공식 구간과 비교</summary>
          <p>공식 구간 {formatRelativeClipTime(data.official.startTime, timeOrigin)} ~ {data.official.endTime === null ? '미설정' : formatRelativeClipTime(data.official.endTime, timeOrigin)}</p>
          <p>공식 구간 대비: {describeRangeChanges(draft, data.official)}</p>
          <div className="flex flex-wrap gap-2">
            <button className={rangeButton} disabled={busy || !ready} onClick={() => preview(data.official, 'start')}>공식 시작 듣기</button>
            <button className={rangeButton} disabled={busy || !ready || data.official.endTime === null} onClick={() => preview(data.official, 'end')}>공식 끝 듣기</button>
          </div>
        </details>
        <details className="space-y-2 text-sm">
          <summary className="min-h-11 cursor-pointer py-3">조정 방법 · 클립 생성 규칙</summary>
          {!data.isVerified && <p>클립은 기본적으로 곡 시작점부터 다음 곡 시작점까지 만들어집니다. 아직 검증되지 않은 클립은 끝부분에 대화나 무음 등 불필요한 구간이 많이 남아 있을 수 있어요. 마지막 여운은 살리고, 불필요한 끝부분은 구간 조정으로 정리해주세요.</p>}
          <p>전주부터 마지막 여운까지 포함하고, 앞뒤 대화·무음은 제외해주세요. 시작을 바꿔도 종료 시각은 이동하지 않습니다.</p>
          <p>편집을 시작한 클립의 시작이 0:00입니다. 그 이전은 음수로 표시하며, 임시 편집을 이어갈 때도 같은 기준점을 사용합니다. 예: 205, 3:25, -0:02.5</p>
          <p>시작 경계는 앞 2초·뒤 5초, 종료 경계는 앞 5초·뒤 2초를 듣습니다. 경계 밖 소리는 확인용이며 저장 구간에는 포함하지 않습니다.</p>
          <p>‘더 보기’는 탐색 범위만 넓힙니다. ‘편집 구간 재생’으로 저장할 구간만 확인할 수 있습니다.</p>
          <p>편집은 이 브라우저에만 임시 보관됩니다. 닫아도 이어서 편집할 수 있으며, 초기화하면 임시 저장도 지워집니다. 저장 버튼을 눌러야 재생에 적용됩니다. 기본 구간과 같은 값은 새 개선안으로 공유하지 않습니다.</p>
        </details>
        {!data.isVerified && <details className="space-y-3 border-t border-purple-200 pt-4 dark:border-purple-800">
          <summary className="min-h-11 cursor-pointer py-3 font-semibold">사용자 개선안 {data.proposals.length}개{data.recommendationId ? ' · 추천 있음' : ''}</summary>
          {!data.proposals.length && <p className="text-sm">아직 공유된 개선안이 없습니다.</p>}
          {data.proposals.map(p => <div key={p.id} className="space-y-2 rounded-xl border border-purple-200 p-3 dark:border-purple-800">
            <p className="text-sm">{data.recommendationId === p.id ? '커뮤니티 추천 · ' : ''}{formatRelativeClipTime(p.startTime, timeOrigin)} ~ {formatRelativeClipTime(p.endTime!, timeOrigin)} · 확인 {p.support}명 · 문제 제기 {p.objections}명</p>
            <button className={rangeButton} disabled={busy} onClick={() => edit(p)}>이 구간을 편집에 가져오기</button>
            {(['start', 'end'] as const).map(edge => <div key={edge} className="flex flex-wrap gap-2">
              <button className={rangeButton} disabled={busy || !ready} onClick={() => preview(p, edge, `${p.id}:${edge}`)}>{edge === 'start' ? '시작' : '끝'} 10초 확인</button>
              {!p.mine && <select aria-label={`${edge === 'start' ? '시작' : '끝'} 구간 평가`} value={p.vote?.[edge] ?? 0}
                disabled={!loggedIn || busy || !heard[`${p.id}:${edge}`]} onChange={e => vote(p, edge, Number(e.target.value))}
                className="min-h-11 rounded-lg border border-purple-200 bg-white px-2 disabled:opacity-40 dark:bg-gray-900">
                <option value={0}>미평가 / 평가 취소</option><option value={1}>잘 맞아요</option><option value={-1}>맞지 않아요</option>
              </select>}
            </div>)}
            {!p.mine && <p className="text-xs">해당 경계 미리 듣기를 마치면 평가할 수 있습니다.</p>}
            {p.mine && <button className={rangeButton} disabled={busy} onClick={async () => { setBusy(true); try { await act({ action: 'withdraw', proposalId: p.id }); } catch(e) { setMessage((e as Error).message); } finally { setBusy(false); } }}>내 제안 철회</button>}
          </div>)}
        </details>}
      </DialogPanel>
    </div>
  </Dialog>
    {pendingSave && <Dialog open onClose={() => setPendingSave(null)} className="relative z-[210]">
      <div className="fixed inset-0 bg-black/60" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 text-gray-900 shadow-xl dark:bg-gray-900 dark:text-gray-100">
          <DialogTitle className="text-lg font-bold">이 구간을 내 설정으로 고정할까요?</DialogTitle>
          <p className="text-sm">이미 듣고 있는 구간과 같습니다. 저장하면 이후 공식·추천 구간이 바뀌어도 이 구간을 유지합니다. 원본 영상이 교체되면 초기화됩니다.</p>
          <p className="text-sm">{pendingSave.share ? '개인 설정으로 저장하고 개선안도 공유합니다. 같은 개선안이 이미 있다면 중복 등록하지 않습니다.' : '개인 설정으로만 저장하며, 새 개선안은 공유하지 않습니다.'}</p>
          <div className="flex flex-wrap gap-2">
            <button className={rangeButton} onClick={() => save(pendingSave.range, pendingSave.share, true)}>{pendingSave.share ? '고정하고 공유' : '내 구간으로 고정'}</button>
            <button className={rangeButton} onClick={() => setPendingSave(null)}>돌아가기</button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>}
  </>;
}
