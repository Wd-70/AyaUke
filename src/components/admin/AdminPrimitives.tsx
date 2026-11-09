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
export function AdminSection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
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
