"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowDownTrayIcon,
  ArrowTrendingUpIcon,
  HeartIcon,
  CircleStackIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import { useToast } from "@/components/Toast";

interface CollectionInfo {
  name: string;
  count: number;
  sizeMB: number | null;
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

  useEffect(() => {
    loadCollections();
  }, [loadCollections]);

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
      {/* 백업 내보내기 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={sectionClass}
      >
        <h3 className="text-lg font-semibold text-light-text dark:text-dark-text mb-2 flex items-center gap-2">
          <ArrowDownTrayIcon className="w-5 h-5" />
          백업 내보내기
        </h3>
        <p className="text-sm text-light-text/60 dark:text-dark-text/60 mb-4">
          전체 데이터베이스를 JSON 파일로 다운로드합니다. 백업은 DB에 저장되지 않고 파일로만
          내보내집니다.
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
