'use client';

import { useState, useEffect } from 'react';
import { 
  DocumentDuplicateIcon, 
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  ChartBarIcon,
  TrashIcon
} from '@heroicons/react/24/outline';

interface BackupMetadata {
  totalDocuments: number;
  totalCollections: number;
  version: string;
}

interface BackupDocument {
  name: string;
  timestamp: string;
  metadata?: BackupMetadata;
}

interface CollectionStats {
  totalDocuments: number;
  totalCollections: number;
  collections: Array<{
    name: string;
    count: number;
  }>;
}

export default function BackupManagerTab() {
  const [backups, setBackups] = useState<BackupDocument[]>([]);
  const [stats, setStats] = useState<CollectionStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);

  // DB 통계 로드
  const loadStats = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/db-stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('통계 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  // 백업 목록 로드
  const loadBackups = async () => {
    try {
      const response = await fetch('/api/admin/backup');
      if (response.ok) {
        const data = await response.json();
        setBackups(data.backups || []);
      }
    } catch (error) {
      console.error('백업 목록 로드 오류:', error);
    }
  };

  // 백업 생성
  const createBackup = async () => {
    try {
      setIsCreatingBackup(true);
      const response = await fetch('/api/admin/backup', {
        method: 'POST',
      });

      if (response.ok) {
        const result = await response.json();
        alert(`백업이 생성되었습니다: ${result.filename}`);
        loadBackups();
      } else {
        const error = await response.json();
        alert(`백업 실패: ${error.error}`);
      }
    } catch (error) {
      console.error('백업 생성 오류:', error);
      alert('백업 생성 중 오류가 발생했습니다.');
    } finally {
      setIsCreatingBackup(false);
    }
  };

  // 백업 다운로드
  const downloadBackup = async (filename: string) => {
    try {
      const response = await fetch(`/api/admin/backup/${filename}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        alert('백업 다운로드에 실패했습니다.');
      }
    } catch (error) {
      console.error('다운로드 오류:', error);
      alert('다운로드 중 오류가 발생했습니다.');
    }
  };

  // 백업 삭제
  const deleteBackup = async (filename: string) => {
    if (!confirm(`정말로 백업 "${filename}"을 삭제하시겠습니까?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/backup/${filename}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        alert('백업이 삭제되었습니다.');
        loadBackups();
      } else {
        alert('백업 삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('백업 삭제 오류:', error);
      alert('백업 삭제 중 오류가 발생했습니다.');
    }
  };

  useEffect(() => {
    loadStats();
    loadBackups();
  }, []);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <DocumentDuplicateIcon className="w-6 h-6 text-light-accent dark:text-dark-accent" />
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            백업 관리
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            MongoDB 데이터베이스 백업 생성, 다운로드, 복원 및 통계를 관리합니다.
          </p>
        </div>
      </div>

      {/* DB 통계 */}
      <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
        <div className="flex items-center gap-2 mb-3">
          <ChartBarIcon className="w-5 h-5 text-light-accent dark:text-dark-accent" />
          <h3 className="font-medium text-gray-900 dark:text-white">데이터베이스 통계</h3>
        </div>
        
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-light-accent dark:border-dark-accent"></div>
          </div>
        ) : stats ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-gray-800 p-3 rounded">
              <div className="text-2xl font-bold text-light-accent dark:text-dark-accent">
                {stats.totalDocuments.toLocaleString()}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">총 문서</div>
            </div>
            <div className="bg-white dark:bg-gray-800 p-3 rounded">
              <div className="text-2xl font-bold text-light-accent dark:text-dark-accent">
                {stats.totalCollections}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">컬렉션</div>
            </div>
            <div className="bg-white dark:bg-gray-800 p-3 rounded">
              <div className="text-sm text-gray-700 dark:text-gray-300">
                <div className="font-medium mb-1">컬렉션별 문서 수:</div>
                {stats.collections.map((collection, index) => (
                  <div key={index} className="flex justify-between">
                    <span>{collection.name}:</span>
                    <span className="font-mono">{collection.count.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-gray-500 dark:text-gray-400">통계를 불러올 수 없습니다.</div>
        )}
      </div>

      {/* 백업 생성 */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">백업 관리</h3>
        <button
          onClick={createBackup}
          disabled={isCreatingBackup}
          className="px-4 py-2 bg-light-accent dark:bg-dark-accent text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isCreatingBackup ? (
            <>
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              백업 생성 중...
            </>
          ) : (
            <>
              <DocumentDuplicateIcon className="w-4 h-4" />
              새 백업 생성
            </>
          )}
        </button>
      </div>

      {/* 백업 목록 */}
      <div className="space-y-3">
        {backups.length > 0 ? (
          backups.map((backup) => (
            <div
              key={backup.name}
              className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="font-medium text-gray-900 dark:text-white">
                    {backup.name}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    생성일: {new Date(backup.timestamp).toLocaleString('ko-KR')}
                  </div>
                  {backup.metadata && (
                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      {backup.metadata.totalDocuments.toLocaleString()}개 문서, {' '}
                      {backup.metadata.totalCollections}개 컬렉션
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => downloadBackup(backup.name)}
                    className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                    title="백업 다운로드"
                  >
                    <ArrowDownTrayIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteBackup(backup.name)}
                    className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                    title="백업 삭제"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8">
            <DocumentDuplicateIcon className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">백업 파일이 없습니다.</p>
            <p className="text-sm text-gray-400 dark:text-gray-500">새 백업을 생성해보세요.</p>
          </div>
        )}
      </div>

      {/* 사용법 안내 */}
      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
        <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
          💡 사용법 안내
        </h4>
        <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
          <li>• <strong>새 백업 생성:</strong> 현재 데이터베이스 전체를 백업합니다.</li>
          <li>• <strong>백업 다운로드:</strong> 백업 파일을 로컬에 저장할 수 있습니다.</li>
          <li>• <strong>백업 삭제:</strong> 서버에서 백업 파일을 제거합니다.</li>
          <li>• 백업은 JSON 형식으로 저장되며, 필요시 수동으로 복원할 수 있습니다.</li>
        </ul>
      </div>
    </div>
  );
}