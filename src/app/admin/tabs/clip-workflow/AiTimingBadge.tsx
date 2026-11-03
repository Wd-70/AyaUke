import { aiTimingLabel, aiTimingEvidenceLabel } from '@/domains/archive/ai-timing';
import type { WorkflowItem } from './types';
import { fmt } from './itemUtils';

export default function AiTimingBadge({ item, detail = false }: { item: WorkflowItem; detail?: boolean }) {
  const label = aiTimingLabel(item);
  if (!label || !item.aiTiming) return null;
  const ai = item.aiTiming;
  const evidence = aiTimingEvidenceLabel(ai);
  return (
    <span className="inline-block max-w-full rounded border border-current px-1.5 py-0.5 text-xs break-words" title={`${ai.adjustedAt} · ${ai.method} · ${ai.note} · 근거 점수는 정확도 확률이 아닙니다.`}>
      {label}
      {evidence && <> · {evidence}</>}
      {ai.note.startsWith('근거 부족:') && <> · 근거 부족</>}
      {ai.reviewTier === 'duration-supported-provisional' && <> · 길이 기반 후보</>}
      {ai.reviewTier === 'review-only-provisional' && <> · 검토용 후보</>}
      {detail && <span className="block mt-1">{ai.note} · 원래 {fmt(ai.previousStartTimeSeconds)}~{fmt(ai.previousEndTimeSeconds)}</span>}
      {detail && ai.referenceYoutubeId && /^[\w-]{11}$/.test(ai.referenceYoutubeId) && <a className="inline-flex min-h-11 items-center mt-1 underline" href={`https://www.youtube.com/watch?v=${ai.referenceYoutubeId}`} target="_blank" rel="noopener noreferrer">참조 {ai.referenceKind === 'cover' ? '커버' : 'MR'} 보기</a>}
    </span>
  );
}
