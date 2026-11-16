import type { ReactNode } from 'react';
export const control = 'min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/20 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';
export const secondary = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800';
export const primary = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-purple-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-purple-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 disabled:opacity-40 dark:bg-purple-500 dark:hover:bg-purple-400';
export const muted = 'text-sm text-slate-500 dark:text-slate-400';
export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="block min-w-0 space-y-2"><span className="block text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>{children}{hint && <span className={`block text-xs leading-relaxed ${muted}`}>{hint}</span>}</label>;
}
export function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <div role={error ? 'alert' : 'status'} className={`rounded-xl border px-4 py-3 text-sm leading-relaxed ${error ? 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200' : 'border-purple-100 bg-purple-50 text-purple-900 dark:border-purple-900 dark:bg-purple-950/40 dark:text-purple-200'}`}>{children}</div>;
}
