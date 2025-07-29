'use client';

import { useState, useEffect } from 'react';
import { 
  DocumentDuplicateIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  TrashIcon,
  ServerIcon,
  ClockIcon,
  ChartBarIcon
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

export default function BackupManagementTab() {
  const [backups, setBackups] = useState<BackupDocument[]>([]);
  const [stats, setStats] = useState<CollectionStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);

  useEffect(() => {
    loadBackups();
    loadStats();
  }, []);

  const loadBackups = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/backup');
      if (response.ok) {
        const data = await response.json();
        setBackups(data);
      }
    } catch (error) {
      console.error('백업 목록 로딩 실패:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch('/api/backup/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('통계 로딩 실패:', error);
    }
  };

  const createBackup = async () => {
    if (isCreatingBackup) return;
    
    setIsCreatingBackup(true);
    try {
      const response = await fetch('/api/backup', {
        method: 'POST',
      });

      if (response.ok) {
        const result = await response.json();
        alert(`백업이 생성되었습니다: ${result.filename}`);
        loadBackups();
      } else {
        const error = await response.json();
        alert(`백업 생성 실패: ${error.error}`);
      }
    } catch (error) {
      console.error('백업 생성 실패:', error);
      alert('백업 생성 중 오류가 발생했습니다.');
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const downloadBackup = async (filename: string) => {
    try {
      const response = await fetch(`/api/backup/${filename}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
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
      console.error('백업 다운로드 실패:', error);
      alert('백업 다운로드 중 오류가 발생했습니다.');
    }
  };

  const deleteBackup = async (filename: string) => {
    if (!confirm(`정말로 백업 파일 "${filename}"을 삭제하시겠습니까?`)) return;

    try {
      const response = await fetch(`/api/backup/${filename}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        alert('백업 파일이 삭제되었습니다.');
        loadBackups();
      } else {
        alert('백업 파일 삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('백업 삭제 실패:', error);
      alert('백업 삭제 중 오류가 발생했습니다.');
    }
  };

  const restoreBackup = async (filename: string) => {
    if (!confirm(`정말로 백업 파일 "${filename}"에서 복원하시겠습니까? 현재 데이터가 모두 교체됩니다.`)) return;

    try {
      const response = await fetch(`/api/backup/restore/${filename}`, {
        method: 'POST',
      });

      if (response.ok) {
        alert('백업이 복원되었습니다.');
        loadStats();
      } else {
        const error = await response.json();
        alert(`백업 복원 실패: ${error.error}`);
      }
    } catch (error) {
      console.error('백업 복원 실패:', error);
      alert('백업 복원 중 오류가 발생했습니다.');
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('ko-KR');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm rounded-xl p-6 border border-light-primary/20 dark:border-dark-primary/20">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-light-text dark:text-dark-text">백업 관리</h2>
            <p className="text-light-text/60 dark:text-dark-text/60 mt-1">
              데이터베이스 백업 생성, 다운로드, 복원을 관리합니다.
            </p>
          </div>
          <button
            onClick={createBackup}
            disabled={isCreatingBackup}
            className="flex items-center gap-2 px-4 py-2 bg-light-accent dark:bg-dark-accent text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <DocumentDuplicateIcon className="w-4 h-4" />
            {isCreatingBackup ? '백업 생성 중...' : '새 백업 생성'}
          </button>
        </div>
      </div>

      {/* Database Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm rounded-xl p-6 border border-light-primary/20 dark:border-dark-primary/20">
            <div className="flex items-center gap-3 mb-2">
              <ChartBarIcon className="w-5 h-5 text-light-accent dark:text-dark-accent" />
              <span className="text-sm font-medium text-light-text/70 dark:text-dark-text/70">총 문서 수</span>
            </div>
            <div className="text-2xl font-bold text-light-text dark:text-dark-text">
              {stats.totalDocuments.toLocaleString()}
            </div>
          </div>
          
          <div className="bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm rounded-xl p-6 border border-light-primary/20 dark:border-dark-primary/20">
            <div className="flex items-center gap-3 mb-2">
              <ServerIcon className="w-5 h-5 text-light-accent dark:text-dark-accent" />
              <span className="text-sm font-medium text-light-text/70 dark:text-dark-text/70">컬렉션 수</span>
            </div>
            <div className="text-2xl font-bold text-light-text dark:text-dark-text">
              {stats.totalCollections}
            </div>
          </div>
          
          <div className="bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm rounded-xl p-6 border border-light-primary/20 dark:border-dark-primary/20">
            <div className="flex items-center gap-3 mb-2">
              <DocumentDuplicateIcon className="w-5 h-5 text-light-accent dark:text-dark-accent" />
              <span className="text-sm font-medium text-light-text/70 dark:text-dark-text/70">백업 파일 수</span>
            </div>
            <div className="text-2xl font-bold text-light-text dark:text-dark-text">
              {backups.length}
            </div>
          </div>
        </div>
      )}

      {/* Collection Details */}
      {stats && (
        <div className="bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm rounded-xl border border-light-primary/20 dark:border-dark-primary/20">
          <div className="p-6 border-b border-light-primary/20 dark:border-dark-primary/20">
            <h3 className="text-lg font-semibold text-light-text dark:text-dark-text">컬렉션 상세</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {stats.collections.map((collection) => (
                <div key={collection.name} className="bg-white/20 dark:bg-gray-800/20 rounded-lg p-4">
                  <div className="font-medium text-light-text dark:text-dark-text">{collection.name}</div>
                  <div className="text-sm text-light-text/60 dark:text-dark-text/60">{collection.count.toLocaleString()} 문서</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Backup List */}
      <div className="bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm rounded-xl border border-light-primary/20 dark:border-dark-primary/20">
        <div className="p-6 border-b border-light-primary/20 dark:border-dark-primary/20">
          <h3 className="text-lg font-semibold text-light-text dark:text-dark-text">
            백업 파일 목록 ({backups.length}개)
          </h3>
        </div>
        
        <div className="max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="p-8 text-center text-light-text/60 dark:text-dark-text/60">
              로딩 중...
            </div>
          ) : backups.length === 0 ? (
            <div className="p-8 text-center text-light-text/60 dark:text-dark-text/60">
              백업 파일이 없습니다.
            </div>
          ) : (
            <div className="divide-y divide-light-primary/20 dark:divide-dark-primary/20">
              {backups.map((backup) => (
                <div key={backup.name} className="p-4 hover:bg-white/20 dark:hover:bg-gray-800/20 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-light-text dark:text-dark-text truncate">
                        {backup.name}
                      </h4>
                      <div className="flex items-center gap-2 mt-1 text-sm text-light-text/60 dark:text-dark-text/60">
                        <ClockIcon className="w-4 h-4" />
                        <span>{formatTimestamp(backup.timestamp)}</span>
                      </div>
                      {backup.metadata && (
                        <div className="text-xs text-light-text/40 dark:text-dark-text/40 mt-1">
                          {backup.metadata.totalDocuments.toLocaleString()} 문서, {backup.metadata.totalCollections} 컬렉션
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => downloadBackup(backup.name)}
                        className="p-2 text-light-text/60 dark:text-dark-text/60 hover:text-blue-500 transition-colors"
                        title="다운로드"
                      >
                        <ArrowDownTrayIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => restoreBackup(backup.name)}
                        className="p-2 text-light-text/60 dark:text-dark-text/60 hover:text-green-500 transition-colors"
                        title="복원"
                      >
                        <ArrowUpTrayIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteBackup(backup.name)}
                        className="p-2 text-light-text/60 dark:text-dark-text/60 hover:text-red-500 transition-colors"
                        title="삭제"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-50/50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200/50 dark:border-blue-800/50">
        <div className="text-sm text-blue-700 dark:text-blue-300">
          <strong>백업 참고사항:</strong>
          <ul className="mt-2 space-y-1 list-disc list-inside">
            <li>백업 파일은 MongoDB 데이터베이스의 전체 스냅샷입니다.</li>
            <li>복원 시 현재 데이터가 모두 교체되므로 신중하게 진행하세요.</li>
            <li>백업 파일은 서버의 로컬 저장소에 저장됩니다.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}