'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import {
  XMarkIcon,
  CalendarDaysIcon,
  UserIcon,
  PlayIcon,
  CheckBadgeIcon,
  ArrowTopRightOnSquareIcon,
  ArrowsPointingOutIcon,
  PencilSquareIcon,
  CheckIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline';
import ClipPlayer from './ClipPlayer';
import ClipLikeButton from './ClipLikeButton';
import ClipShareButton from './ClipShareButton';
import AddClipToPlaylistButton from './AddClipToPlaylistButton';
import { buildSourceUrl } from '@/shared/utils/video-url';
import { useClipMemo } from '@/hooks/useClipMemos';
import { useToast } from '@/components/Toast';
import type { PublicClipDTO, PublicClipSummary } from '@/domains/archive/clip.service';

/** 다이얼로그로 열 클립 요약(카드에서 넘어옴). null이면 닫힘. */
export interface ClipDialogTarget extends PublicClipSummary {}

async function fetchClipDetail(id: string): Promise<PublicClipDTO> {
  const res = await fetch(`/api/clips/${id}`);
  if (!res.ok) throw new Error('클립을 불러오지 못했습니다');
  const { data } = await res.json();
  return data.clip as PublicClipDTO;
}

/**
 * 클립 상세 다이얼로그 — 라이브 클립 탭에서 페이지 이동 없이 빠르게 재생/좋아요/플레이리스트
 * 담기, 그리고 "나만 보는" 개인 메모 작성을 할 수 있다. 전체 공유 페이지(/clip/[shareId])는
 * 그대로 유지하고, 여기서 링크로 연결한다.
 */
export default function ClipDetailDialog({
  clip,
  onClose,
}: {
  clip: ClipDialogTarget | null;
  onClose: () => void;
}) {
  const open = !!clip;

  // 배경 스크롤 잠금 (플레이어 전체화면과 동일한 방식 — html·body 둘 다)
  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    const body = document.body;
    const prev = { h: html.style.overflow, b: body.style.overflow, p: body.style.paddingRight };
    const sbw = window.innerWidth - html.clientWidth;
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    if (sbw > 0) body.style.paddingRight = `${sbw}px`;
    return () => {
      html.style.overflow = prev.h;
      body.style.overflow = prev.b;
      body.style.paddingRight = prev.p;
    };
  }, [open]);

  // Esc로 닫기
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {clip && <DialogBody key={clip.id} clip={clip} onClose={onClose} />}
    </AnimatePresence>,
    document.body,
  );
}

function DialogBody({ clip, onClose }: { clip: ClipDialogTarget; onClose: () => void }) {
  const isChzzk = clip.platform === 'chzzk';

  const { data: detail, isError } = useQuery({
    queryKey: ['clipDetail', clip.id],
    queryFn: () => fetchClipDetail(clip.id),
    staleTime: 60_000,
  });

  const sourceUrl = detail ? buildSourceUrl(detail.platform, detail.videoId, detail.startTime) : undefined;

  return (
    <motion.div
      className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      {/* 백드롭 */}
      <div
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* 패널 */}
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={`${clip.title} 상세`}
        className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-light-primary/20 bg-light-background shadow-2xl dark:border-dark-primary/20 dark:bg-dark-background sm:rounded-3xl"
        initial={{ y: 24, scale: 0.98, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        exit={{ y: 24, scale: 0.98, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      >
        {/* 상단 그립/닫기 */}
        <div className="absolute right-3 top-3 z-10">
          <button
            onClick={onClose}
            aria-label="닫기"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/30 text-white/90 backdrop-blur-sm transition-colors hover:bg-black/50"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* 스크롤 본문 */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {/* 플레이어 */}
          <div className="relative aspect-video w-full bg-black">
            {detail ? (
              <ClipPlayer
                platform={detail.platform}
                videoId={detail.videoId}
                startTime={detail.startTime}
                endTime={detail.endTime}
                posterDate={detail.sungDateLabel ?? undefined}
                posterAddedBy={detail.uploaderName}
                posterThumbnail={detail.thumbnailUrl ?? clip.thumbnailUrl ?? undefined}
                posterDescription={detail.description ?? undefined}
                trackPlayClipId={detail.id}
                className="h-full w-full !rounded-none"
              />
            ) : isError ? (
              <div className="flex h-full w-full items-center justify-center text-sm text-white/70">
                클립을 불러오지 못했어요
              </div>
            ) : (
              // 로딩: 썸네일 + 스피너
              <div className="relative h-full w-full">
                {clip.thumbnailUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={clip.thumbnailUrl} alt="" className="h-full w-full object-cover opacity-60" />
                )}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-9 w-9 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                </div>
              </div>
            )}
          </div>

          {/* 정보 */}
          <div className="p-5">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  isChzzk ? 'bg-[#00FFA3]/15 text-[#0bbf7d] dark:text-[#00FFA3]' : 'bg-red-500/15 text-red-500'
                }`}
              >
                {isChzzk ? '치지직' : '유튜브'}
              </span>
              {clip.isVerified && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-500">
                  <CheckBadgeIcon className="h-4 w-4" /> 검증됨
                </span>
              )}
              {clip.sungDateLabel && (
                <span className="inline-flex items-center gap-1 text-xs text-light-text/55 dark:text-dark-text/55">
                  <CalendarDaysIcon className="h-4 w-4" /> {clip.sungDateLabel}
                </span>
              )}
              {detail?.uploaderName && (
                <span className="inline-flex items-center gap-1 text-xs text-light-text/55 dark:text-dark-text/55">
                  <UserIcon className="h-4 w-4" /> {detail.uploaderName}
                </span>
              )}
              {clip.playCount > 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-light-text/55 dark:text-dark-text/55">
                  <PlayIcon className="h-4 w-4" /> {clip.playCount.toLocaleString()}
                </span>
              )}
            </div>

            <h2 className="text-xl font-extrabold leading-tight text-light-text dark:text-dark-text">
              {clip.title}
            </h2>
            <p className="mt-0.5 text-sm text-light-text/60 dark:text-dark-text/60">{clip.artist}</p>

            {detail?.description && (
              <p className="mt-3 whitespace-pre-line rounded-xl bg-light-primary/5 p-3 text-sm leading-relaxed text-light-text/70 dark:bg-dark-primary/5 dark:text-dark-text/70">
                {detail.description}
              </p>
            )}

            {/* 액션 */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <ClipLikeButton clipId={clip.id} initialCount={clip.likeCount} size="lg" />
              <AddClipToPlaylistButton clipId={clip.id} variant="button" />
              <ClipShareButton clipId={clip.id} shareId={clip.shareId} title={clip.title} size="lg" />
              {sourceUrl && (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={isChzzk ? '치지직 원본 다시보기' : 'YouTube 원본'}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-light-primary/20 px-3 py-1.5 text-sm text-light-text/70 transition-colors hover:border-light-accent/40 hover:text-light-accent dark:border-dark-primary/20 dark:text-dark-text/70 dark:hover:text-dark-accent"
                >
                  원본 <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                </a>
              )}
              <Link
                href={`/clip/${clip.shareId || clip.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-light-primary/20 px-3 py-1.5 text-sm text-light-text/70 transition-colors hover:border-light-accent/40 hover:text-light-accent dark:border-dark-primary/20 dark:text-dark-text/70 dark:hover:text-dark-accent"
                title="전체 상세/공유 페이지 열기"
              >
                상세 페이지 <ArrowsPointingOutIcon className="h-4 w-4" />
              </Link>
            </div>

            {/* 개인 메모 */}
            <ClipMemoSection clipId={clip.id} />
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/** "나만 보는" 개인 메모 편집 영역. 비로그인 시 안내. */
function ClipMemoSection({ clipId }: { clipId: string }) {
  const { data: session } = useSession();
  const { showError } = useToast();
  const loggedIn = !!session?.user?.channelId;

  const { text, isLoading, isSaving, save } = useClipMemo(clipId, loggedIn);
  const [draft, setDraft] = useState('');
  const [hydrated, setHydrated] = useState(false);

  // 서버 텍스트가 처음 도착하면 draft 초기화 (이후 사용자가 입력하면 유지)
  useEffect(() => {
    if (!hydrated && !isLoading) {
      setDraft(text);
      setHydrated(true);
    }
  }, [text, isLoading, hydrated]);

  const dirty = hydrated && draft.trim() !== text.trim();

  const onSave = async () => {
    try {
      await save(draft);
    } catch {
      showError('저장 실패', '메모를 저장하지 못했어요.');
    }
  };

  return (
    <div className="mt-5 rounded-2xl border border-light-primary/15 bg-light-primary/5 p-4 dark:border-dark-primary/15 dark:bg-dark-primary/5">
      <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-light-text/80 dark:text-dark-text/80">
        <PencilSquareIcon className="h-4 w-4 text-light-accent dark:text-dark-accent" />
        내 메모
        <span className="inline-flex items-center gap-0.5 text-[11px] font-normal text-light-text/45 dark:text-dark-text/45">
          <LockClosedIcon className="h-3 w-3" /> 나만 볼 수 있어요
        </span>
      </div>

      {!loggedIn ? (
        <p className="py-2 text-sm text-light-text/55 dark:text-dark-text/55">
          로그인하면 이 클립에 나만 보는 메모를 남길 수 있어요.
        </p>
      ) : (
        <>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && dirty) {
                e.preventDefault();
                void onSave();
              }
            }}
            maxLength={1000}
            rows={3}
            placeholder={isLoading ? '불러오는 중…' : '이 클립을 구별할 메모를 남겨보세요 (예: 앵콜 첫 곡, 고음 지림)'}
            disabled={isLoading}
            className="w-full resize-y rounded-xl border border-light-primary/20 bg-white/70 px-3 py-2 text-sm text-light-text placeholder:text-light-text/35 focus:border-light-accent/50 focus:outline-none disabled:opacity-60 dark:border-dark-primary/20 dark:bg-gray-800/60 dark:text-dark-text dark:placeholder:text-dark-text/35"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[11px] text-light-text/40 dark:text-dark-text/40">{draft.length}/1000 · ⌘/Ctrl+Enter로 저장</span>
            <button
              onClick={onSave}
              disabled={!dirty || isSaving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-light-accent to-light-purple px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm transition-all enabled:hover:-translate-y-0.5 disabled:opacity-40 dark:from-dark-accent dark:to-dark-purple"
            >
              {isSaving ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              ) : (
                <CheckIcon className="h-4 w-4" />
              )}
              {dirty ? '저장' : '저장됨'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
