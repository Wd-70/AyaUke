"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ArrowUpRightIcon,
  ArrowUturnLeftIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  PencilSquareIcon,
  ServerStackIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { isSuperAdmin } from "@/lib/permissions";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";
import Sheet from "@/shared/motion/Sheet";
import {
  AdminBadge,
  AdminPageHeader,
  AdminSection,
  adminButton,
  adminControl,
  adminDangerButton,
  adminMuted,
  adminPrimaryButton,
} from "@/components/admin/AdminPrimitives";
import { adminAgo, adminDate } from "@/domains/operations/admin-overview";
import type { CheckId, CheckResult } from "@/domains/operations/maintenance-checks.service";
import type { MaintenanceLogView } from "@/domains/operations/maintenance-log.service";

interface CollectionInfo {
  name: string;
  count: number;
  sizeMB: number | null;
}
interface LocalBackup {
  name: string;
  createdAt: string;
  totalSizeMB: number;
  totalDocuments: number;
  collections: { collection: string; documents: number; sizeMB: number }[];
  note: string;
}
interface ChecksData {
  checks: CheckResult[];
  logs: MaintenanceLogView[];
  lastBackupAt: string | null;
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) throw new Error(json?.error?.message || "요청을 처리하지 못했습니다.");
  return json.data as T;
}

/** 백업 이름(2026-06-11T02-30-45)을 읽기 좋은 날짜로 */
function formatBackupName(name: string): string {
  const m = name.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})$/);
  if (!m) return name;
  const [, y, mo, d, h, mi, s] = m;
  return `${y}.${mo}.${d} ${h}:${mi}:${s}`;
}

/** 컬렉션 이름 → 무엇이 들어 있는지 */
const COLLECTION_LABEL: Record<string, string> = {
  songdetails: "곡 정보",
  songvideos: "라이브 클립",
  likes: "곡 좋아요",
  cliplikes: "클립 좋아요",
  clipmemos: "클립 개인 메모",
  playlists: "곡 플레이리스트",
  clipplaylists: "클립 플레이리스트",
  users: "사용자",
  clipreports: "클립 신고",
  parsedtimelines: "댓글에서 뽑은 타임라인",
  timelinecomments: "타임라인 원본 댓글",
  youtubecomments: "유튜브 댓글",
  youtubevideos: "유튜브 다시보기",
  youtubechannels: "유튜브 채널",
  chzzkvideos: "치지직 다시보기",
  chzzkcomments: "치지직 댓글",
  sitesettings: "사이트 설정",
  maintenancelogs: "관리 작업 기록",
};

const GROUPS: { id: CheckResult["group"]; title: string; description: string }[] = [
  { id: "counts", title: "숫자 맞추기", description: "빠른 화면을 위해 따로 저장해 둔 숫자가 실제 기록과 어긋난 곳" },
  { id: "orphans", title: "지워진 대상을 가리키는 데이터", description: "곡·클립이 지워졌는데 남아 있는 좋아요·메모·플레이리스트 항목" },
  { id: "content", title: "확인이 필요한 콘텐츠", description: "자동으로 고칠 수 없어 직접 살펴봐야 하는 항목" },
];

/**
 * 데이터 유지보수 (시스템 권한, DB 복원은 최고 관리자).
 * 예전에는 '재계산' 버튼만 있어 무엇을 하는지 알기 어려웠다 → 먼저 점검(읽기 전용)으로 문제 수와
 * 예시를 보여 주고, 항목마다 설명과 함께 바로잡기를 둔다. 작업은 모두 기록에 남는다.
 */
export default function MaintenanceTab({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const { data: session } = useSession();
  const { showSuccess, showError } = useToast();
  const { confirm } = useConfirm();
  const qc = useQueryClient();

  const checks = useQuery({ queryKey: ["admin-maintenance-checks"], queryFn: () => api<ChecksData>("/api/admin/maintenance/checks") });
  const collections = useQuery({
    queryKey: ["admin-maintenance-collections"],
    queryFn: () => api<{ collections: CollectionInfo[] }>("/api/admin/maintenance/collections"),
  });
  const backups = useQuery({
    queryKey: ["admin-maintenance-backups"],
    queryFn: () => api<{ isLocal: boolean; backups: LocalBackup[] }>("/api/admin/maintenance/local-backup"),
  });

  // ── 점검 → 바로잡기 ──
  const [fixing, setFixing] = useState<CheckId | null>(null);
  const runFix = async (c: CheckResult) => {
    if (fixing || !c.fix) return;
    const yes = await confirm({
      title: `${c.title} 바로잡기`,
      message: `${c.count.toLocaleString()}건 — ${c.fix}${c.destructive ? "\n\n지우는 작업이라 되돌릴 수 없어요. 먼저 백업을 받아 두길 권해요." : ""}`,
      confirmText: c.destructive ? "지우기" : "바로잡기",
      type: c.destructive ? "danger" : "warning",
    });
    if (!yes) return;
    setFixing(c.id);
    try {
      const r = await api<{ changed: number; check: CheckResult; logs: MaintenanceLogView[] }>("/api/admin/maintenance/checks", {
        method: "POST",
        body: JSON.stringify({ id: c.id }),
      });
      qc.setQueryData<ChecksData>(["admin-maintenance-checks"], (prev) =>
        prev ? { ...prev, logs: r.logs, checks: prev.checks.map((x) => (x.id === c.id ? r.check : x)) } : prev,
      );
      showSuccess("바로잡았어요", `${c.title}: ${r.changed.toLocaleString()}건`);
    } catch (e) {
      showError("바로잡지 못했어요", (e as Error).message);
    } finally {
      setFixing(null);
    }
  };

  // ── 서버 백업 ──
  const [showAllBackups, setShowAllBackups] = useState(false);
  const [busyBackup, setBusyBackup] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [restoreTarget, setRestoreTarget] = useState<string | null>(null);
  const [restoreTyped, setRestoreTyped] = useState("");

  const refreshAfterBackup = () => {
    void backups.refetch();
    void checks.refetch();
  };
  const save = useMutation({
    mutationFn: () => api<{ totalDocuments: number; totalSizeMB: number }>("/api/admin/maintenance/local-backup", { method: "POST" }),
    onSuccess: (d) => {
      showSuccess("백업 저장 완료", `${d.totalDocuments.toLocaleString()}개 문서 (${d.totalSizeMB} MB)를 서버에 저장했습니다.`);
      refreshAfterBackup();
    },
    onError: (e) => showError("백업 실패", (e as Error).message),
  });
  const saveNote = useMutation({
    mutationFn: (name: string) => api<{ note: string }>("/api/admin/maintenance/local-backup", { method: "PATCH", body: JSON.stringify({ name, note: noteDraft }) }),
    onSuccess: () => {
      setEditingNote(null);
      void backups.refetch();
    },
    onError: (e) => showError("메모 저장 실패", (e as Error).message),
  });

  const deleteBackup = async (name: string) => {
    if (busyBackup) return;
    const yes = await confirm({
      title: "서버 백업 삭제",
      message: `${formatBackupName(name)} 백업 파일을 지웁니다. 되돌릴 수 없어요.`,
      confirmText: "삭제",
      type: "danger",
    });
    if (!yes) return;
    setBusyBackup(name);
    try {
      await api(`/api/admin/maintenance/local-backup?name=${encodeURIComponent(name)}`, { method: "DELETE" });
      showSuccess("삭제 완료", "백업을 삭제했습니다.");
      refreshAfterBackup();
    } catch (e) {
      showError("삭제 실패", (e as Error).message);
    } finally {
      setBusyBackup(null);
    }
  };

  const restore = async () => {
    const name = restoreTarget;
    if (!name || restoreTyped !== name) return;
    setBusyBackup(name);
    try {
      const r = await api<{ restored: { documents: number }[] }>("/api/admin/maintenance/local-backup/restore", {
        method: "POST",
        body: JSON.stringify({ name, confirm: restoreTyped }),
      });
      const total = r.restored.reduce((sum, x) => sum + x.documents, 0);
      showSuccess("복원 완료", `${r.restored.length}개 컬렉션, ${total.toLocaleString()}개 문서를 복원했습니다.`);
      setRestoreTarget(null);
      void collections.refetch();
      void checks.refetch();
    } catch (e) {
      showError("복원 실패", (e as Error).message);
    } finally {
      setBusyBackup(null);
    }
  };

  const data = checks.data;
  const problems = data?.checks.filter((c) => c.count > 0) ?? [];
  const backupList = backups.data?.backups ?? [];
  const visibleBackups = showAllBackups ? backupList : backupList.slice(0, 3);
  const sortedCollections = [...(collections.data?.collections ?? [])].sort((a, b) => (b.sizeMB ?? 0) - (a.sizeMB ?? 0));
  const totalSizeMB = sortedCollections.reduce((sum, c) => sum + (c.sizeMB ?? 0), 0);
  const superAdmin = isSuperAdmin(session?.user);

  return (
    <div className="space-y-6 text-light-text dark:text-dark-text">
      <AdminPageHeader
        eyebrow="WORKSPACE / MAINTENANCE"
        title="데이터 유지보수"
        description="어긋난 데이터를 찾아 바로잡고, 백업을 관리합니다. 점검은 읽기만 하니 언제 눌러도 안전해요."
        actions={
          <button className={adminButton} disabled={checks.isFetching} onClick={() => void checks.refetch()}>
            <ArrowPathIcon className={`h-4 w-4 ${checks.isFetching ? "animate-spin motion-reduce:animate-none" : ""}`} />
            다시 점검
          </button>
        }
      />

      {/* 요약 */}
      {data && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className={`rounded-2xl border p-4 ${problems.length ? "border-amber-200 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/30" : "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/30"}`}>
            <p className="flex items-center gap-2 font-semibold">
              {problems.length ? <ExclamationTriangleIcon className="h-5 w-5 text-amber-600" /> : <CheckCircleIcon className="h-5 w-5 text-emerald-600" />}
              {problems.length ? `${problems.length}개 항목에 손볼 데이터가 있어요` : "모든 점검 항목이 정상이에요"}
            </p>
            <p className={`${adminMuted} mt-1 text-xs`}>{data.checks.length}개 항목 점검</p>
          </div>
          <div className={`rounded-2xl border p-4 ${data.lastBackupAt ? "border-light-primary/20 dark:border-dark-primary/20" : "border-amber-200 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/30"}`}>
            <p className="font-semibold">{data.lastBackupAt ? `마지막 백업 ${adminAgo(data.lastBackupAt)}` : "백업 기록이 없어요"}</p>
            <p className={`${adminMuted} mt-1 text-xs`}>
              {data.lastBackupAt ? adminDate(data.lastBackupAt) : "지우는 작업 전에는 아래에서 백업을 받아 두세요."}
            </p>
          </div>
        </div>
      )}

      {/* 데이터 점검 */}
      <AdminSection title="데이터 점검" description="항목마다 무엇이 문제인지, 바로잡으면 무엇이 바뀌는지 적어 두었어요.">
        {checks.isError ? (
          <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{(checks.error as Error).message}</p>
        ) : !data ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-light-primary/10 dark:bg-dark-primary/10" />
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {GROUPS.map((g) => {
              const items = data.checks.filter((c) => c.group === g.id);
              if (!items.length) return null;
              return (
                <div key={g.id}>
                  <h4 className="text-sm font-semibold">{g.title}</h4>
                  <p className={`${adminMuted} text-xs`}>{g.description}</p>
                  <ul className="mt-3 divide-y divide-light-primary/10 rounded-xl border border-light-primary/15 dark:divide-dark-primary/10 dark:border-dark-primary/15">
                    {items.map((c) => (
                      <li key={c.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{c.title}</span>
                            {c.count > 0 ? (
                              <AdminBadge tone={c.group === "content" ? "info" : "warn"}>{c.count.toLocaleString()}건</AdminBadge>
                            ) : (
                              <AdminBadge tone="ok">
                                <CheckCircleIcon className="h-3.5 w-3.5" />
                                정상
                              </AdminBadge>
                            )}
                          </div>
                          <p className={`${adminMuted} mt-1 text-xs leading-relaxed`}>{c.explain}</p>
                          {c.count > 0 && c.samples.length > 0 && (
                            <p className="mt-1.5 text-xs text-light-text/80 dark:text-dark-text/80">예: {c.samples.join(" · ")}</p>
                          )}
                          {c.count > 0 && c.fix && <p className={`${adminMuted} mt-1.5 text-xs`}>바로잡으면: {c.fix}</p>}
                        </div>
                        {c.count > 0 &&
                          (c.fix ? (
                            <button
                              className={`${c.destructive ? adminDangerButton : adminPrimaryButton} shrink-0`}
                              disabled={fixing !== null}
                              onClick={() => void runFix(c)}
                            >
                              {fixing === c.id && <ArrowPathIcon className="h-4 w-4 animate-spin motion-reduce:animate-none" />}
                              {c.destructive ? "지우기" : "바로잡기"}
                            </button>
                          ) : c.goTo && onNavigate ? (
                            <button className={`${adminButton} shrink-0`} onClick={() => onNavigate(c.goTo!.tab)}>
                              {c.goTo.label}
                              <ArrowUpRightIcon className="h-4 w-4" />
                            </button>
                          ) : null)}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </AdminSection>

      {/* 백업 */}
      <div className="grid gap-6 xl:grid-cols-2">
        <AdminSection
          title="내 컴퓨터로 백업 받기"
          description="전체 데이터베이스를 JSON 파일 하나로 내려받습니다. 서버에는 저장되지 않아요. 지우기·복원처럼 되돌릴 수 없는 작업 전에 받아 두세요."
        >
          <a href="/api/admin/maintenance/backup-export" download className={adminPrimaryButton} onClick={() => window.setTimeout(() => void checks.refetch(), 1500)}>
            <ArrowDownTrayIcon className="h-4 w-4" />
            전체 백업 받기 (.json)
          </a>
        </AdminSection>

        <AdminSection
          title="서버 백업"
          description={
            backups.data?.isLocal
              ? "개발 PC의 프로젝트/backups/ 폴더에 저장합니다. 메모를 달아 두면 나중에 어떤 시점인지 알기 쉬워요."
              : "개발 PC에서 사이트를 실행할 때만 쓸 수 있어요. 배포 서버는 디스크가 보존되지 않아서, 배포 환경에서는 왼쪽 '내 컴퓨터로 받기'를 쓰세요."
          }
          action={
            backups.data?.isLocal ? (
              <button className={adminButton} disabled={save.isPending} onClick={() => save.mutate()}>
                {save.isPending ? <ArrowPathIcon className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <ServerStackIcon className="h-4 w-4" />}
                지금 저장
              </button>
            ) : undefined
          }
        >
          {backups.isLoading ? (
            <div className="h-20 animate-pulse rounded-xl bg-light-primary/10 dark:bg-dark-primary/10" />
          ) : !backups.data?.isLocal ? null : backupList.length === 0 ? (
            <p className={adminMuted}>저장된 서버 백업이 없어요.</p>
          ) : (
            <>
              <ul className="space-y-2">
                {visibleBackups.map((b) => (
                  <li key={b.name} className="rounded-xl border border-light-primary/15 p-3 dark:border-dark-primary/15">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium tabular-nums">{formatBackupName(b.name)}</p>
                        <p className={`${adminMuted} text-xs`}>
                          {b.totalDocuments.toLocaleString()}개 문서 · {b.collections.length}개 컬렉션 · {b.totalSizeMB} MB
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        <button
                          className={`${adminButton} !min-h-9 !px-2.5 text-xs`}
                          disabled={busyBackup !== null || !superAdmin}
                          title={superAdmin ? "이 시점으로 복원" : "최고 관리자만 복원할 수 있어요"}
                          onClick={() => {
                            setRestoreTarget(b.name);
                            setRestoreTyped("");
                          }}
                        >
                          <ArrowUturnLeftIcon className="h-4 w-4" />
                          복원
                        </button>
                        <button
                          className={`${adminDangerButton} !min-h-9 !px-2.5 text-xs`}
                          disabled={busyBackup !== null}
                          onClick={() => void deleteBackup(b.name)}
                          aria-label={`${formatBackupName(b.name)} 백업 삭제`}
                        >
                          {busyBackup === b.name ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <TrashIcon className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    {editingNote === b.name ? (
                      <div className="mt-2 space-y-2">
                        <textarea
                          value={noteDraft}
                          onChange={(e) => setNoteDraft(e.target.value)}
                          maxLength={2000}
                          rows={2}
                          autoFocus
                          placeholder="예: 곡 일괄 정리 직전"
                          className={`${adminControl} w-full py-2`}
                        />
                        <div className="flex justify-end gap-2">
                          <button className={`${adminButton} !min-h-9 text-xs`} onClick={() => setEditingNote(null)} disabled={saveNote.isPending}>
                            취소
                          </button>
                          <button className={`${adminPrimaryButton} !min-h-9 text-xs`} onClick={() => saveNote.mutate(b.name)} disabled={saveNote.isPending}>
                            메모 저장
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        className="mt-2 flex w-full items-start gap-1.5 text-left text-xs text-light-text/60 hover:text-purple-700 dark:text-dark-text/60 dark:hover:text-purple-300"
                        onClick={() => {
                          setEditingNote(b.name);
                          setNoteDraft(b.note || "");
                        }}
                      >
                        <PencilSquareIcon className="mt-px h-3.5 w-3.5 shrink-0" />
                        <span className="whitespace-pre-wrap break-words">{b.note || "메모 추가"}</span>
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {backupList.length > 3 && (
                <button className={`${adminMuted} mt-3 min-h-9 text-xs underline-offset-4 hover:underline`} onClick={() => setShowAllBackups((v) => !v)}>
                  {showAllBackups ? "최근 3개만 보기" : `${backupList.length - 3}개 더 보기`}
                </button>
              )}
            </>
          )}
        </AdminSection>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* 작업 기록 */}
        <AdminSection title="작업 기록" description="바로잡기·백업·복원·설정 변경을 누가 언제 했는지 남겨요.">
          {!data ? (
            <div className="h-24 animate-pulse rounded-xl bg-light-primary/10 dark:bg-dark-primary/10" />
          ) : data.logs.length === 0 ? (
            <p className={`${adminMuted} rounded-xl bg-light-primary/5 p-4 dark:bg-dark-primary/5`}>아직 기록이 없어요.</p>
          ) : (
            <ul className="divide-y divide-light-primary/10 dark:divide-dark-primary/10">
              {data.logs.map((l) => (
                <li key={l.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{l.label}</p>
                    <p className={`${adminMuted} break-words text-xs`}>
                      {l.by}
                      {l.detail && !l.detail.startsWith("{") ? ` · ${l.detail}` : ""}
                    </p>
                  </div>
                  <time dateTime={l.at ?? undefined} className={`${adminMuted} shrink-0 text-right text-xs`}>
                    {adminAgo(l.at)}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </AdminSection>

        {/* 컬렉션 현황 */}
        <AdminSection
          title="저장 공간"
          description={collections.data ? `컬렉션별 문서 수와 크기 · 합계 ${totalSizeMB.toFixed(1)} MB` : "컬렉션별 문서 수와 크기"}
          action={
            <button className={`${adminButton} !min-h-9 text-xs`} disabled={collections.isFetching} onClick={() => void collections.refetch()}>
              <ArrowPathIcon className={`h-4 w-4 ${collections.isFetching ? "animate-spin motion-reduce:animate-none" : ""}`} />
              새로고침
            </button>
          }
        >
          {!collections.data ? (
            <div className="h-40 animate-pulse rounded-xl bg-light-primary/10 dark:bg-dark-primary/10" />
          ) : (
            <div className="-mx-2 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className={`${adminMuted} border-b border-light-primary/15 text-left text-xs dark:border-dark-primary/15`}>
                    <th className="px-2 py-2 font-medium">내용</th>
                    <th className="px-2 py-2 text-right font-medium">문서</th>
                    <th className="px-2 py-2 text-right font-medium">MB</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCollections.map((c) => (
                    <tr key={c.name} className="border-b border-light-primary/10 last:border-0 dark:border-dark-primary/10">
                      <td className="px-2 py-2">
                        <span className="block">{COLLECTION_LABEL[c.name] ?? c.name}</span>
                        {COLLECTION_LABEL[c.name] && <code className={`${adminMuted} text-[11px]`}>{c.name}</code>}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">{c.count.toLocaleString()}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{c.sizeMB ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AdminSection>
      </div>

      {/* 복원 확인 — 이름을 직접 입력해야 진행 */}
      <Sheet
        open={restoreTarget !== null}
        onClose={() => busyBackup === null && setRestoreTarget(null)}
        title="백업으로 복원"
        description="되돌릴 수 없는 작업이에요"
        size="md"
      >
        {restoreTarget && (
          <form
            className="space-y-4 px-5 pb-5 pt-3"
            onSubmit={(e) => {
              e.preventDefault();
              void restore();
            }}
          >
            <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm leading-relaxed text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
              현재 데이터베이스가 <b>{formatBackupName(restoreTarget)}</b> 시점으로 통째로 바뀝니다. 그 뒤에 생긴 곡·클립·좋아요·사용자 권한은 모두 사라져요.
            </p>
            <label className="block text-sm">
              진행하려면 백업 이름을 그대로 입력하세요
              <code className="mt-1 block select-all rounded-lg bg-light-primary/10 px-2.5 py-1.5 text-xs dark:bg-dark-primary/10">{restoreTarget}</code>
              <input
                value={restoreTyped}
                onChange={(e) => setRestoreTyped(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                className={`${adminControl} mt-2 w-full font-mono`}
              />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" className={adminButton} onClick={() => setRestoreTarget(null)} disabled={busyBackup !== null}>
                취소
              </button>
              <button type="submit" className={adminDangerButton} disabled={restoreTyped !== restoreTarget || busyBackup !== null}>
                {busyBackup === restoreTarget && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
                복원
              </button>
            </div>
          </form>
        )}
      </Sheet>
    </div>
  );
}
