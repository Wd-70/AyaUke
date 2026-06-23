'use client';

import {
  PlayIcon,
  PencilIcon,
  TrashIcon,
  CheckBadgeIcon,
  ExclamationTriangleIcon,
  MusicalNoteIcon,
} from '@heroicons/react/24/outline';
import type { SongVideo } from '@/types';
import { formatPreciseTime } from '@/shared/utils/clip-time';
import type { OverlapInfo } from '@/shared/utils/clip-overlap';
import { formatOriginalDateForDisplay } from '@/utils/dateUtils';

type ClipVideo = SongVideo & { originalDateString?: string };

interface ClipRowProps {
  video: ClipVideo;
  isSelected: boolean;
  /** 편집 중인 다른 행 — 클릭 비활성 */
  isDimmed: boolean;
  canEdit: boolean;
  isDeleting: boolean;
  /** 중복 경고 노출 여부(권한자에게만) */
  showOverlap: boolean;
  overlapInfo: OverlapInfo<ClipVideo>;
  overlapExpanded: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleOverlap: () => void;
  /** 항상 보이는 액션(좋아요 등) */
  actions?: React.ReactNode;
  /** 선택된 행에서만 보이는 액션(원본·공유·신고 등) */
  selectedActions?: React.ReactNode;
}

/**
 * 읽기 전용 클립 목록 행 (시청 화면). 선택·재생 표시·(권한자) 편집/삭제·중복 경고.
 * 좋아요처럼 항상 보여야 하는 액션은 `actions`, 선택된 행에서만 보여야 하는 액션은 `selectedActions`로 주입한다.
 */
export default function ClipRow({
  video,
  isSelected,
  isDimmed,
  canEdit,
  isDeleting,
  showOverlap,
  overlapInfo,
  overlapExpanded,
  onSelect,
  onEdit,
  onDelete,
  onToggleOverlap,
  actions,
  selectedActions,
}: ClipRowProps) {
  const hasOverlap = showOverlap && overlapInfo.hasOverlap;
  const hasAlwaysVisibleActions = Boolean(actions);
  const showSelectedActions = isSelected && (selectedActions || (canEdit && !isDimmed));

  const borderTone = hasOverlap
    ? isSelected
      ? 'border-amber-400 dark:border-amber-500 bg-amber-50 dark:bg-amber-900/20 shadow-amber-100 dark:shadow-amber-900/20 shadow-md'
      : isDimmed
        ? 'border-amber-300 dark:border-amber-600 bg-amber-50/70 dark:bg-amber-900/10'
        : 'border-amber-300 dark:border-amber-600 bg-amber-50/70 dark:bg-amber-900/10 hover:border-amber-400 dark:hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20'
    : isSelected
      ? 'border-light-accent/50 dark:border-dark-accent/50 bg-light-accent/10 dark:bg-dark-accent/10'
      : isDimmed
        ? 'border-light-primary/20 dark:border-dark-primary/20'
        : 'border-light-primary/20 dark:border-dark-primary/20 hover:border-light-accent/30 dark:hover:border-dark-accent/30 hover:bg-light-primary/5 dark:hover:bg-dark-primary/5';

  return (
    <div
      onClick={onSelect}
      className={`relative rounded-lg border p-2 transition-all duration-200 group sm:p-3 ${
        isDimmed ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
      } ${borderTone}`}
    >
      <div className="flex items-center gap-3">
        {/* 썸네일 */}
        <div className="relative aspect-video w-20 shrink-0 overflow-hidden rounded-md bg-light-primary/10 dark:bg-dark-primary/10 sm:w-24">
          {video.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={video.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <MusicalNoteIcon className="h-5 w-5 text-light-accent/40 dark:text-dark-accent/40" />
            </div>
          )}
          {isSelected && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <PlayIcon className="h-5 w-5 text-white" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 truncate text-sm font-medium text-light-text dark:text-dark-text">
            <span className="truncate">
              {formatOriginalDateForDisplay(video.originalDateString, video.sungDate)}
            </span>
            {video.startTime !== undefined && video.endTime !== undefined && video.endTime > video.startTime && (
              <span className="shrink-0 text-light-accent/80 dark:text-dark-accent/80">
                {formatPreciseTime(video.endTime - video.startTime)}
              </span>
            )}
            {video.isVerified && (
              <CheckBadgeIcon className="h-4 w-4 shrink-0 text-emerald-500" title="검증됨" />
            )}
          </div>
          {video.description && (
            <div className="mt-1 line-clamp-2 whitespace-pre-line text-xs text-light-text/60 dark:text-dark-text/60">
              {video.description}
            </div>
          )}
          <div className="mt-1 flex items-center gap-2 text-xs text-light-text/50 dark:text-dark-text/50">
            <span className="truncate">{video.addedByName}</span>
            {hasOverlap && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleOverlap();
                }}
                className="inline-flex shrink-0 items-center gap-0.5 font-medium text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
                title="중복 상세 정보 보기"
              >
                <ExclamationTriangleIcon className="h-3.5 w-3.5" />
                시간 중복 ({overlapInfo.overlappingCount})
              </button>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          {/* 항상 보이는 액션(좋아요) */}
          {actions}

          {/* 선택된 행에서만: 원본·공유·신고 (+ 권한자 수정·삭제) */}
          {showSelectedActions && (
            <>
              {hasAlwaysVisibleActions && (
                <span className="mx-1 h-4 w-px shrink-0 bg-light-primary/25 dark:bg-dark-primary/25" />
              )}
              {selectedActions}
              {canEdit && !isDimmed && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit();
                    }}
                    className="inline-flex items-center px-1.5 py-0.5 text-light-text/45 transition-colors hover:text-blue-500 dark:text-dark-text/45"
                    title="수정"
                    aria-label="클립 수정"
                  >
                    <PencilIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete();
                    }}
                    disabled={isDeleting}
                    className="inline-flex items-center px-1.5 py-0.5 text-light-text/45 transition-colors hover:text-red-500 disabled:opacity-50 dark:text-dark-text/45"
                    title="삭제"
                    aria-label="클립 삭제"
                  >
                    {isDeleting ? (
                      <div className="h-4 w-4 animate-spin rounded-full border border-red-500 border-t-transparent" />
                    ) : (
                      <TrashIcon className="h-4 w-4" />
                    )}
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* 중복 상세 (권한자) */}
      {overlapExpanded && hasOverlap && (
        <div className="-mx-3 mt-3 rounded-b-lg border-t border-amber-200 bg-amber-50/50 px-3 pb-3 pt-3 dark:border-amber-800 dark:bg-amber-950/30">
          <div className="mb-2 text-xs font-medium text-amber-800 dark:text-amber-200">시간 중복 상세 정보</div>
          <div className="space-y-2">
            {overlapInfo.overlappingVideos.map((ov) => {
              const s1 = video.startTime || 0;
              const e1 = video.endTime || '∞';
              const s2 = ov.startTime || 0;
              const e2 = ov.endTime || '∞';
              return (
                <div key={ov._id} className="rounded border border-amber-200 bg-amber-100 p-2 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                  <div className="mb-1 font-medium">
                    {formatOriginalDateForDisplay(ov.originalDateString, ov.sungDate)} ({ov.addedByName})
                  </div>
                  <div className="space-y-1 text-amber-600 dark:text-amber-400">
                    <div>현재 클립: {formatPreciseTime(s1)} ~ {typeof e1 === 'number' ? formatPreciseTime(e1) : e1}</div>
                    <div>중복 클립: {formatPreciseTime(s2)} ~ {typeof e2 === 'number' ? formatPreciseTime(e2) : e2}</div>
                  </div>
                  {ov.description && (
                    <div className="mt-1 whitespace-pre-line italic text-amber-600 dark:text-amber-400">&quot;{ov.description}&quot;</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
