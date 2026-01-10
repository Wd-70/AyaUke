'use client';

import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

interface AccessiblePaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function AccessiblePagination({
  currentPage,
  totalPages,
  onPageChange
}: AccessiblePaginationProps) {
  return (
    <nav
      aria-label="영상 목록 페이지네이션"
      className="p-4 border-t border-light-primary/20 dark:border-dark-primary/20 flex items-center justify-between"
    >
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        aria-label="이전 페이지"
        aria-disabled={currentPage === 1}
        className="p-2 rounded-lg hover:bg-white/30 dark:hover:bg-gray-800/30 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-light-purple dark:focus-visible:outline-dark-accent"
      >
        <ChevronLeftIcon className="w-5 h-5" aria-hidden="true" />
      </button>

      <span
        className="text-sm text-light-text/60 dark:text-dark-text/60"
        aria-live="polite"
        aria-atomic="true"
      >
        페이지 {currentPage} / {totalPages}
      </span>

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        aria-label="다음 페이지"
        aria-disabled={currentPage === totalPages}
        className="p-2 rounded-lg hover:bg-white/30 dark:hover:bg-gray-800/30 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-light-purple dark:focus-visible:outline-dark-accent"
      >
        <ChevronRightIcon className="w-5 h-5" aria-hidden="true" />
      </button>
    </nav>
  );
}
