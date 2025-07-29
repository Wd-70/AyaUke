'use client';

import { useState, useEffect } from 'react';
import { 
  DocumentDuplicateIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  TrashIcon,
  ServerIcon,
  ClockIcon,
  ChartBarIcon,
  EyeIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

interface BackupMetadata {
  totalDocuments: number;
  totalCollections: number;
  version: string;
}

interface BackupDocument {
  _id?: string;
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
  const [backupName, setBackupName] = useState('');
  const [selectedBackup, setSelectedBackup] = useState<BackupDocument | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    loadBackups();
    loadStats();
  }, []);

  const loadBackups = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/test-db?action=list-backups');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setBackups(data.backups);
        }
      }
    } catch (error) {
      console.error('백업 목록 로딩 실패:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch('/api/test-db?action=list-collections');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setStats({
            database: {
              songCount: data.collections.find((c: any) => c.name === 'songdetails')?.count || 0,
              userCount: data.collections.find((c: any) => c.name === 'users')?.count || 0,
              totalRecords: data.totalDocuments
            },
            backups: {
              count: 0, // 백업 수는 별도 로딩
              totalSize: '0 Bytes',
              totalSizeBytes: 0,
              latestBackup: null
            },
            collections: data.collections || []
          });
        }
      }
    } catch (error) {
      console.error('통계 로딩 실패:', error);
    }
  };

  const createBackup = async () => {
    if (isCreatingBackup) return;
    
    setIsCreatingBackup(true);
    try {
      const response = await fetch('/api/test-db', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'backup',
          backupName: backupName.trim() || undefined
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          alert(`백업이 생성되었습니다: ${result.backup.name}`);
          setBackupName(''); // 입력 필드 초기화
          loadBackups();
          loadStats();
        } else {
          alert(`백업 생성 실패: ${result.error}`);
        }
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

  const downloadBackup = async (backupName: string) => {
    try {
      // MongoDB에서 백업 데이터 조회 후 JSON 파일로 다운로드
      const response = await fetch('/api/test-db', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'restore',
          backupName: backupName,
          downloadOnly: true // 복원하지 않고 데이터만 가져오기
        }),
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // JSON으로 다운로드
          const dataStr = JSON.stringify(result, null, 2);
          const dataBlob = new Blob([dataStr], { type: 'application/json' });
          const url = window.URL.createObjectURL(dataBlob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${backupName}.json`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        } else {
          alert(`백업 다운로드 실패: ${result.error}`);
        }
      } else {
        alert('백업 다운로드에 실패했습니다.');
      }
    } catch (error) {
      console.error('백업 다운로드 실패:', error);
      alert('백업 다운로드 중 오류가 발생했습니다.');
    }
  };

  const deleteBackup = async (backupName: string) => {
    if (!confirm(`정말로 백업 "${backupName}"을 삭제하시겠습니까?`)) return;

    try {
      const response = await fetch('/api/test-db', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'delete-backup',
          backupName: backupName
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          alert('백업이 삭제되었습니다.');
          loadBackups();
          loadStats();
        } else {
          alert(`백업 삭제 실패: ${result.error}`);
        }
      } else {
        alert('백업 삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('백업 삭제 실패:', error);
      alert('백업 삭제 중 오류가 발생했습니다.');
    }
  };

  const restoreBackup = async (backupName: string) => {
    if (!confirm(`정말로 백업 "${backupName}"에서 복원하시겠습니까? 현재 데이터가 모두 교체됩니다.`)) return;

    try {
      const response = await fetch('/api/test-db', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'restore',
          backupName: backupName
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          alert(`백업이 복원되었습니다: ${result.message}`);
          loadStats();
        } else {
          alert(`백업 복원 실패: ${result.error}`);
        }
      } else {
        const error = await response.json();
        alert(`백업 복원 실패: ${error.error}`);
      }
    } catch (error) {
      console.error('백업 복원 실패:', error);
      alert('백업 복원 중 오류가 발생했습니다.');
    }
  };

  const formatTimestamp = (timestamp: string | Date) => {
    if (!timestamp) return '알 수 없음';
    try {
      return new Date(timestamp).toLocaleString('ko-KR');
    } catch (error) {
      return '알 수 없음';
    }
  };

  const openBackupDetail = (backup: BackupDocument) => {
    setSelectedBackup(backup);
    setShowDetailModal(true);
  };

  const closeBackupDetail = () => {
    setSelectedBackup(null);
    setShowDetailModal(false);
  };

  const uploadBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const fileContent = await file.text();
      const response = await fetch('/api/test-db', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'upload',
          backupData: fileContent
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          alert(`백업이 업로드되었습니다: ${result.backup.name}`);
          loadBackups();
          loadStats();
        } else {
          alert(`백업 업로드 실패: ${result.error}`);
        }
      } else {
        const error = await response.json();
        alert(`백업 업로드 실패: ${error.error}`);
      }
    } catch (error) {
      console.error('백업 업로드 실패:', error);
      alert('백업 업로드 중 오류가 발생했습니다.');
    } finally {
      setIsUploading(false);
      // 파일 input 초기화
      event.target.value = '';
    }
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
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex flex-col">
              <label className="text-xs text-light-text/70 dark:text-dark-text/70 mb-1">
                백업 이름 (선택사항)
              </label>
              <input
                type="text"
                value={backupName}
                onChange={(e) => setBackupName(e.target.value)}
                placeholder="예: 2024년 1월 정기백업"
                className="px-3 py-2 bg-white/50 dark:bg-gray-800/50 border border-light-primary/20 dark:border-dark-primary/20 
                           rounded-lg text-sm text-light-text dark:text-dark-text placeholder-light-text/40 dark:placeholder-dark-text/40
                           focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent focus:border-transparent
                           min-w-[200px]"
                disabled={isCreatingBackup}
              />
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={createBackup}
                disabled={isCreatingBackup}
                className="flex items-center gap-2 px-4 py-2 bg-light-accent dark:bg-dark-accent text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                <DocumentDuplicateIcon className="w-4 h-4" />
                {isCreatingBackup ? '백업 생성 중...' : '새 백업 생성'}
              </button>
              
              <div className="relative">
                <input
                  type="file"
                  accept=".json"
                  onChange={uploadBackup}
                  disabled={isUploading}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                  id="backup-upload-input"
                />
                <button
                  disabled={isUploading}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap w-full"
                >
                  <ArrowUpTrayIcon className="w-4 h-4" />
                  {isUploading ? '업로드 중...' : '백업 업로드'}
                </button>
              </div>
            </div>
          </div>
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
              {(stats?.database?.totalRecords || 0).toLocaleString()}
            </div>
          </div>
          
          <div className="bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm rounded-xl p-6 border border-light-primary/20 dark:border-dark-primary/20">
            <div className="flex items-center gap-3 mb-2">
              <ServerIcon className="w-5 h-5 text-light-accent dark:text-dark-accent" />
              <span className="text-sm font-medium text-light-text/70 dark:text-dark-text/70">컬렉션 수</span>
            </div>
            <div className="text-2xl font-bold text-light-text dark:text-dark-text">
              {(stats?.collections || []).length}
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
              {(stats?.collections || []).map((collection) => (
                <div key={collection.name} className="bg-white/20 dark:bg-gray-800/20 rounded-lg p-4">
                  <div className="font-medium text-light-text dark:text-dark-text">{collection.name}</div>
                  <div className="text-sm text-light-text/60 dark:text-dark-text/60">{(collection.count || 0).toLocaleString()} 문서</div>
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
                    <div 
                      className="flex-1 min-w-0 cursor-pointer" 
                      onClick={() => openBackupDetail(backup)}
                    >
                      <h4 className="font-medium text-light-text dark:text-dark-text truncate hover:text-light-accent dark:hover:text-dark-accent transition-colors">
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
                        onClick={(e) => {
                          e.stopPropagation();
                          openBackupDetail(backup);
                        }}
                        className="p-2 text-light-text/60 dark:text-dark-text/60 hover:text-light-accent dark:hover:text-dark-accent transition-colors"
                        title="상세정보"
                      >
                        <EyeIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadBackup(backup.name);
                        }}
                        className="p-2 text-light-text/60 dark:text-dark-text/60 hover:text-blue-500 transition-colors"
                        title="다운로드"
                      >
                        <ArrowDownTrayIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          restoreBackup(backup.name);
                        }}
                        className="p-2 text-light-text/60 dark:text-dark-text/60 hover:text-green-500 transition-colors"
                        title="복원"
                      >
                        <ArrowUpTrayIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteBackup(backup.name);
                        }}
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
            <li>업로드한 백업은 MongoDB의 고유 _id로 중복을 방지하며, 이름이 중복될 경우 자동으로 "_업로드_번호"가 추가됩니다.</li>
            <li>JSON 형식의 백업 파일만 업로드 가능합니다.</li>
          </ul>
        </div>
      </div>

      {/* Backup Detail Modal */}
      {showDetailModal && selectedBackup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-xl font-semibold text-light-text dark:text-dark-text">
                백업 상세정보
              </h3>
              <button
                onClick={closeBackupDetail}
                className="p-2 text-light-text/60 dark:text-dark-text/60 hover:text-light-text dark:hover:text-dark-text transition-colors"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-140px)]">
              <div className="space-y-6">
                {/* Basic Info */}
                <div>
                  <h4 className="text-lg font-medium text-light-text dark:text-dark-text mb-3">기본 정보</h4>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-2">
                    {selectedBackup._id && (
                      <div className="flex justify-between">
                        <span className="text-light-text/60 dark:text-dark-text/60">백업 ID:</span>
                        <span className="text-light-text dark:text-dark-text font-mono text-sm">{selectedBackup._id}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-light-text/60 dark:text-dark-text/60">백업 이름:</span>
                      <span className="text-light-text dark:text-dark-text font-medium">{selectedBackup.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-light-text/60 dark:text-dark-text/60">생성 시간:</span>
                      <span className="text-light-text dark:text-dark-text">{formatTimestamp(selectedBackup.timestamp)}</span>
                    </div>
                    {selectedBackup.metadata && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-light-text/60 dark:text-dark-text/60">총 문서 수:</span>
                          <span className="text-light-text dark:text-dark-text">{selectedBackup.metadata.totalDocuments.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-light-text/60 dark:text-dark-text/60">총 컬렉션 수:</span>
                          <span className="text-light-text dark:text-dark-text">{selectedBackup.metadata.totalCollections}</span>
                        </div>
                        {selectedBackup.metadata.totalChunks && (
                          <div className="flex justify-between">
                            <span className="text-light-text/60 dark:text-dark-text/60">청크 수:</span>
                            <span className="text-light-text dark:text-dark-text">{selectedBackup.metadata.totalChunks}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-light-text/60 dark:text-dark-text/60">백업 버전:</span>
                          <span className="text-light-text dark:text-dark-text">{selectedBackup.metadata.version || '1.0'}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Collection Details */}
                {selectedBackup.collections && Object.keys(selectedBackup.collections).length > 0 && (
                  <div>
                    <h4 className="text-lg font-medium text-light-text dark:text-dark-text mb-3">컬렉션 상세</h4>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                      <div className="space-y-2">
                        {Object.entries(selectedBackup.collections).map(([collectionName, documents]) => (
                          <div key={collectionName} className="flex justify-between py-1">
                            <span className="text-light-text/70 dark:text-dark-text/70">{collectionName}</span>
                            <span className="text-light-text dark:text-dark-text font-medium">
                              {Array.isArray(documents) ? documents.length.toLocaleString() : 0} 문서
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => {
                      downloadBackup(selectedBackup.name);
                      closeBackupDetail();
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    <ArrowDownTrayIcon className="w-4 h-4" />
                    다운로드
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`정말로 백업 "${selectedBackup.name}"에서 복원하시겠습니까?`)) {
                        restoreBackup(selectedBackup.name);
                        closeBackupDetail();
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                  >
                    <ArrowUpTrayIcon className="w-4 h-4" />
                    복원
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`정말로 백업 "${selectedBackup.name}"을 삭제하시겠습니까?`)) {
                        deleteBackup(selectedBackup.name);
                        closeBackupDetail();
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                  >
                    <TrashIcon className="w-4 h-4" />
                    삭제
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}