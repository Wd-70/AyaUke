"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import type { Pagination } from "./clip-types";

/** 공용 페이지네이션 컨트롤 */
export default function PaginationControl({
  pagination,
  onPageChange,
}: {
  pagination: Pagination;
  onPageChange: (page: number) => void;
}) {
  const { page, totalPages, total } = pagination;
  if (totalPages <= 1) return null;

  // 현재 페이지 주변 최대 5개 표시
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  const pages = Array.from({ length: Math.min(5, totalPages) }, (_, i) => start + i);

  const btn =
    "min-w-[2rem] h-8 px-2 rounded-lg text-sm transition-colors flex items-center justify-center " +
    "disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <div className="flex items-center justify-center gap-1.5 py-3">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className={`${btn} border border-light-primary/20 dark:border-dark-primary/20 text-light-text/70 dark:text-dark-text/70 hover:bg-light-primary/10 dark:hover:bg-dark-primary/20`}
      >
        <ChevronLeftIcon className="w-4 h-4" />
      </button>
      {pages.map((p) => (
        <button
          key={p}
          onClick={() => onPageChange(p)}
          className={`${btn} ${
            p === page
              ? "bg-light-accent dark:bg-dark-accent text-white"
              : "border border-light-primary/20 dark:border-dark-primary/20 text-light-text/70 dark:text-dark-text/70 hover:bg-light-primary/10 dark:hover:bg-dark-primary/20"
          }`}
        >
          {p}
        </button>
      ))}
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className={`${btn} border border-light-primary/20 dark:border-dark-primary/20 text-light-text/70 dark:text-dark-text/70 hover:bg-light-primary/10 dark:hover:bg-dark-primary/20`}
      >
        <ChevronRightIcon className="w-4 h-4" />
      </button>
      <span className="ml-2 text-xs text-light-text/50 dark:text-dark-text/50">
        {page}/{totalPages} · 총 {total.toLocaleString()}개
      </span>
    </div>
  );
}
