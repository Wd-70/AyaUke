"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowDownTrayIcon,
  ArrowTrendingUpIcon,
  HeartIcon,
  CircleStackIcon,
  WrenchScrewdriverIcon,
  ServerStackIcon,
  ArrowUturnLeftIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { useToast } from "@/components/Toast";

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
}

/** 백업 이름(2026-06-11T02-30-45)을 읽기 좋은 날짜로 */
function formatBackupName(name: string): string {
  const m = name.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})$/);
  if (!m) return name;
  const [, y, mo, d, h, mi, s] = m;
  return `${y}.${mo}.${d} ${h}:${mi}:${s}`;
}

/**
 * 데이터 유지보수 탭 (super_admin 전용).
 * - 백업 내보내기: 전체 DB를 JSON 파일로 스트리밍 다운로드 (DB에 저장하지 않음)
 * - 재계산: 비정규화 카운트(likeCount, sungCount)를 실측치로 보정
 * - 컬렉션 현황: 읽기 전용 요약
 */
export default function MaintenanceTab() {
  const { showSuccess, showError } = useToast();
  const [collections, setCollections] = useState<CollectionInfo[]>([]);
  const [collectionsLoading, setCollectionsLoading] = useState(true);
  const [recalcTarget, setRecalcTarget] = useState<string | null>(null);

  // 로컬 백업 관리
  const [isLocal, setIsLocal] = useState(false);
  const [backups, setBackups] = useState<LocalBackup[]>([]);
  const [backupsLoading, setBackupsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyBackup, setBusyBackup] = useState<string | null>(null); // 복원/삭제 중인 백업

  const loadCollections = useCallback(async () => {
    setCollectionsLoading(true);
    try {
      const response = await fetch("/api/admin/maintenance/collections");
      const result = await response.json();
      if (result.success) {
        setCollections(result.data.collections);
      } else {
        showError("로드 실패", result.error?.message || "컬렉션 정보를 불러오지 못했습니다.");
      }
    } catch {
      showError("로드 실패", "컬렉션 정보를 불러오지 못했습니다.");
    } finally {
      setCollectionsLoading(false);
    }
  }, [showError]);

  const loadBackups = useCallback(async () => {
    setBackupsLoading(true);
    try {
      const response = await fetch("/api/admin/maintenance/local-backup");
      const result = await response.json();
      if (result.success) {
        setIsLocal(result.data.isLocal);
        setBackups(result.data.backups);
      }
    } catch {
      // 로컬 백업은 보조 기능이라 조용히 실패 처리
    } finally {
      setBackupsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCollections();
    loadBackups();
  }, [loadCollections, loadBackups]);

  const saveBackup = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const response = await fetch("/api/admin/maintenance/local-backup", { method: "POST" });
      const result = await response.json();
      if (result.success) {
        showSuccess(
          "백업 저장 완료",
          `${result.data.totalDocuments.toLocaleString()}개 문서 (${result.data.totalSizeMB} MB)를 서버에 저장했습니다.`,
        );
        await loadBackups();
      } else {
        showError("백업 실패", result.error?.message || "백업 저장에 실패했습니다.");
      }
    } catch {
      showError("백업 실패", "요청 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const deleteBackup = async (name: string) => {
    if (busyBackup) return;
    if (!confirm(`${formatBackupName(name)} 백업을 삭제하시겠습니까?`)) return;

    setBusyBackup(name);
    try {
      const response = await fetch(`/api/admin/maintenance/local-backup?name=${encodeURIComponent(name)}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (result.success) {
        showSuccess("삭제 완료", "백업을 삭제했습니다.");
        await loadBackups();
      } else {
        showError("삭제 실패", result.error?.message || "백업 삭제에 실패했습니다.");
      }
    } catch {
      showError("삭제 실패", "요청 중 오류가 발생했습니다.");
    } finally {
      setBusyBackup(null);
    }
  };

  const restoreBackup = async (name: string) => {
    if (busyBackup) return;
    // 파괴적 작업: 백업 이름을 직접 입력해야 진행
    const typed = window.prompt(
      `⚠️ 복원하면 현재 DB의 해당 컬렉션들이 이 백업 시점으로 완전히 교체됩니다.\n` +
        `되돌릴 수 없습니다. 진행하려면 아래 백업 이름을 그대로 입력하세요:\n\n${name}`,
    );
    if (typed === null) return;
    if (typed !== name) {
      showError("복원 취소", "입력한 이름이 백업 이름과 일치하지 않습니다.");
      return;
    }

    setBusyBackup(name);
    try {
      const response = await fetch("/api/admin/maintenance/local-backup/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, confirm: typed }),
      });
      const result = await response.json();
      if (result.success) {
        const total = result.data.restored.reduce(
          (sum: number, r: { documents: number }) => sum + r.documents,
          0,
        );
        showSuccess(
          "복원 완료",
          `${result.data.restored.length}개 컬렉션, ${total.toLocaleString()}개 문서를 복원했습니다.`,
        );
        await loadCollections();
      } else {
        showError("복원 실패", result.error?.message || "복원에 실패했습니다.");
      }
    } catch {
      showError("복원 실패", "요청 중 오류가 발생했습니다.");
    } finally {
      setBusyBackup(null);
    }
  };

  const runRecalculate = async (target: "likeCount" | "songStats", label: string) => {
    if (recalcTarget) return;
    if (!confirm(`${label}을(를) 실행하시겠습니까?\n모든 곡의 카운트를 실제 데이터 기준으로 다시 계산합니다.`)) return;

    setRecalcTarget(target);
    try {
      const response = await fetch("/api/admin/maintenance/recalculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target }),
      });
      const result = await response.json();

      if (result.success) {
        const { processedCount, updatedCount, errorCount } = result.data;
        showSuccess(
          `${label} 완료`,
          `처리 ${processedCount}곡, 업데이트 ${updatedCount}곡${errorCount ? `, 오류 ${errorCount}곡` : ""}`,
        );
      } else {
        showError(`${label} 실패`, result.error?.message || "알 수 없는 오류");
      }
    } catch {
      showError(`${label} 실패`, "요청 중 오류가 발생했습니다.");
    } finally {
      setRecalcTarget(null);
    }
  };

  const totalSizeMB = collections.reduce((sum, c) => sum + (c.sizeMB ?? 0), 0);

  const sectionClass =
    "bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm rounded-xl p-6 border border-light-primary/20 dark:border-dark-primary/20";

  return (
    <div className="space-y-8">
      {/* 백업 내보내기 (다운로드) */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={sectionClass}
      >
        <h3 className="text-lg font-semibold text-light-text dark:text-dark-text mb-2 flex items-center gap-2">
          <ArrowDownTrayIcon className="w-5 h-5" />
          백업 다운로드
        </h3>
        <p className="text-sm text-light-text/60 dark:text-dark-text/60 mb-4">
          전체 데이터베이스를 JSON 파일 하나로 내 컴퓨터에 다운로드합니다. (DB에 저장하지 않음)
        </p>
        <a
          href="/api/admin/maintenance/backup-export"
          download
          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-light-accent to-light-purple dark:from-dark-accent dark:to-dark-purple text-white rounded-lg hover:shadow-lg transition-all"
        >
          <ArrowDownTrayIcon className="w-4 h-4" />
          전체 백업 다운로드 (.json)
        </a>
      </motion.div>

      {/* 로컬 서버 백업 관리 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className={sectionClass}
      >
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-light-text dark:text-dark-text flex items-center gap-2">
            <ServerStackIcon className="w-5 h-5" />
            서버 백업 관리
          </h3>
          {isLocal && (
            <button
              onClick={saveBackup}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-light-accent dark:bg-dark-accent text-white rounded-lg hover:shadow-lg disabled:opacity-60 transition-all text-sm"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  저장 중...
                </>
              ) : (
                <>
                  <ServerStackIcon className="w-4 h-4" />
                  지금 백업 저장
                </>
              )}
            </button>
          )}
        </div>

        {backupsLoading ? (
          <div className="flex justify-center p-8">
            <div className="w-6 h-6 border-2 border-light-accent/30 dark:border-dark-accent/30 border-t-light-accent dark:border-t-dark-accent rounded-full animate-spin" />
          </div>
        ) : !isLocal ? (
          <p className="text-sm text-light-text/60 dark:text-dark-text/60">
            서버 디스크 백업은 <span className="font-medium">로컬 서버</span>로 실행했을 때만 사용할 수 있습니다.
            (배포 환경에서는 위의 다운로드 기능을 이용하세요.) 저장 위치:{" "}
            <code className="px-1 py-0.5 bg-light-primary/10 dark:bg-dark-primary/10 rounded text-xs">
              프로젝트/backups/
            </code>
          </p>
        ) : backups.length === 0 ? (
          <p className="text-sm text-light-text/60 dark:text-dark-text/60">
            저장된 백업이 없습니다. &lsquo;지금 백업 저장&rsquo;을 눌러 현재 DB를 서버에 백업하세요.
            (저장 위치: <code className="px-1 py-0.5 bg-light-primary/10 dark:bg-dark-primary/10 rounded text-xs">프로젝트/backups/</code>)
          </p>
        ) : (
          <div className="space-y-2">
            {backups.map((b) => (
              <div
                key={b.name}
                className="flex items-center justify-between gap-4 p-3 rounded-lg border border-light-primary/15 dark:border-dark-primary/15 bg-white/40 dark:bg-gray-900/40"
              >
                <div className="min-w-0">
                  <div className="font-medium text-light-text dark:text-dark-text">
                    {formatBackupName(b.name)}
                  </div>
                  <div className="text-xs text-light-text/60 dark:text-dark-text/60">
                    {b.totalDocuments.toLocaleString()}개 문서 · {b.collections.length}개 컬렉션 ·{" "}
                    {b.totalSizeMB} MB
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => restoreBackup(b.name)}
                    disabled={busyBackup !== null}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 disabled:opacity-50 transition-colors"
                    title="이 백업 시점으로 DB를 복원합니다 (현재 데이터를 덮어씀)"
                  >
                    {busyBackup === b.name ? (
                      <div className="w-4 h-4 border-2 border-amber-400/40 border-t-amber-500 rounded-full animate-spin" />
                    ) : (
                      <ArrowUturnLeftIcon className="w-4 h-4" />
                    )}
                    복원
                  </button>
                  <button
                    onClick={() => deleteBackup(b.name)}
                    disabled={busyBackup !== null}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors"
                    title="이 백업을 디스크에서 삭제합니다"
                  >
                    <TrashIcon className="w-4 h-4" />
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* 재계산 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className={sectionClass}
      >
        <h3 className="text-lg font-semibold text-light-text dark:text-dark-text mb-2 flex items-center gap-2">
          <WrenchScrewdriverIcon className="w-5 h-5" />
          데이터 재계산
        </h3>
        <p className="text-sm text-light-text/60 dark:text-dark-text/60 mb-4">
          성능을 위해 비정규화된 카운트를 실제 데이터 기준으로 다시 계산합니다. 수치가 어긋나
          보일 때 실행하세요.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => runRecalculate("songStats", "곡 통계 재계산")}
            disabled={recalcTarget !== null}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white rounded-lg flex items-center gap-2 transition-colors"
          >
            {recalcTarget === "songStats" ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                처리 중...
              </>
            ) : (
              <>
                <ArrowTrendingUpIcon className="w-4 h-4" />
                곡 통계 재계산 (부른 횟수/최근 날짜)
              </>
            )}
          </button>

          <button
            onClick={() => runRecalculate("likeCount", "좋아요 카운트 재계산")}
            disabled={recalcTarget !== null}
            className="px-4 py-2 bg-red-500 hover:bg-red-600 disabled:bg-red-400 disabled:cursor-not-allowed text-white rounded-lg flex items-center gap-2 transition-colors"
          >
            {recalcTarget === "likeCount" ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                처리 중...
              </>
            ) : (
              <>
                <HeartIcon className="w-4 h-4" />
                좋아요 카운트 재계산
              </>
            )}
          </button>
        </div>
      </motion.div>

      {/* 컬렉션 현황 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className={sectionClass}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-light-text dark:text-dark-text flex items-center gap-2">
            <CircleStackIcon className="w-5 h-5" />
            컬렉션 현황
            {!collectionsLoading && (
              <span className="text-sm font-normal text-light-text/60 dark:text-dark-text/60">
                (총 {totalSizeMB.toFixed(1)} MB)
              </span>
            )}
          </h3>
          <button
            onClick={loadCollections}
            disabled={collectionsLoading}
            className="text-sm px-3 py-1.5 rounded-lg border border-light-primary/20 dark:border-dark-primary/20 hover:border-light-accent/40 dark:hover:border-dark-accent/40 text-light-text/70 dark:text-dark-text/70 transition-colors disabled:opacity-50"
          >
            새로고침
          </button>
        </div>

        {collectionsLoading ? (
          <div className="flex justify-center p-8">
            <div className="w-6 h-6 border-2 border-light-accent/30 dark:border-dark-accent/30 border-t-light-accent dark:border-t-dark-accent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-light-text/60 dark:text-dark-text/60 border-b border-light-primary/20 dark:border-dark-primary/20">
                  <th className="py-2 pr-4 font-medium">컬렉션</th>
                  <th className="py-2 pr-4 font-medium text-right">문서 수</th>
                  <th className="py-2 font-medium text-right">크기 (MB)</th>
                </tr>
              </thead>
              <tbody>
                {collections.map((c) => (
                  <tr
                    key={c.name}
                    className="border-b border-light-primary/10 dark:border-dark-primary/10 text-light-text dark:text-dark-text"
                  >
                    <td className="py-2 pr-4 font-mono">{c.name}</td>
                    <td className="py-2 pr-4 text-right">{c.count.toLocaleString()}</td>
                    <td className="py-2 text-right">{c.sizeMB ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </div>
  );
}
