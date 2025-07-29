'use client';

import { useState, useEffect } from 'react';
// import { songDetailApi } from '@/lib/songDetailApi';
import { SongDetail } from '@/types';
import { 
  MagnifyingGlassIcon, 
  PlusIcon, 
  PencilIcon, 
  TrashIcon, 
  EyeIcon,
  Cog6ToothIcon,
  MusicalNoteIcon,
  DocumentDuplicateIcon,
  ClockIcon,
  AdjustmentsHorizontalIcon,
  ChatBubbleBottomCenterTextIcon
} from '@heroicons/react/24/outline';
import TimestampParserTab from './tabs/TimestampParserTab';
import TimelineAdjusterTab from './tabs/TimelineAdjusterTab';
import CommentAnalysisTab from './tabs/CommentAnalysisTab';

interface SongWithId extends SongDetail {
  _id: string;
  playlists?: string[];
  isFavorite?: boolean;
}

interface YouTubeSearchResult {
  url: string;
  title: string;
  videoId: string;
  thumbnail?: string;
  channelTitle?: string;
  description?: string;
  publishedAt?: string;
}

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

type TabType = 'songs' | 'backup' | 'timestamp' | 'timeline' | 'comments';

const tabs = [
  {
    id: 'songs' as const,
    name: '노래 관리',
    icon: MusicalNoteIcon,
    description: '노래 데이터 조회, 편집, 삭제'
  },
  {
    id: 'backup' as const,
    name: '백업 관리',
    icon: DocumentDuplicateIcon,
    description: 'DB 백업, 복원, 통계'
  },
  {
    id: 'timestamp' as const,
    name: '타임스탬프 파서',
    icon: ClockIcon,
    description: '댓글 타임스탬프로 라이브 클립 일괄 등록'
  },
  {
    id: 'timeline' as const,
    name: '타임라인 조정',
    icon: AdjustmentsHorizontalIcon,
    description: '치지직-유튜브 시간차 보정 도구'
  },
  {
    id: 'comments' as const,
    name: '댓글 분석',
    icon: ChatBubbleBottomCenterTextIcon,
    description: 'YouTube 댓글 수집 및 타임라인 분석'
  }
];

export default function TestDBClient() {
  // 탭 상태
  const [activeTab, setActiveTab] = useState<TabType>('songs');
  
  const [songs, setSongs] = useState<SongWithId[]>([]);
  const [filteredSongs, setFilteredSongs] = useState<SongWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSong, setSelectedSong] = useState<SongWithId | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'view' | 'edit' | 'create'>('view');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [selectedSongs, setSelectedSongs] = useState<Set<string>>(new Set());
  const [bulkActionMode, setBulkActionMode] = useState<'delete' | 'update' | null>(null);
  const [bulkUpdateData, setBulkUpdateData] = useState({
    language: '',
    keyAdjustment: '',
    isFavorite: '',
    playlists: '',
    artistAlias: '',
    searchTags: '',
    sungCount: '',
    lastSungDate: ''
  });

  // 백업 관리 상태
  const [backups, setBackups] = useState<BackupDocument[]>([]);
  const [backupLoading, setBackupLoading] = useState(false);
  const [showBackupSection, setShowBackupSection] = useState(false);
  const [collectionStats, setCollectionStats] = useState<CollectionStats | null>(null);
  const [backupName, setBackupName] = useState('');

  // MR 링크 자동 추가 상태
  const [bulkMRLoading, setBulkMRLoading] = useState(false);
  const [bulkMRProgress, setBulkMRProgress] = useState({ current: 0, total: 0 });
  const [showBulkMRSection, setShowBulkMRSection] = useState(false);

  // 곡 목록 로드
  const loadSongs = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/songdetails?limit=1000'); // 대량 데이터 로드
      if (response.ok) {
        const data = await response.json();
        setSongs(data.songs || []);
        setFilteredSongs(data.songs || []);
        console.log(`총 ${data.songs?.length || 0}곡을 로드했습니다.`);
      } else {
        console.error('API 응답 오류:', response.status);
      }
    } catch (error) {
      console.error('곡 목록 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSongs();
  }, []);

  // 백업 섹션이 열릴 때 백업 관련 데이터 로드
  useEffect(() => {
    if (showBackupSection) {
      loadBackups();
      loadCollectionStats();
      // 기본 백업명 설정 (백업명이 비어있을 때만)
      if (!backupName.trim()) {
        setBackupName(generateDefaultBackupName());
      }
    }
  }, [showBackupSection, backupName]);

  // 기본 백업명 생성 함수
  const generateDefaultBackupName = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `backup_${year}${month}${day}_${hours}${minutes}`;
  };

  // 백업 목록 로드
  const loadBackups = async () => {
    try {
      const response = await fetch('/api/test-db?action=list-backups');
      if (response.ok) {
        const data = await response.json();
        setBackups(data.backups || []);
      }
    } catch (error) {
      console.error('백업 목록 로드 실패:', error);
    }
  };

  // 컬렉션 현황 로드
  const loadCollectionStats = async () => {
    try {
      const response = await fetch('/api/test-db?action=list-collections');
      if (response.ok) {
        const data = await response.json();
        setCollectionStats(data);
      }
    } catch (error) {
      console.error('컬렉션 현황 로드 실패:', error);
    }
  };

  // 백업 생성
  const createBackup = async () => {
    if (!backupName.trim()) {
      alert('백업명을 입력해주세요.');
      return;
    }

    setBackupLoading(true);
    try {
      const response = await fetch('/api/test-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'backup',
          backupName: backupName.trim()
        })
      });

      const result = await response.json();
      if (result.success) {
        alert('백업이 성공적으로 생성되었습니다.');
        // 새로운 기본 백업명 생성
        setBackupName(generateDefaultBackupName());
        await loadBackups();
        await loadCollectionStats();
      } else {
        alert(`백업 생성 실패: ${result.error}`);
      }
    } catch (error) {
      console.error('백업 생성 오류:', error);
      alert('백업 생성 중 오류가 발생했습니다.');
    } finally {
      setBackupLoading(false);
    }
  };

  // 백업 복원
  const restoreBackup = async (backupName: string) => {
    const confirmMessage = `"${backupName}" 백업으로 복원하시겠습니까?\n\n⚠️ 경고: 현재 모든 데이터가 삭제되고 백업 시점의 데이터로 완전히 대체됩니다.\n이 작업은 되돌릴 수 없습니다.`;
    
    if (!confirm(confirmMessage)) return;

    setBackupLoading(true);
    try {
      const response = await fetch('/api/test-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'restore',
          backupName: backupName
        })
      });

      const result = await response.json();
      if (result.success) {
        alert('백업 복원이 완료되었습니다. 페이지를 새로고침합니다.');
        window.location.reload();
      } else {
        alert(`백업 복원 실패: ${result.error}`);
      }
    } catch (error) {
      console.error('백업 복원 오류:', error);
      alert('백업 복원 중 오류가 발생했습니다.');
    } finally {
      setBackupLoading(false);
    }
  };

  // 백업 삭제
  const deleteBackup = async (backupName: string) => {
    if (!confirm(`"${backupName}" 백업을 삭제하시겠습니까?`)) return;

    try {
      const response = await fetch('/api/test-db', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete-backup',
          backupName: backupName
        })
      });

      const result = await response.json();
      if (result.success) {
        alert('백업이 삭제되었습니다.');
        await loadBackups();
      } else {
        alert(`백업 삭제 실패: ${result.error}`);
      }
    } catch (error) {
      console.error('백업 삭제 오류:', error);
      alert('백업 삭제 중 오류가 발생했습니다.');
    }
  };

  // YouTube에서 MR 링크 검색
  const searchMRFromYouTube = async (title: string, artist: string) => {
    try {
      const response = await fetch('/api/youtube-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, artist })
      });

      const result = await response.json();
      if (result.success) {
        // 키 통계 정보 로깅
        if (result.keyStats) {
          console.log(`🔑 API 키 상태: ${result.keyStats.availableKeys}/${result.keyStats.totalKeys} 사용 가능`);
        }
        return result.selectedResult; // 첫 번째 검색 결과 반환
      } else {
        console.error('YouTube 검색 실패:', result.error);
        
        // 키 통계 정보 표시
        if (result.keyStats) {
          console.log(`🔑 API 키 상태: ${result.keyStats.availableKeys}/${result.keyStats.totalKeys} 사용 가능`);
        }
        
        // 할당량 초과 감지 (모든 키가 초과된 경우)
        if (result.error && (result.error.includes('quota') || result.error.includes('할당량'))) {
          return 'QUOTA_EXCEEDED';
        }
        
        return null;
      }
    } catch (error) {
      console.error('YouTube 검색 오류:', error);
      return null;
    }
  };

  // 개별 곡에 MR 링크 추가
  const addMRLinkToSong = async (song: SongWithId, mrResult: YouTubeSearchResult) => {
    try {
      const newMRLink = {
        url: mrResult.url,
        skipSeconds: 0,
        label: `Auto-added: ${mrResult.title.substring(0, 30)}...`,
        duration: ''
      };

      const response = await fetch(`/api/songdetails/${song._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mrLinks: [...(song.mrLinks || []), newMRLink]
        })
      });

      return response.ok;
    } catch (error) {
      console.error('MR 링크 추가 오류:', error);
      return false;
    }
  };

  // 전체 곡에 MR 링크 일괄 추가
  const bulkAddMRLinks = async () => {
    // MR 링크가 없는 곡들 필터링
    const songsWithoutMR = filteredSongs.filter(song => 
      !song.mrLinks || song.mrLinks.length === 0
    );

    if (songsWithoutMR.length === 0) {
      alert('MR 링크가 없는 곡이 없습니다.');
      return;
    }

    const confirmMessage = `MR 링크가 없는 ${songsWithoutMR.length}곡에 대해 자동으로 YouTube에서 MR 링크를 검색하여 추가하시겠습니까?\n\n⚠️ 주의사항:\n• YouTube API 할당량: 하루 10,000 유닛 (검색 1회 = 100 유닛)\n• 다중 API 키 시스템으로 할당량 초과 시 자동으로 다음 키로 전환됩니다\n• 모든 키의 할당량이 초과되면 작업이 중단됩니다\n• 콘솔에서 실시간 키 상태를 확인할 수 있습니다`;
    
    if (!confirm(confirmMessage)) return;

    setBulkMRLoading(true);
    setBulkMRProgress({ current: 0, total: songsWithoutMR.length });

    let successCount = 0;
    let errorCount = 0;
    let quotaExceeded = false;

    for (let i = 0; i < songsWithoutMR.length; i++) {
      const song = songsWithoutMR[i];
      setBulkMRProgress({ current: i + 1, total: songsWithoutMR.length });

      try {
        const title = song.titleAlias || song.title;
        const artist = song.artistAlias || song.artist;
        
        console.log(`[${i + 1}/${songsWithoutMR.length}] 처리 중: "${title}" by ${artist}`);

        const mrResult = await searchMRFromYouTube(title, artist);
        
        if (mrResult === 'QUOTA_EXCEEDED') {
          quotaExceeded = true;
          console.log('⚠️ YouTube API 할당량 초과');
          break;
        }
        
        if (mrResult) {
          const success = await addMRLinkToSong(song, mrResult);
          if (success) {
            successCount++;
            console.log(`✅ 성공: ${mrResult.url}`);
          } else {
            errorCount++;
            console.log(`❌ 저장 실패`);
          }
        } else {
          errorCount++;
          console.log(`❌ 검색 결과 없음`);
        }

        // API 호출 제한을 위한 딜레이
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error) {
        errorCount++;
        console.error(`처리 중 오류:`, error);
      }
    }

    setBulkMRLoading(false);
    setBulkMRProgress({ current: 0, total: 0 });
    
    let message = `MR 링크 일괄 추가 ${quotaExceeded ? '중단' : '완료'}!\n✅ 성공: ${successCount}곡\n❌ 실패: ${errorCount}곡`;
    
    if (quotaExceeded) {
      message += `\n\n⚠️ 모든 YouTube API 키의 할당량이 초과되어 작업이 중단되었습니다.\n• 할당량은 매일 자정(PST)에 리셋됩니다\n• 추가 API 키를 다른 Google 계정으로 생성하여 환경변수에 추가할 수 있습니다\n• 성공한 ${successCount}곡의 MR 링크는 저장되었습니다\n• 콘솔에서 상세한 키 상태를 확인하세요`;
    }
    
    alert(message);
    
    // 데이터 새로고침
    await loadSongs();
  };

  // 검색 필터링
  useEffect(() => {
    const filtered = songs.filter(song => 
      song.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      song.artist.toLowerCase().includes(searchTerm.toLowerCase()) ||
      song.titleAlias?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      song.artistAlias?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredSongs(filtered);
    setCurrentPage(1);
  }, [searchTerm, songs]);

  // 페이지네이션
  const totalPages = Math.ceil(filteredSongs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentSongs = filteredSongs.slice(startIndex, startIndex + itemsPerPage);

  // 모달 열기
  const openModal = (mode: 'view' | 'edit' | 'create', song?: SongWithId) => {
    setModalMode(mode);
    setSelectedSong(song || null);
    setIsModalOpen(true);
  };

  // 곡 삭제
  const deleteSong = async (songId: string) => {
    if (!confirm('정말로 이 곡을 삭제하시겠습니까?')) return;
    
    try {
      const response = await fetch(`/api/songdetails/${songId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        await loadSongs();
        alert('곡이 삭제되었습니다.');
      } else {
        const error = await response.json();
        alert(`삭제 실패: ${error.error}`);
      }
    } catch (error) {
      console.error('삭제 실패:', error);
      alert('삭제에 실패했습니다.');
    }
  };

  // 체크박스 관련 함수들
  const toggleSongSelection = (songId: string) => {
    const newSelected = new Set(selectedSongs);
    if (newSelected.has(songId)) {
      newSelected.delete(songId);
    } else {
      newSelected.add(songId);
    }
    setSelectedSongs(newSelected);
  };

  const toggleAllSelection = () => {
    if (selectedSongs.size === currentSongs.length) {
      setSelectedSongs(new Set());
    } else {
      setSelectedSongs(new Set(currentSongs.map(song => song._id)));
    }
  };

  const selectAllFiltered = () => {
    setSelectedSongs(new Set(filteredSongs.map(song => song._id)));
  };

  const clearSelection = () => {
    setSelectedSongs(new Set());
  };

  // 일괄 삭제
  const bulkDeleteSongs = async () => {
    if (selectedSongs.size === 0) return;
    
    const confirmMessage = `선택한 ${selectedSongs.size}곡을 모두 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`;
    if (!confirm(confirmMessage)) return;

    try {
      const deletePromises = Array.from(selectedSongs).map(songId =>
        fetch(`/api/songdetails/${songId}`, { method: 'DELETE' })
      );
      
      await Promise.all(deletePromises);
      await loadSongs();
      setSelectedSongs(new Set());
      alert(`${selectedSongs.size}곡이 삭제되었습니다.`);
    } catch (error) {
      console.error('일괄 삭제 실패:', error);
      alert('일괄 삭제에 실패했습니다.');
    }
  };

  // 일괄 업데이트
  const bulkUpdateSongs = async () => {
    if (selectedSongs.size === 0) return;

    const updateData: Record<string, unknown> = {};
    if (bulkUpdateData.language) updateData.language = bulkUpdateData.language;
    if (bulkUpdateData.keyAdjustment !== '') {
      updateData.keyAdjustment = bulkUpdateData.keyAdjustment === 'null' 
        ? null 
        : parseInt(bulkUpdateData.keyAdjustment);
    }
    if (bulkUpdateData.isFavorite !== '') {
      updateData.isFavorite = bulkUpdateData.isFavorite === 'true';
    }
    if (bulkUpdateData.playlists) {
      updateData.playlists = bulkUpdateData.playlists.split(',').map(p => p.trim()).filter(p => p);
    }
    if (bulkUpdateData.artistAlias !== '') {
      updateData.artistAlias = bulkUpdateData.artistAlias || null;
    }
    if (bulkUpdateData.searchTags) {
      updateData.searchTags = bulkUpdateData.searchTags.split(',').map(t => t.trim()).filter(t => t);
    }
    if (bulkUpdateData.sungCount !== '') {
      updateData.sungCount = parseInt(bulkUpdateData.sungCount) || 0;
    }
    if (bulkUpdateData.lastSungDate !== '') {
      updateData.lastSungDate = bulkUpdateData.lastSungDate;
    }

    if (Object.keys(updateData).length === 0) {
      alert('업데이트할 항목을 선택해주세요.');
      return;
    }

    const confirmMessage = `선택한 ${selectedSongs.size}곡의 정보를 업데이트하시겠습니까?`;
    if (!confirm(confirmMessage)) return;

    try {
      const updatePromises = Array.from(selectedSongs).map(songId =>
        fetch(`/api/songdetails/${songId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateData)
        })
      );
      
      await Promise.all(updatePromises);
      await loadSongs();
      setSelectedSongs(new Set());
      setBulkActionMode(null);
      setBulkUpdateData({ language: '', keyAdjustment: '', isFavorite: '', playlists: '', artistAlias: '', searchTags: '', sungCount: '', lastSungDate: '' });
      alert(`${selectedSongs.size}곡의 정보가 업데이트되었습니다.`);
    } catch (error) {
      console.error('일괄 업데이트 실패:', error);
      alert('일괄 업데이트에 실패했습니다.');
    }
  };

  // 키 조절 표시 함수
  const formatKeyAdjustment = (keyAdjustment: number | null | undefined) => {
    if (keyAdjustment === null || keyAdjustment === undefined) {
      return <span className="text-gray-400">미설정</span>;
    }
    if (keyAdjustment === 0) {
      return <span className="text-green-600">원본키</span>;
    }
    return (
      <span className={keyAdjustment > 0 ? "text-blue-600" : "text-red-600"}>
        {keyAdjustment > 0 ? '+' : ''}{keyAdjustment}키
      </span>
    );
  };

  // 탭 콘텐츠 렌더링
  const renderTabContent = () => {
    if (activeTab === 'timestamp') {
      return <TimestampParserTab />;
    } else if (activeTab === 'timeline') {
      return <TimelineAdjusterTab />;
    } else if (activeTab === 'comments') {
      return <CommentAnalysisTab />;
    } else if (activeTab === 'backup') {
      return renderBackupContent();
    } else {
      return renderSongContent();
    }
  };

  // 노래 관리 콘텐츠
  const renderSongContent = () => {
    return (
    <div className="p-6">
      {/* 헤더 */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <MusicalNoteIcon className="w-6 h-6 text-light-accent dark:text-dark-accent" />
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              노래 관리
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              총 {filteredSongs.length}곡 | 검색 결과: {filteredSongs.length}곡
              {selectedSongs.size > 0 && (
                <span className="ml-4 text-blue-600 dark:text-blue-400 font-medium">
                  | 선택됨: {selectedSongs.size}곡
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

        {/* 검색 및 액션 바 */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4 justify-between">
          {/* 검색 */}
          <div className="relative flex-1 max-w-md">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="제목, 아티스트로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border border-gray-300 dark:border-gray-600 rounded-lg 
                         bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* 액션 버튼들 */}
          <div className="flex gap-2">
            <button
              onClick={() => setShowBackupSection(!showBackupSection)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 
                         text-white font-medium rounded-lg transition-colors duration-200"
            >
              📂 백업 관리
            </button>
            <button
              onClick={() => setShowBulkMRSection(!showBulkMRSection)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 
                         text-white font-medium rounded-lg transition-colors duration-200"
            >
              🎵 MR 링크 자동 추가
            </button>
            <button
              onClick={() => openModal('create')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 
                         text-white font-medium rounded-lg transition-colors duration-200"
            >
              <PlusIcon className="h-5 w-5" />
              새 곡 추가
            </button>
          </div>
        </div>

        {/* 일괄 작업 컨트롤 */}
        {selectedSongs.size > 0 && (
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={toggleAllSelection}
                  className="text-sm px-3 py-1 bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200 rounded-md hover:bg-blue-200 dark:hover:bg-blue-700"
                >
                  현재 페이지 전체선택/해제
                </button>
                <button
                  onClick={selectAllFiltered}
                  className="text-sm px-3 py-1 bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200 rounded-md hover:bg-green-200 dark:hover:bg-green-700"
                >
                  검색결과 전체선택 ({filteredSongs.length}곡)
                </button>
                <button
                  onClick={clearSelection}
                  className="text-sm px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                  선택해제
                </button>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={bulkDeleteSongs}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium"
                >
                  선택항목 삭제 ({selectedSongs.size})
                </button>
                <button
                  onClick={() => setBulkActionMode(bulkActionMode === 'update' ? null : 'update')}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium"
                >
                  일괄 수정 ({selectedSongs.size})
                </button>
              </div>
            </div>
            
            {/* 일괄 수정 패널 */}
            {bulkActionMode === 'update' && (
              <div className="mt-4 p-4 bg-white dark:bg-gray-800 rounded-lg border">
                <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                  선택된 {selectedSongs.size}곡의 정보를 일괄 수정
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      아티스트 별명
                    </label>
                    <input
                      type="text"
                      value={bulkUpdateData.artistAlias}
                      onChange={(e) => setBulkUpdateData(prev => ({ ...prev, artistAlias: e.target.value }))}
                      placeholder="예: IU (빈 값으로 두면 변경하지 않음)"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                                 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      언어
                    </label>
                    <select
                      value={bulkUpdateData.language}
                      onChange={(e) => setBulkUpdateData(prev => ({ ...prev, language: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                                 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    >
                      <option value="">변경하지 않음</option>
                      <option value="Korean">Korean</option>
                      <option value="English">English</option>
                      <option value="Japanese">Japanese</option>
                      <option value="Chinese">Chinese</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      키 조절
                    </label>
                    <select
                      value={bulkUpdateData.keyAdjustment}
                      onChange={(e) => setBulkUpdateData(prev => ({ ...prev, keyAdjustment: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                                 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    >
                      <option value="">변경하지 않음</option>
                      <option value="null">미설정</option>
                      <option value="0">원본키</option>
                      {Array.from({ length: 25 }, (_, i) => i - 12).map(key => (
                        <option key={key} value={key}>
                          {key > 0 ? '+' : ''}{key}키
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      즐겨찾기
                    </label>
                    <select
                      value={bulkUpdateData.isFavorite}
                      onChange={(e) => setBulkUpdateData(prev => ({ ...prev, isFavorite: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                                 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    >
                      <option value="">변경하지 않음</option>
                      <option value="true">즐겨찾기</option>
                      <option value="false">일반</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      플레이리스트 (쉼표로 구분)
                    </label>
                    <input
                      type="text"
                      value={bulkUpdateData.playlists}
                      onChange={(e) => setBulkUpdateData(prev => ({ ...prev, playlists: e.target.value }))}
                      placeholder="예: 즐겨듣기, 발라드"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                                 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      검색 태그 (쉼표로 구분)
                    </label>
                    <input
                      type="text"
                      value={bulkUpdateData.searchTags}
                      onChange={(e) => setBulkUpdateData(prev => ({ ...prev, searchTags: e.target.value }))}
                      placeholder="예: 발라드, 팝, 댄스"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                                 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      부른 횟수
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={bulkUpdateData.sungCount}
                      onChange={(e) => setBulkUpdateData(prev => ({ ...prev, sungCount: e.target.value }))}
                      placeholder="예: 5 (빈 값으로 두면 변경하지 않음)"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                                 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      마지막 부른 날짜
                    </label>
                    <input
                      type="date"
                      value={bulkUpdateData.lastSungDate}
                      onChange={(e) => setBulkUpdateData(prev => ({ ...prev, lastSungDate: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                                 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    />
                  </div>
                </div>
                
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={bulkUpdateSongs}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
                  >
                    적용하기
                  </button>
                  <button
                    onClick={() => setBulkActionMode(null)}
                    className="px-4 py-2 bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-500 
                               text-gray-700 dark:text-gray-200 rounded-lg font-medium"
                  >
                    취소
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 백업 관리 섹션 */}
        {showBackupSection && (
          <div className="mb-6 p-6 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-700">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-purple-900 dark:text-purple-100">📂 데이터베이스 백업 관리</h2>
              <button
                onClick={() => setShowBackupSection(false)}
                className="text-purple-600 hover:text-purple-800 dark:text-purple-300 dark:hover:text-purple-100"
              >
                ✕
              </button>
            </div>

            {/* 현재 DB 상태 */}
            {collectionStats && (
              <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg border">
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">📊 현재 데이터베이스 상태</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded">
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{collectionStats.totalCollections}</div>
                    <div className="text-blue-700 dark:text-blue-300">컬렉션 수</div>
                  </div>
                  <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">{collectionStats.totalDocuments.toLocaleString()}</div>
                    <div className="text-green-700 dark:text-green-300">총 문서 수</div>
                  </div>
                  <div className="text-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded">
                    <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{backups.length}</div>
                    <div className="text-orange-700 dark:text-orange-300">백업 개수</div>
                  </div>
                </div>
              </div>
            )}

            {/* 새 백업 생성 */}
            <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg border">
              <h3 className="font-medium text-gray-900 dark:text-white mb-3">🆕 새 백업 생성</h3>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={backupName}
                  onChange={(e) => setBackupName(e.target.value)}
                  placeholder="백업명 입력 (예: before_mr_update_2024)"
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                             bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  disabled={backupLoading}
                />
                <button
                  onClick={createBackup}
                  disabled={backupLoading || !backupName.trim()}
                  className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed
                             text-white font-medium rounded-lg transition-colors duration-200"
                >
                  {backupLoading ? '⏳ 생성 중...' : '💾 백업 생성'}
                </button>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                💡 백업은 현재 모든 컬렉션의 데이터를 포함합니다. (백업용 컬렉션 제외)
              </p>
            </div>

            {/* 백업 목록 */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <h3 className="font-medium text-gray-900 dark:text-white">📋 백업 목록</h3>
              </div>
              
              {backups.length === 0 ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  📭 저장된 백업이 없습니다.
                </div>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {backups.map((backup, index) => (
                    <div key={index} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-gray-900 dark:text-white">
                              📦 {backup.name}
                            </span>
                            <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                              {backup.metadata?.totalCollections || 0}개 컬렉션
                            </span>
                            <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded">
                              {backup.metadata?.totalDocuments?.toLocaleString() || 0}개 문서
                            </span>
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            📅 {new Date(backup.timestamp).toLocaleString('ko-KR')}
                          </div>
                        </div>
                        <div className="flex gap-2 ml-4">
                          <button
                            onClick={() => restoreBackup(backup.name)}
                            disabled={backupLoading}
                            className="px-3 py-1 bg-orange-600 hover:bg-orange-700 disabled:opacity-50
                                       text-white text-sm rounded transition-colors duration-200"
                          >
                            🔄 복원
                          </button>
                          <button
                            onClick={() => deleteBackup(backup.name)}
                            disabled={backupLoading}
                            className="px-3 py-1 bg-red-600 hover:bg-red-700 disabled:opacity-50
                                       text-white text-sm rounded transition-colors duration-200"
                          >
                            🗑️ 삭제
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 주의사항 */}
            <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg">
              <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">⚠️ 주의사항</h4>
              <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                <li>• 백업 복원 시 현재 모든 데이터가 삭제되고 백업 시점의 데이터로 완전히 대체됩니다.</li>
                <li>• 복원 작업은 되돌릴 수 없으니 신중히 진행해주세요.</li>
                <li>• 백업용 컬렉션 (backups, backup_logs)은 백업/복원 대상에서 자동 제외됩니다.</li>
                <li>• 대량 작업(MR 링크 업데이트 등) 전에는 반드시 백업을 생성하세요.</li>
              </ul>
            </div>
          </div>
        )}

        {/* MR 링크 일괄 추가 섹션 */}
        {showBulkMRSection && (
          <div className="mb-6 p-6 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-700">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-green-900 dark:text-green-100">🎵 MR 링크 자동 추가</h2>
            </div>

          {/* 현재 상태 표시 */}
          <div className="mb-4 p-4 bg-white dark:bg-gray-800 rounded-lg border">
            <h3 className="font-medium text-gray-900 dark:text-white mb-2">📊 현재 MR 링크 현황</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {filteredSongs.filter(song => song.mrLinks && song.mrLinks.length > 0).length}
                </div>
                <div className="text-blue-700 dark:text-blue-300">MR 링크 있음</div>
              </div>
              <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded">
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {filteredSongs.filter(song => !song.mrLinks || song.mrLinks.length === 0).length}
                </div>
                <div className="text-red-700 dark:text-red-300">MR 링크 없음</div>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-900/20 rounded">
                <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">
                  {filteredSongs.length}
                </div>
                <div className="text-gray-700 dark:text-gray-300">총 곡 수</div>
              </div>
            </div>
          </div>

          {/* 일괄 추가 버튼 */}
          <div className="flex gap-3 items-center">
            <button
              onClick={bulkAddMRLinks}
              disabled={bulkMRLoading || filteredSongs.filter(song => !song.mrLinks || song.mrLinks.length === 0).length === 0}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed
                         text-white font-medium rounded-lg transition-colors duration-200 flex items-center gap-2"
            >
              {bulkMRLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  처리 중... ({bulkMRProgress.current}/{bulkMRProgress.total})
                </>
              ) : (
                <>
                  🔍 MR 링크 없는 곡에 자동 추가
                </>
              )}
            </button>
            
            {bulkMRLoading && (
              <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-green-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(bulkMRProgress.current / bulkMRProgress.total) * 100}%` }}
                ></div>
              </div>
            )}
          </div>

          {/* 설명 및 주의사항 */}
          <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg">
            <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">ℹ️ 작업 정보 및 제한사항</h4>
            <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
              <li>• MR 링크가 없는 곡에 대해서만 YouTube에서 자동 검색하여 추가합니다.</li>
              <li>• 검색 쿼리: &quot;{`{곡제목} {아티스트} karaoke MR`}&quot; 형식으로 검색합니다.</li>
              <li>• <strong>YouTube API 할당량 제한: 하루 10,000 유닛 (검색 1회 = 100 유닛)</strong></li>
              <li>• <strong>최대 100곡까지 처리 가능</strong> (할당량 한도 내에서)</li>
              <li>• 할당량 초과 시 작업이 자동 중단되며, 매일 자정(PST)에 리셋됩니다.</li>
              <li>• 각 곡마다 0.2초씩 딜레이를 두어 API 제한을 방지합니다.</li>
              <li>• 작업 전 백업을 생성하는 것을 <strong>강력히 권장</strong>합니다.</li>
            </ul>
          </div>
          </div>
        )}

        {/* 곡 목록 테이블 */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600 dark:text-gray-400">로딩 중...</p>
          </div>
        ) : (
          <>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        <input
                          type="checkbox"
                          checked={currentSongs.length > 0 && currentSongs.every(song => selectedSongs.has(song._id))}
                          onChange={toggleAllSelection}
                          className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                        />
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        곡 정보
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        언어
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        키 조절
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        부른 횟수
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        검색 태그
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        MR/플레이리스트
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        액션
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {currentSongs.map((song) => (
                      <tr key={song._id} className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${selectedSongs.has(song._id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            checked={selectedSongs.has(song._id)}
                            onChange={() => toggleSongSelection(song._id)}
                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {song.title}
                              {song.titleAlias && (
                                <span className="text-gray-500 dark:text-gray-400 ml-2">
                                  ({song.titleAlias})
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {song.artist}
                              {song.artistAlias && (
                                <span className="ml-2">({song.artistAlias})</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                                         bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                            {song.language || '미설정'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {formatKeyAdjustment(song.keyAdjustment)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {song.sungCount || 0}회
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {song.searchTags?.slice(0, 3).map((tag, index) => (
                              <span
                                key={index}
                                className="inline-block px-2 py-1 bg-blue-100 dark:bg-blue-900 
                                           text-blue-800 dark:text-blue-200 rounded text-xs"
                              >
                                {tag}
                              </span>
                            ))}
                            {song.searchTags && song.searchTags.length > 3 && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                +{song.searchTags.length - 3}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          <div className="space-y-1">
                            <div>
                              MR: {song.mrLinks?.length || 0}개
                            </div>
                            <div>
                              플레이리스트: {song.playlists?.length || 0}개
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => openModal('view', song)}
                              className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                              title="보기"
                            >
                              <EyeIcon className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => openModal('edit', song)}
                              className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                              title="수정"
                            >
                              <PencilIcon className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => deleteSong(song._id)}
                              className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                              title="삭제"
                            >
                              <TrashIcon className="h-5 w-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div className="mt-6 flex justify-center">
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md
                               bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300
                               disabled:opacity-50 disabled:cursor-not-allowed
                               hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    이전
                  </button>
                  
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const startPage = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
                    const pageNum = startPage + i;
                    
                    if (pageNum > totalPages) return null;
                    
                    return (
                      <button
                        key={`page-${pageNum}`}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md
                                   ${currentPage === pageNum 
                                     ? 'bg-blue-600 text-white' 
                                     : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                                   }`}
                      >
                        {pageNum}
                      </button>
                    );
                  }).filter(Boolean)}
                  
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md
                               bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300
                               disabled:opacity-50 disabled:cursor-not-allowed
                               hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    다음
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* 곡이 없을 때 */}
        {!loading && filteredSongs.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400 text-lg">
              {searchTerm ? '검색 결과가 없습니다.' : '등록된 곡이 없습니다.'}
            </p>
            <button
              onClick={() => openModal('create')}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 
                         text-white font-medium rounded-lg transition-colors duration-200"
            >
              <PlusIcon className="h-5 w-5" />
              첫 번째 곡 추가하기
            </button>
          </div>
        )}

        {/* 곡 상세/수정/추가 모달 */}
        {isModalOpen && <SongDetailModal />}
      </div>
    );
  };

  // 곡 상세 모달 컴포넌트
  function SongDetailModal() {
    const [formData, setFormData] = useState(() => {
      if (modalMode === 'create') {
        return {
          title: '',
          artist: '',
          titleAlias: '',
          artistAlias: '',
          language: '',
          lyrics: '',
          searchTags: [],
          sungCount: 0,
          lastSungDate: '',
          keyAdjustment: null as number | null,
          isFavorite: false,
          mrLinks: [] as Array<{url: string; skipSeconds: number; label: string; duration: string}>,
          selectedMRIndex: 0,
          playlists: [],
          personalNotes: '',
          imageUrl: ''
        };
      }
      return {
        title: selectedSong?.title || '',
        artist: selectedSong?.artist || '',
        titleAlias: selectedSong?.titleAlias || '',
        artistAlias: selectedSong?.artistAlias || '',
        language: selectedSong?.language || '',
        lyrics: selectedSong?.lyrics || '',
        searchTags: selectedSong?.searchTags || [],
        sungCount: selectedSong?.sungCount || 0,
        lastSungDate: selectedSong?.lastSungDate || '',
        keyAdjustment: selectedSong?.keyAdjustment ?? null,
        isFavorite: selectedSong?.isFavorite || false,
        mrLinks: selectedSong?.mrLinks || [],
        selectedMRIndex: selectedSong?.selectedMRIndex || 0,
        playlists: selectedSong?.playlists || [],
        personalNotes: selectedSong?.personalNotes || '',
        imageUrl: selectedSong?.imageUrl || ''
      };
    });

    const [saving, setSaving] = useState(false);
    const [tagInput, setTagInput] = useState('');
    const [playlistInput, setPlaylistInput] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setSaving(true);

      try {
        const submitData = {
          ...formData,
          searchTags: formData.searchTags.filter(tag => tag.trim()),
          playlists: formData.playlists?.filter((playlist: string) => playlist.trim()) || [],
        };

        let response;
        if (modalMode === 'create') {
          response = await fetch('/api/songdetails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(submitData)
          });
        } else if (modalMode === 'edit' && selectedSong) {
          response = await fetch(`/api/songdetails/${selectedSong._id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(submitData)
          });
        }

        if (response && response.ok) {
          await loadSongs();
          setIsModalOpen(false);
          alert(modalMode === 'create' ? '곡이 추가되었습니다.' : '곡이 수정되었습니다.');
        } else {
          const error = await response?.json();
          alert(`오류: ${error?.error || '알 수 없는 오류가 발생했습니다.'}`);
        }
      } catch (error) {
        console.error('저장 오류:', error);
        alert('저장 중 오류가 발생했습니다.');
      } finally {
        setSaving(false);
      }
    };

    const addTag = () => {
      if (tagInput.trim() && !formData.searchTags.includes(tagInput.trim())) {
        setFormData(prev => ({ ...prev, searchTags: [...prev.searchTags, tagInput.trim()] }));
        setTagInput('');
      }
    };

    const removeTag = (index: number) => {
      setFormData(prev => ({ ...prev, searchTags: prev.searchTags.filter((_, i) => i !== index) }));
    };

    const addPlaylist = () => {
      if (playlistInput.trim() && !formData.playlists.includes(playlistInput.trim())) {
        setFormData(prev => ({ ...prev, playlists: [...prev.playlists, playlistInput.trim()] }));
        setPlaylistInput('');
      }
    };

    const removePlaylist = (index: number) => {
      setFormData(prev => ({ ...prev, playlists: prev.playlists?.filter((_: string, i: number) => i !== index) || [] }));
    };

    const addMRLink = () => {
      setFormData(prev => ({
        ...prev,
        mrLinks: [...prev.mrLinks, { url: '', skipSeconds: 0, label: '', duration: '' }]
      }));
    };

    const updateMRLink = (index: number, field: string, value: string | number) => {
      setFormData(prev => ({
        ...prev,
        mrLinks: prev.mrLinks.map((link, i) => 
          i === index ? { ...link, [field]: value } : link
        )
      }));
    };

    const removeMRLink = (index: number) => {
      setFormData(prev => ({
        ...prev,
        mrLinks: prev.mrLinks.filter((_, i) => i !== index),
        selectedMRIndex: prev.selectedMRIndex >= prev.mrLinks.length - 1 ? 0 : prev.selectedMRIndex
      }));
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              {modalMode === 'create' ? '새 곡 추가' : modalMode === 'edit' ? '곡 정보 수정' : '곡 정보 보기'}
            </h3>
            <button
              onClick={() => setIsModalOpen(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 기본 정보 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  곡 제목 *
                </label>
                <input
                  type="text"
                  required
                  disabled={modalMode === 'view'}
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                             bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                             disabled:bg-gray-50 dark:disabled:bg-gray-800"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  아티스트 *
                </label>
                <input
                  type="text"
                  required
                  disabled={modalMode === 'view'}
                  value={formData.artist}
                  onChange={(e) => setFormData(prev => ({ ...prev, artist: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                             bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                             disabled:bg-gray-50 dark:disabled:bg-gray-800"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  제목 별명
                </label>
                <input
                  type="text"
                  disabled={modalMode === 'view'}
                  value={formData.titleAlias}
                  onChange={(e) => setFormData(prev => ({ ...prev, titleAlias: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                             bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                             disabled:bg-gray-50 dark:disabled:bg-gray-800"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  아티스트 별명
                </label>
                <input
                  type="text"
                  disabled={modalMode === 'view'}
                  value={formData.artistAlias}
                  onChange={(e) => setFormData(prev => ({ ...prev, artistAlias: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                             bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                             disabled:bg-gray-50 dark:disabled:bg-gray-800"
                />
              </div>
            </div>

            {/* 언어 및 설정 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  언어
                </label>
                <select
                  disabled={modalMode === 'view'}
                  value={formData.language}
                  onChange={(e) => setFormData(prev => ({ ...prev, language: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                             bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                             disabled:bg-gray-50 dark:disabled:bg-gray-800"
                >
                  <option value="">선택 안함</option>
                  <option value="Korean">Korean</option>
                  <option value="English">English</option>
                  <option value="Japanese">Japanese</option>
                  <option value="Chinese">Chinese</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  키 조절
                </label>
                <select
                  disabled={modalMode === 'view'}
                  value={formData.keyAdjustment === null ? 'null' : formData.keyAdjustment.toString()}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    keyAdjustment: e.target.value === 'null' ? null : parseInt(e.target.value)
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                             bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                             disabled:bg-gray-50 dark:disabled:bg-gray-800"
                >
                  <option value="null">미설정</option>
                  <option value="0">원본키</option>
                  {Array.from({ length: 25 }, (_, i) => i - 12).map(key => (
                    <option key={key} value={key}>
                      {key > 0 ? '+' : ''}{key}키
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  즐겨찾기
                </label>
                <div className="mt-2">
                  <label className="inline-flex items-center">
                    <input
                      type="checkbox"
                      disabled={modalMode === 'view'}
                      checked={formData.isFavorite}
                      onChange={(e) => setFormData(prev => ({ ...prev, isFavorite: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">즐겨찾기 설정</span>
                  </label>
                </div>
              </div>
            </div>

            {/* 부른 횟수 및 마지막 부른 날짜 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  부른 횟수
                </label>
                <input
                  type="number"
                  min="0"
                  disabled={modalMode === 'view'}
                  value={formData.sungCount}
                  onChange={(e) => setFormData(prev => ({ ...prev, sungCount: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                             bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                             disabled:bg-gray-50 dark:disabled:bg-gray-800"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  마지막 부른 날짜
                </label>
                <input
                  type="date"
                  disabled={modalMode === 'view'}
                  value={formData.lastSungDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, lastSungDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                             bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                             disabled:bg-gray-50 dark:disabled:bg-gray-800"
                />
              </div>
            </div>

            {/* 이미지 URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                이미지 URL
              </label>
              <input
                type="url"
                disabled={modalMode === 'view'}
                value={formData.imageUrl}
                onChange={(e) => setFormData(prev => ({ ...prev, imageUrl: e.target.value }))}
                placeholder="https://example.com/image.jpg"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                           disabled:bg-gray-50 dark:disabled:bg-gray-800"
              />
            </div>

            {/* 검색 태그 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                검색 태그
              </label>
              {modalMode !== 'view' && (
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                    placeholder="태그 입력 후 Enter"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                               bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={addTag}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
                  >
                    추가
                  </button>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {formData.searchTags.map((tag, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900 
                               text-blue-800 dark:text-blue-200 rounded-md text-sm"
                  >
                    {tag}
                    {modalMode !== 'view' && (
                      <button
                        type="button"
                        onClick={() => removeTag(index)}
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-100"
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}
              </div>
            </div>

            {/* 플레이리스트 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                플레이리스트
              </label>
              {modalMode !== 'view' && (
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={playlistInput}
                    onChange={(e) => setPlaylistInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addPlaylist())}
                    placeholder="플레이리스트 입력 후 Enter"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                               bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={addPlaylist}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md"
                  >
                    추가
                  </button>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {formData.playlists?.map((playlist: string, index: number) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900 
                               text-green-800 dark:text-green-200 rounded-md text-sm"
                  >
                    {playlist}
                    {modalMode !== 'view' && (
                      <button
                        type="button"
                        onClick={() => removePlaylist(index)}
                        className="text-green-600 hover:text-green-800 dark:text-green-300 dark:hover:text-green-100"
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}
              </div>
            </div>

            {/* 가사 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                가사
              </label>
              <textarea
                rows={6}
                disabled={modalMode === 'view'}
                value={formData.lyrics}
                onChange={(e) => setFormData(prev => ({ ...prev, lyrics: e.target.value }))}
                placeholder="가사를 입력하세요..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                           disabled:bg-gray-50 dark:disabled:bg-gray-800"
              />
            </div>

            {/* 개인 메모 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                개인 메모
              </label>
              <textarea
                rows={3}
                disabled={modalMode === 'view'}
                value={formData.personalNotes}
                onChange={(e) => setFormData(prev => ({ ...prev, personalNotes: e.target.value }))}
                placeholder="개인 메모를 입력하세요..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                           disabled:bg-gray-50 dark:disabled:bg-gray-800"
              />
            </div>

            {/* MR 링크 관리 */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  MR 링크
                </label>
                {modalMode !== 'view' && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        if (!formData.title || !formData.artist) {
                          alert('곡 제목과 아티스트를 먼저 입력해주세요.');
                          return;
                        }
                        
                        const mrResult = await searchMRFromYouTube(formData.title, formData.artist);
                        if (mrResult) {
                          setFormData(prev => ({
                            ...prev,
                            mrLinks: [...prev.mrLinks, {
                              url: mrResult.url,
                              skipSeconds: 0,
                              label: `Auto-found: ${mrResult.title.substring(0, 30)}...`,
                              duration: ''
                            }]
                          }));
                          alert(`MR 링크를 찾았습니다!\n제목: ${mrResult.title}`);
                        } else {
                          alert('검색 결과를 찾을 수 없습니다.');
                        }
                      }}
                      className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm"
                    >
                      🔍 자동 검색
                    </button>
                    <button
                      type="button"
                      onClick={addMRLink}
                      className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-md text-sm"
                    >
                      MR 링크 추가
                    </button>
                  </div>
                )}
              </div>
              
              {formData.mrLinks.length > 0 && modalMode !== 'view' && (
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    기본 선택 MR
                  </label>
                  <select
                    value={formData.selectedMRIndex}
                    onChange={(e) => setFormData(prev => ({ ...prev, selectedMRIndex: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                               bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    {formData.mrLinks.map((link, index) => (
                      <option key={index} value={index}>
                        {link.label || link.url || `MR ${index + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-4">
                {formData.mrLinks.map((link, index) => (
                  <div key={index} className="p-4 border border-gray-300 dark:border-gray-600 rounded-md">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-medium text-gray-900 dark:text-white">MR {index + 1}</h4>
                      {modalMode !== 'view' && (
                        <button
                          type="button"
                          onClick={() => removeMRLink(index)}
                          className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200"
                        >
                          삭제
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          URL
                        </label>
                        <input
                          type="url"
                          disabled={modalMode === 'view'}
                          value={link.url}
                          onChange={(e) => updateMRLink(index, 'url', e.target.value)}
                          placeholder="https://..."
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                                     bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                                     disabled:bg-gray-50 dark:disabled:bg-gray-800"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          라벨
                        </label>
                        <input
                          type="text"
                          disabled={modalMode === 'view'}
                          value={link.label}
                          onChange={(e) => updateMRLink(index, 'label', e.target.value)}
                          placeholder="예: 원키, -2키"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                                     bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                                     disabled:bg-gray-50 dark:disabled:bg-gray-800"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          재생 시간
                        </label>
                        <input
                          type="text"
                          disabled={modalMode === 'view'}
                          value={link.duration}
                          onChange={(e) => updateMRLink(index, 'duration', e.target.value)}
                          placeholder="예: 3:45"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                                     bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                                     disabled:bg-gray-50 dark:disabled:bg-gray-800"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          스킵 시간 (초)
                        </label>
                        <input
                          type="number"
                          min="0"
                          disabled={modalMode === 'view'}
                          value={link.skipSeconds}
                          onChange={(e) => updateMRLink(index, 'skipSeconds', parseInt(e.target.value) || 0)}
                          placeholder="0"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                                     bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                                     disabled:bg-gray-50 dark:disabled:bg-gray-800"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 액션 버튼 */}
            <div className="flex justify-end gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-500 
                           text-gray-700 dark:text-gray-200 rounded-lg font-medium"
              >
                취소
              </button>
              {modalMode !== 'view' && (
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 
                             text-white rounded-lg font-medium"
                >
                  {saving ? '저장 중...' : (modalMode === 'create' ? '추가' : '수정')}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    );
  }

  // 백업 관리 콘텐츠
  const renderBackupContent = () => {
    return (
    <div className="p-6">
      {/* 헤더 */}
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

      {/* 백업 토글 버튼 */}
      <button
        onClick={() => setShowBackupSection(!showBackupSection)}
        className="mb-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
      >
        {showBackupSection ? '백업 관리 숨기기' : '백업 관리 보기'}
      </button>

      {showBackupSection && (
        <div className="space-y-6">
          {/* 컬렉션 현황 */}
          {collectionStats && (
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <h3 className="font-medium text-gray-900 dark:text-white mb-3">📊 현재 DB 현황</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-gray-800 p-3 rounded">
                  <div className="text-2xl font-bold text-light-accent dark:text-dark-accent">
                    {collectionStats.totalDocuments.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">총 문서</div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-3 rounded">
                  <div className="text-2xl font-bold text-light-accent dark:text-dark-accent">
                    {collectionStats.totalCollections}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">컬렉션</div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-3 rounded">
                  <div className="text-sm text-gray-700 dark:text-gray-300">
                    <div className="font-medium mb-1">컬렉션별:</div>
                    {collectionStats.collections.map((collection, index) => (
                      <div key={index} className="flex justify-between">
                        <span>{collection.name}:</span>
                        <span className="font-mono">{collection.count.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 새 백업 생성 */}
          <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg border">
            <h3 className="font-medium text-gray-900 dark:text-white mb-3">🆕 새 백업 생성</h3>
            <div className="flex gap-3">
              <input
                type="text"
                value={backupName}
                onChange={(e) => setBackupName(e.target.value)}
                placeholder="백업명 입력 (예: before_mr_update_2024)"
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                disabled={backupLoading}
              />
              <button
                onClick={createBackup}
                disabled={backupLoading || !backupName.trim()}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed
                           text-white font-medium rounded-lg transition-colors duration-200"
              >
                {backupLoading ? '⏳ 생성 중...' : '💾 백업 생성'}
              </button>
            </div>
          </div>

          {/* 백업 목록 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-medium text-gray-900 dark:text-white">📋 백업 목록</h3>
            </div>
            <div className="p-4">
              {backups.length > 0 ? (
                <div className="space-y-3">
                  {backups.map((backup) => (
                    <div key={backup.name} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded">
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">{backup.name}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {new Date(backup.timestamp).toLocaleString('ko-KR')}
                          {backup.metadata && ` | ${backup.metadata.totalDocuments.toLocaleString()}개 문서`}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => restoreBackup(backup.name)}
                          disabled={backupLoading}
                          className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50
                                     text-white text-sm rounded transition-colors"
                        >
                          복원
                        </button>
                        <button
                          onClick={() => deleteBackup(backup.name)}
                          disabled={backupLoading}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 disabled:opacity-50
                                     text-white text-sm rounded transition-colors"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-center py-4">백업이 없습니다.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
    );
  };

  // 메인 return
  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-900 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Cog6ToothIcon className="w-6 h-6 text-gray-500 dark:text-gray-400" />
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                개발자 도구
              </h1>
              <span className="px-2 py-1 text-xs bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-full">
                로컬 전용
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-8 flex-1 min-h-0">
        <div className="flex flex-col lg:flex-row gap-8 h-full">
          {/* Mobile Tab Navigation */}
          <div className="lg:hidden">
            <nav className="flex overflow-x-auto space-x-1 pb-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-shrink-0 flex flex-col items-center px-3 py-2 rounded-lg transition-all duration-200 min-w-[80px] ${
                      isActive
                        ? 'bg-light-accent/10 dark:bg-dark-accent/10 border border-light-accent/20 dark:border-dark-accent/20 text-light-accent dark:text-dark-accent'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <Icon className="w-5 h-5 mb-1" />
                    <div className="text-xs font-medium text-center">{tab.name}</div>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Desktop Sidebar */}
          <div className="hidden lg:block w-64 flex-shrink-0">
            <nav className="space-y-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 ${
                      isActive
                        ? 'bg-light-accent/10 dark:bg-dark-accent/10 border border-light-accent/20 dark:border-dark-accent/20 text-light-accent dark:text-dark-accent'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Icon className="w-5 h-5 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-medium">{tab.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {tab.description}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0 h-full">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 h-full overflow-hidden">
              {renderTabContent()}
            </div>
          </div>
        </div>
      </div>

      {/* 모달 */}
      {isModalOpen && <SongDetailModal />}
    </div>
  );
}