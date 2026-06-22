'use client';

import { useState } from 'react';
import { ShareIcon, CheckIcon } from '@heroicons/react/24/outline';
import { useToast } from '@/components/Toast';

interface ClipShareButtonProps {
  clipId: string;
  /** 공유 카드 제목(Web Share용) */
  title?: string;
  size?: 'sm' | 'lg';
  className?: string;
}

/** 클립 개별 공유 — Web Share(모바일) 우선, 미지원 시 링크 복사. */
export default function ClipShareButton({
  clipId,
  title,
  size = 'sm',
  className = '',
}: ClipShareButtonProps) {
  const { showSuccess, showError } = useToast();
  const [copied, setCopied] = useState(false);
  const lg = size === 'lg';

  const onShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/clip/${clipId}`;
    const shareTitle = title ? `${title} · 아야 AyaUke 클립` : '아야 AyaUke 클립';

    // Web Share API (주로 모바일)
    if (navigator.share) {
      try {
        await navigator.share({ title: shareTitle, url });
        return;
      } catch {
        // 사용자가 취소했거나 미지원 — 복사로 폴백
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      showSuccess('링크 복사됨', '클립 링크가 클립보드에 복사되었어요.');
    } catch {
      showError('복사 실패', '링크 복사에 실패했어요.');
    }
  };

  return (
    <button
      type="button"
      onClick={onShare}
      aria-label="클립 공유"
      className={`inline-flex items-center gap-1 rounded-full transition-all duration-200 ${
        lg
          ? 'border border-light-primary/30 bg-white/60 px-4 py-2 text-base font-semibold hover:-translate-y-0.5 hover:border-light-accent/50 dark:border-dark-primary/30 dark:bg-gray-800/60 dark:hover:border-dark-accent/50'
          : 'px-1.5 py-0.5 text-xs'
      } text-light-text/55 hover:text-light-accent dark:text-dark-text/55 dark:hover:text-dark-accent ${className}`}
    >
      {copied ? (
        <CheckIcon className={lg ? 'h-5 w-5' : 'h-4 w-4'} />
      ) : (
        <ShareIcon className={lg ? 'h-5 w-5' : 'h-4 w-4'} />
      )}
      {lg && <span>{copied ? '복사됨' : '공유'}</span>}
    </button>
  );
}
