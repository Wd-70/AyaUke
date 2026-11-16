'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { useOverlayHistory } from './useOverlayHistory';
import { shouldDismissSheet } from '@/components/mobile/sheet-gesture';

/**
 * 공용 시트/다이얼로그 (docs/ux-motion-plan.md S3).
 *
 * - 모바일(<640px): 아래에서 올라오는 바텀시트. 손잡이를 끌어 내려 닫는다.
 * - 데스크톱: 가운데 다이얼로그(살짝 떠오르며 커짐).
 * - Headless UI Dialog: 포커스 가두기·복귀, ESC, 배경 스크롤 잠금, 나머지 화면 inert.
 * - useOverlayHistory: 브라우저/안드로이드 뒤로가기로 닫힌다.
 * 진입 300ms(감속) · 퇴장 150ms(가속) — globals.css 모션 토큰과 같은 곡선.
 */
const WIDTH = { sm: 'sm:max-w-sm', md: 'sm:max-w-md', lg: 'sm:max-w-lg', xl: 'sm:max-w-2xl' } as const;

export default function Sheet({
  open,
  onClose,
  title,
  description,
  size = 'md',
  layer = 'z-[150]',
  children,
  panelClassName = '',
}: {
  open: boolean;
  onClose: () => void;
  /** 머리글 제목(접근성 이름). 생략하면 children 안에 직접 제목을 둔다 */
  title?: ReactNode;
  description?: ReactNode;
  size?: keyof typeof WIDTH;
  /** 쌓임 순서 — 다른 오버레이 위에 띄워야 하면 올린다 */
  layer?: string;
  children: ReactNode;
  panelClassName?: string;
}) {
  useOverlayHistory(open, onClose);

  // 손잡이 끌어내리기
  const panelRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; start: number } | null>(null);
  const [pull, setPull] = useState(0);
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    if (open) setPull(0);
  }, [open]);
  const endDrag = (dismiss: boolean) => {
    drag.current = null;
    setDragging(false);
    if (dismiss) onClose();
    else setPull(0);
  };

  return (
    <Dialog open={open} onClose={onClose} className={`relative ${layer}`}>
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-black/45 backdrop-blur-sm transition-opacity duration-200 data-[closed]:opacity-0 data-[leave]:duration-150 motion-reduce:transition-none"
      />
      <div className="fixed inset-0 flex items-end justify-center sm:items-center sm:p-4">
        <DialogPanel
          ref={panelRef}
          transition
          style={pull ? { translate: `0 ${pull}px`, transitionDuration: dragging ? '0ms' : undefined } : undefined}
          className={`app-detail-sheet relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-light-primary/20 bg-white shadow-2xl dark:border-dark-primary/20 dark:bg-gray-900 sm:rounded-2xl ${WIDTH[size]}
            transition-[translate,transform,opacity] duration-300 ease-[cubic-bezier(0.2,0,0,1)]
            data-[closed]:translate-y-full data-[leave]:duration-150 data-[leave]:ease-[cubic-bezier(0.4,0,1,1)]
            sm:data-[closed]:translate-y-2 sm:data-[closed]:scale-[0.97] sm:data-[closed]:opacity-0
            motion-reduce:transition-none ${panelClassName}`}
        >
          {/* 모바일 손잡이 — 끌어내리면 닫힘 */}
          <div
            aria-hidden
            className="flex h-6 shrink-0 touch-none cursor-grab items-center justify-center active:cursor-grabbing sm:hidden"
            onPointerDown={(e) => {
              if (!e.isPrimary || drag.current) return;
              drag.current = { id: e.pointerId, start: e.clientY };
              e.currentTarget.setPointerCapture(e.pointerId);
              setDragging(true);
            }}
            onPointerMove={(e) => {
              if (drag.current?.id !== e.pointerId) return;
              setPull(Math.max(0, e.clientY - drag.current.start));
            }}
            onPointerUp={(e) => {
              if (drag.current?.id !== e.pointerId) return;
              const d = Math.max(0, e.clientY - drag.current.start);
              endDrag(shouldDismissSheet(d, panelRef.current?.offsetHeight ?? 0));
            }}
            onPointerCancel={() => endDrag(false)}
          >
            <span className="h-1 w-9 rounded-full bg-gray-300 dark:bg-gray-600" />
          </div>
          {title && (
            <div className="shrink-0 px-5 pb-1 pt-1 sm:pt-5">
              <DialogTitle className="text-base font-bold text-light-text dark:text-dark-text">{title}</DialogTitle>
              {description && <p className="mt-1 text-xs text-light-text/55 dark:text-dark-text/55">{description}</p>}
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
