"use client";
import type { ReactNode } from "react";
import {
  adminAgo,
  adminDate,
  type RecentAdminRecord,
} from "@/domains/operations/admin-overview";
export const adminPanel =
  "rounded-2xl border border-light-primary/20 bg-white/80 shadow-sm dark:border-dark-primary/20 dark:bg-gray-900/70";
export const adminControl =
  "min-h-11 rounded-xl border border-light-primary/25 bg-white px-3 text-sm text-light-text outline-none focus-visible:ring-2 focus-visible:ring-purple-500 disabled:opacity-50 dark:border-dark-primary/25 dark:bg-gray-900 dark:text-dark-text";
export const adminMuted = "text-sm text-light-text/70 dark:text-dark-text/70";
/** 보조 버튼(아이콘+글자) */
export const adminButton = `${adminControl} inline-flex items-center justify-center gap-2 font-medium transition-colors hover:bg-light-primary/10 dark:hover:bg-dark-primary/15`;
/** 주요 버튼 */
export const adminPrimaryButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-purple-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-purple-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 disabled:opacity-40 dark:bg-purple-500 dark:hover:bg-purple-400";
/** 위험한 작업 버튼(지우기·복원) */
export const adminDangerButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-4 text-sm font-medium text-rose-700 transition hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 disabled:opacity-40 dark:border-rose-900 dark:bg-gray-900 dark:text-rose-300 dark:hover:bg-rose-950/40";

/** 탭 머리글 — 모든 관리 탭이 같은 모양(작은 영문 위치 표시 · 제목 · 설명 · 오른쪽 동작) */
export function AdminPageHeader({
  eyebrow,
  title,
  count,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  count?: number | null;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-xs font-semibold tracking-[.18em] text-purple-700 dark:text-purple-300">{eyebrow}</p>
        <h2 className="mt-2 flex items-baseline gap-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          {title}
          {count != null && (
            <span className="text-sm font-normal tabular-nums text-light-text/50 dark:text-dark-text/50">{count.toLocaleString()}</span>
          )}
        </h2>
        {description && <p className={`${adminMuted} mt-2`}>{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export type AdminTone = "ok" | "warn" | "error" | "neutral" | "info";
const TONE: Record<AdminTone, string> = {
  ok: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900",
  warn: "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900",
  error: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900",
  info: "bg-purple-50 text-purple-700 ring-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:ring-purple-900",
  neutral: "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
};
/** 상태 배지 */
export function AdminBadge({ tone, children }: { tone: AdminTone; children: ReactNode }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${TONE[tone]}`}>
      {children}
    </span>
  );
}
export function AdminSection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={`${adminPanel} min-w-0 p-5 sm:p-6`}>
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold tracking-tight">{title}</h3>
          {description && <p className={`${adminMuted} mt-1`}>{description}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
export function AdminRecords({
  items,
  empty = "아직 기록이 없습니다.",
}: {
  items: RecentAdminRecord[];
  empty?: string;
}) {
  return items.length ? (
    <ul className="divide-y divide-light-primary/10 dark:divide-dark-primary/10">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
        >
          <div className="min-w-0">
            <p className="break-words text-sm font-medium">
              {item.href ? (
                <a
                  className="inline-flex min-h-11 items-center underline-offset-4 hover:underline focus-visible:underline"
                  href={item.href}
                >
                  {item.title}
                </a>
              ) : (
                item.title
              )}
            </p>
            <p className={`${adminMuted} mt-1 break-words text-xs`}>
              {item.subtitle}
            </p>
          </div>
          <time
            dateTime={item.at || undefined}
            className="shrink-0 text-right text-xs text-light-text/70 dark:text-dark-text/70"
          >
            <span className="block">{adminDate(item.at)}</span>
            <span className="mt-1 block">{adminAgo(item.at)}</span>
          </time>
        </li>
      ))}
    </ul>
  ) : (
    <p
      className={`${adminMuted} rounded-xl bg-light-primary/5 p-5 dark:bg-dark-primary/5`}
    >
      {empty}
    </p>
  );
}
