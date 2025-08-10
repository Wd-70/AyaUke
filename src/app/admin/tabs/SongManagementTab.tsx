'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  MagnifyingGlassIcon, 
  PlusIcon, 
  PencilIcon, 
  TrashIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckIcon,
  XMarkIcon,
  ArrowDownTrayIcon,
  LinkIcon
} from '@heroicons/react/24/outline';
import { SongDetail } from '@/types';

interface SongWithId extends Omit<SongDetail, 'isFavorite' | 'playlists'> {
  _id: string;
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

export default function SongManagementTab() {
  const [songs, setSongs] = useState<SongWithId[]>([]);
  const [filteredSongs, setFilteredSongs] = useState<SongWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [includeLyrics, setIncludeLyrics] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [selectedSong, setSelectedSong] = useState<SongWithId | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'edit' | 'create'>('edit');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [selectedSongs, setSelectedSongs] = useState<Set<string>>(new Set());
  const [bulkActionMode, setBulkActionMode] = useState<'delete' | 'update' | null>(null);
  const [bulkUpdateData, setBulkUpdateData] = useState({
    language: '',
    keyAdjustment: '',
    artistAlias: '',
    searchTags: '',
    addTags: '' // 기존 태그를 유지하며 추가할 태그들
  });

  // 모달의 formData를 부모에서 관리
  const [formData, setFormData] = useState({
    title: '',
    artist: '',
    titleAlias: '',
    artistAlias: '',
    language: '',
    lyrics: '',
    searchTags: [] as string[],
    sungCount: 0,
    lastSungDate: '',
    keyAdjustment: null as number | null,
    mrLinks: [] as Array<{url: string; skipSeconds: number; label: string; duration: string}>,
    selectedMRIndex: 0,
    personalNotes: '',
    imageUrl: ''
  });

  // MR 링크 자동 추가 상태
  const [bulkMRLoading, setBulkMRLoading] = useState(false);
  const [bulkMRProgress, setBulkMRProgress] = useState({ current: 0, total: 0 });

  // 모달 formData 초기화 useEffect - 부모에서 관리
  useEffect(() => {
    if (isModalOpen) {
      if (modalMode === 'create') {
        console.log('생성 모드로 formData 설정');
        setFormData({
          title: '',
          artist: '',
          titleAlias: '',
          artistAlias: '',
          language: '',
          lyrics: '',
          searchTags: [],
          sungCount: 0,
          lastSungDate: '',
          keyAdjustment: null,
          mrLinks: [],
          selectedMRIndex: 0,
          personalNotes: '',
          imageUrl: ''
        });
      } else if (selectedSong && modalMode === 'edit') {
        console.log('수정 모드로 formData 설정, 기존 MR 링크:', selectedSong.mrLinks);
        setFormData({
          title: selectedSong.title || '',
          artist: selectedSong.artist || '',
          titleAlias: selectedSong.titleAlias || '',
          artistAlias: selectedSong.artistAlias || '',
          language: selectedSong.language || '',
          lyrics: selectedSong.lyrics || '',
          searchTags: selectedSong.searchTags || [],
          sungCount: selectedSong.sungCount || 0,
          lastSungDate: selectedSong.lastSungDate || '',
          keyAdjustment: selectedSong.keyAdjustment ?? null,
          mrLinks: selectedSong.mrLinks || [],
          selectedMRIndex: selectedSong.selectedMRIndex || 0,
          personalNotes: selectedSong.personalNotes || '',
          imageUrl: selectedSong.imageUrl || ''
        });
      }
    }
  }, [isModalOpen, modalMode, selectedSong?._id]); // selectedSong._id만 의존성으로 사용
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

  // 토스트 알림 함수
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000); // 3초 후 자동 사라짐
  };

  // 검색 필터링
  useEffect(() => {
    const filtered = songs.filter(song => {
      if (!searchTerm.trim()) return true;
      
      // 화이트스페이스 제거 함수
      const removeWhitespace = (str: string) => str.replace(/\s/g, '');
      const searchNormalized = removeWhitespace(searchTerm.toLowerCase());
      
      // 기본 검색 필드들 (화이트스페이스 무시)
      const basicFields = [
        song.title,
        song.artist,
        song.titleAlias,
        song.artistAlias,
        ...(song.searchTags || []) // 검색 태그 배열을 펼쳐서 추가
      ];
      
      const matchesBasicFields = basicFields.some(field => 
        field && removeWhitespace(field.toLowerCase()).includes(searchNormalized)
      );
      
      // 가사 검색 (옵션에 따라)
      const matchesLyrics = includeLyrics && song.lyrics && 
        removeWhitespace(song.lyrics.toLowerCase()).includes(searchNormalized);
      
      return matchesBasicFields || matchesLyrics;
    });
    setFilteredSongs(filtered);
    setCurrentPage(1);
  }, [songs, searchTerm, includeLyrics]);

  // 페이지네이션 계산
  const totalPages = Math.ceil(filteredSongs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentSongs = filteredSongs.slice(startIndex, endIndex);

  // 곡 선택/해제
  const toggleSongSelection = (songId: string) => {
    const newSelected = new Set(selectedSongs);
    if (newSelected.has(songId)) {
      newSelected.delete(songId);
    } else {
      newSelected.add(songId);
    }
    setSelectedSongs(newSelected);
  };

  // 전체 선택/해제
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

  // 곡 삭제
  const deleteSong = async (songId: string) => {
    if (!confirm('정말로 이 곡을 삭제하시겠습니까?')) return;

    try {
      const response = await fetch(`/api/songdetails/${songId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await loadSongs();
        showToast('곡이 삭제되었습니다.', 'success');
      } else {
        const error = await response.json();
        showToast(`삭제 실패: ${error.error}`, 'error');
      }
    } catch (error) {
      console.error('곡 삭제 오류:', error);
      alert('곡 삭제 중 오류가 발생했습니다.');
    }
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
      setBulkActionMode(null);
      showToast(`${selectedSongs.size}곡이 삭제되었습니다.`, 'success');
    } catch (error) {
      console.error('일괄 삭제 실패:', error);
      showToast('일괄 삭제에 실패했습니다.', 'error');
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
    if (bulkUpdateData.artistAlias !== '') {
      updateData.artistAlias = bulkUpdateData.artistAlias || null;
    }
    if (bulkUpdateData.searchTags) {
      updateData.searchTags = bulkUpdateData.searchTags.split(',').map(t => t.trim()).filter(t => t);
    }

    // 태그 추가 기능
    const addTagsData: Record<string, unknown> = {};
    if (bulkUpdateData.addTags) {
      addTagsData.addTags = bulkUpdateData.addTags.split(',').map(t => t.trim()).filter(t => t);
    }

    if (Object.keys(updateData).length === 0 && Object.keys(addTagsData).length === 0) {
      alert('업데이트할 항목을 선택해주세요.');
      return;
    }

    const confirmMessage = `선택한 ${selectedSongs.size}곡의 정보를 업데이트하시겠습니까?`;
    if (!confirm(confirmMessage)) return;

    try {
      const updatePromises = Array.from(selectedSongs).map(async (songId) => {
        // 기존 곡 정보 가져오기 (태그 추가가 있는 경우)
        let existingTags: string[] = [];
        if (Object.keys(addTagsData).length > 0) {
          const songResponse = await fetch(`/api/songdetails/${songId}`);
          
          if (songResponse.ok) {
            const responseData = await songResponse.json();
            // API 응답 구조가 {success: true, song: {...}} 형태
            const songData = responseData.song || responseData;
            existingTags = songData.searchTags || [];
          }
        }

        // 최종 업데이트 데이터 준비 (태그는 별도 처리하므로 제외)
        const finalUpdateData = { ...updateData };
        delete finalUpdateData.searchTags; // 태그는 별도로 처리

        // 태그 처리
        if (Object.keys(addTagsData).length > 0) {
          // 태그 추가 모드: 기존 태그 + 새 태그
          const newTags = addTagsData.addTags as string[];
          const mergedTags = [...new Set([...existingTags, ...newTags])]; // 기존 태그 + 새 태그, 중복 제거
          finalUpdateData.searchTags = mergedTags;
        } else if (updateData.searchTags) {
          // 태그 교체 모드: 기존 태그를 새 태그로 완전 교체
          finalUpdateData.searchTags = updateData.searchTags;
        }

        // 하나의 요청으로 모든 업데이트 수행
        if (Object.keys(finalUpdateData).length > 0) {
          await fetch(`/api/songdetails/${songId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(finalUpdateData)
          });
        }
      });
      
      await Promise.all(updatePromises);
      await loadSongs();
      setSelectedSongs(new Set());
      setBulkActionMode(null);
      setBulkUpdateData({ language: '', keyAdjustment: '', artistAlias: '', searchTags: '', addTags: '' });
      showToast(`${selectedSongs.size}곡의 정보가 업데이트되었습니다.`, 'success');
    } catch (error) {
      console.error('일괄 업데이트 실패:', error);
      showToast('일괄 업데이트에 실패했습니다.', 'error');
    }
  };

  // YouTube에서 MR 링크 검색
  const searchMRFromYouTube = async (title: string, artist: string) => {
    console.log('searchMRFromYouTube 호출:', { title, artist });
    
    try {
      const response = await fetch('/api/youtube-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, artist })
      });

      console.log('API 응답 상태:', response.status);
      
      const result = await response.json();
      console.log('API 응답 데이터:', result);
      
      if (result.success) {
        console.log('검색 성공, 결과 반환:', result.selectedResult);
        return result.selectedResult;
      } else {
        console.error('YouTube 검색 실패:', result.error);
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
    const songsWithoutMR = filteredSongs.filter(song => 
      !song.mrLinks || song.mrLinks.length === 0
    );

    if (songsWithoutMR.length === 0) {
      showToast('MR 링크가 없는 곡이 없습니다.', 'error');
      return;
    }

    const confirmMessage = `MR 링크가 없는 ${songsWithoutMR.length}곡에 대해 자동으로 YouTube에서 MR 링크를 검색하여 추가하시겠습니까?\n\n⚠️ 주의사항:\n• YouTube API 할당량 제한이 있습니다\n• 잘못된 MR이 연결될 수 있습니다`;
    
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

        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error) {
        errorCount++;
        console.error(`처리 중 오류:`, error);
      }
    }

    setBulkMRLoading(false);
    setBulkMRProgress({ current: 0, total: 0 });
    
    const message = `MR 링크 일괄 추가 ${quotaExceeded ? '중단' : '완료'}! 성공: ${successCount}곡, 실패: ${errorCount}곡${quotaExceeded ? ' (API 할당량 초과)' : ''}`;
    
    showToast(message, quotaExceeded ? 'error' : 'success');
    await loadSongs();
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

  // 모달 열기
  const openModal = (mode: 'edit' | 'create', song?: SongWithId) => {
    setModalMode(mode);
    setSelectedSong(song || null);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm rounded-xl p-6 border border-light-primary/20 dark:border-dark-primary/20">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-light-text dark:text-dark-text">노래 관리</h2>
            <p className="text-light-text/60 dark:text-dark-text/60 mt-1">
              총 {songs.length}곡 / 검색 결과 {filteredSongs.length}곡
              {selectedSongs.size > 0 && (
                <span className="ml-4 text-blue-600 dark:text-blue-400 font-medium">
                  | 선택됨: {selectedSongs.size}곡
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowBulkMRSection(!showBulkMRSection)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
            >
              🎵 MR 자동추가
            </button>
            <button
              onClick={() => openModal('create')}
              className="flex items-center gap-2 px-4 py-2 bg-light-accent dark:bg-dark-accent text-white rounded-lg hover:opacity-90 transition-opacity"
            >
              <PlusIcon className="w-4 h-4" />
              새 곡 추가
            </button>
          </div>
        </div>
      </div>

      {/* MR 자동 추가 섹션 */}
      {showBulkMRSection && (
        <div className="bg-green-50/50 dark:bg-green-900/20 rounded-xl p-6 border border-green-200/50 dark:border-green-800/50">
          <h3 className="text-lg font-semibold text-green-800 dark:text-green-200 mb-4">🎵 MR 링크 자동 추가</h3>
          
          {bulkMRLoading ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm text-green-700 dark:text-green-300">
                <span>진행 중: {bulkMRProgress.current} / {bulkMRProgress.total}</span>
                <span>{Math.round((bulkMRProgress.current / bulkMRProgress.total) * 100)}%</span>
              </div>
              <div className="w-full bg-green-200 dark:bg-green-800 rounded-full h-2">
                <div 
                  className="bg-green-600 dark:bg-green-400 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(bulkMRProgress.current / bulkMRProgress.total) * 100}%` }}
                />
              </div>
              <p className="text-sm text-green-600 dark:text-green-400">
                YouTube에서 MR을 검색하고 있습니다... 이 작업은 시간이 걸릴 수 있습니다.
              </p>
            </div>
          ) : (
            <div>
              <p className="text-green-700 dark:text-green-300 mb-4">
                MR 링크가 없는 곡들에 대해 YouTube에서 자동으로 MR을 검색하여 추가합니다.
                <br />
                <strong>주의:</strong> YouTube API 할당량 제한이 있으며, 잘못된 MR이 연결될 수 있습니다.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={bulkAddMRLinks}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                >
                  MR 자동 추가 시작
                </button>
                <button
                  onClick={() => setShowBulkMRSection(false)}
                  className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  취소
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Search and Actions */}
      <div className="bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm rounded-xl p-6 border border-light-primary/20 dark:border-dark-primary/20">
        <div className="flex flex-col lg:flex-row gap-4 justify-between">
          {/* 검색 */}
          <div className="flex flex-col sm:flex-row gap-3 flex-1">
            <div className="relative flex-1 max-w-md">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder={includeLyrics ? "제목, 아티스트, 별명, 태그, 가사로 검색..." : "제목, 아티스트, 별명, 태그로 검색..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 dark:border-gray-600 rounded-lg 
                           bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                           focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            {/* 가사 검색 옵션 */}
            <div className="flex items-center">
              <label className="inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeLyrics}
                  onChange={(e) => setIncludeLyrics(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 
                             dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 
                             dark:bg-gray-700 dark:border-gray-600"
                />
                <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                  가사 포함
                </span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* 일괄 작업 컨트롤 */}
      {selectedSongs.size > 0 && (
        <div className="bg-blue-50/50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200/50 dark:border-blue-700/50">
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    검색 태그 교체 (기존 태그 덮어쓰기)
                  </label>
                  <input
                    type="text"
                    value={bulkUpdateData.searchTags}
                    onChange={(e) => setBulkUpdateData(prev => ({ ...prev, searchTags: e.target.value }))}
                    placeholder="태그1, 태그2, 태그3 (쉼표로 구분, 빈 값이면 변경 안함)"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                               bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    태그 추가 (기존 태그 유지)
                  </label>
                  <input
                    type="text"
                    value={bulkUpdateData.addTags}
                    onChange={(e) => setBulkUpdateData(prev => ({ ...prev, addTags: e.target.value }))}
                    placeholder="추가할 태그들 (쉼표로 구분)"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                               bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    기존 태그는 그대로 두고 새로운 태그만 추가됩니다
                  </p>
                </div>
              </div>
              
              <div className="mt-4 flex gap-3">
                <button
                  onClick={bulkUpdateSongs}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium"
                >
                  업데이트 적용
                </button>
                <button
                  onClick={() => setBulkActionMode(null)}
                  className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium"
                >
                  취소
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Songs Table */}
      <div className="bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm rounded-xl border border-light-primary/20 dark:border-dark-primary/20 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-light-text/60 dark:text-dark-text/60">
            로딩 중...
          </div>
        ) : filteredSongs.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-light-primary/5 dark:bg-dark-primary/5">
                  <tr>
                    <th className="p-4 text-left">
                      <input
                        type="checkbox"
                        checked={selectedSongs.size === currentSongs.length && currentSongs.length > 0}
                        onChange={toggleAllSelection}
                        className="rounded border-light-primary/30 dark:border-dark-primary/30"
                      />
                    </th>
                    <th className="p-4 text-left text-light-text dark:text-dark-text font-medium">곡 정보</th>
                    <th className="p-4 text-left text-light-text dark:text-dark-text font-medium">아티스트</th>
                    <th className="p-4 text-left text-light-text dark:text-dark-text font-medium">설정</th>
                    <th className="p-4 text-left text-light-text dark:text-dark-text font-medium">추가 정보</th>
                    <th className="p-4 text-left text-light-text dark:text-dark-text font-medium">작업</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-light-primary/20 dark:divide-dark-primary/20">
                  {currentSongs.map((song) => (
                    <tr key={song._id} className="hover:bg-white/20 dark:hover:bg-gray-800/20 transition-colors">
                      <td className="p-4">
                        <input
                          type="checkbox"
                          checked={selectedSongs.has(song._id)}
                          onChange={() => toggleSongSelection(song._id)}
                          className="rounded border-light-primary/30 dark:border-dark-primary/30"
                        />
                      </td>
                      <td className="p-4">
                        <div className="font-medium text-light-text dark:text-dark-text">
                          {song.title || '제목 없음'}
                        </div>
                        {song.titleAlias && (
                          <div className="text-xs text-blue-600 dark:text-blue-400">
                            별명: {song.titleAlias}
                          </div>
                        )}
                        {song.searchTags && song.searchTags.length > 0 && (
                          <div className="text-xs text-gray-500 mt-1">
                            태그: {song.searchTags.join(', ')}
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="text-light-text/70 dark:text-dark-text/70">
                          {song.artist || '-'}
                        </div>
                        {song.artistAlias && (
                          <div className="text-xs text-blue-600 dark:text-blue-400">
                            별명: {song.artistAlias}
                          </div>
                        )}
                        {song.language && (
                          <div className="text-xs text-gray-500">
                            {song.language}
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="space-y-1 text-sm">
                          <div>키: {formatKeyAdjustment(song.keyAdjustment)}</div>
                          <div>
                            부른 횟수: {song.sungCount || 0}회
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="space-y-1 text-sm">
                          <div>
                            MR: {song.mrLinks?.length || 0}개
                          </div>
                          {song.lyrics && song.lyrics.trim().length > 0 && (
                            <div className="text-green-600">가사 있음</div>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openModal('edit', song)}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md transition-colors duration-200 flex items-center gap-1"
                            title="수정"
                          >
                            <PencilIcon className="h-4 w-4" />
                            수정
                          </button>
                          <button
                            onClick={() => deleteSong(song._id)}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded-md transition-colors duration-200 flex items-center gap-1"
                            title="삭제"
                          >
                            <TrashIcon className="h-4 w-4" />
                            삭제
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-light-primary/20 dark:border-dark-primary/20">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-light-text/60 dark:text-dark-text/60">
                    {startIndex + 1}-{Math.min(endIndex, filteredSongs.length)} / {filteredSongs.length}
                  </div>
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
              </div>
            )}
          </>
        ) : (
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
      </div>

      {/* Modal */}
      <SongDetailModal
        isOpen={isModalOpen}
        modalMode={modalMode}
        selectedSong={selectedSong}
        formData={formData}
        setFormData={setFormData}
        onClose={useCallback(() => setIsModalOpen(false), [])}
        onSubmit={useCallback(async (submitData: any) => {
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
            showToast(modalMode === 'create' ? '곡이 추가되었습니다.' : '곡이 수정되었습니다.', 'success');
          } else {
            const error = await response?.json();
            showToast(`오류: ${error?.error || '알 수 없는 오류가 발생했습니다.'}`, 'error');
          }
        }, [modalMode, selectedSong])}
        showToast={showToast}
        searchMRFromYouTube={searchMRFromYouTube}
      />

      {/* Toast 알림 */}
      {toast && (
        <div className="fixed top-20 right-4 z-[9999] animate-in slide-in-from-top-2 duration-300">
          <div
            className={`max-w-md px-4 py-3 rounded-lg shadow-lg border backdrop-blur-sm ${
              toast.type === 'success'
                ? 'bg-green-50/90 dark:bg-green-900/90 border-green-200 dark:border-green-700 text-green-800 dark:text-green-200'
                : 'bg-red-50/90 dark:bg-red-900/90 border-red-200 dark:border-red-700 text-red-800 dark:text-red-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {toast.type === 'success' ? (
                <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              )}
              <p className="text-sm font-medium">{toast.message}</p>
              <button
                onClick={() => setToast(null)}
                className="ml-auto flex-shrink-0 p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

}

// 곡 상세 모달 컴포넌트 - 부모 컴포넌트 밖으로 이동하여 재생성 방지
const SongDetailModal = React.memo(function SongDetailModal({
  isOpen,
  modalMode,
  selectedSong,
  formData,
  setFormData,
  onClose,
  onSubmit,
  showToast,
  searchMRFromYouTube
}: {
  isOpen: boolean;
  modalMode: 'edit' | 'create';
  selectedSong: SongWithId | null;
  formData: any;
  setFormData: React.Dispatch<React.SetStateAction<any>>;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  showToast: (message: string, type: 'success' | 'error') => void;
  searchMRFromYouTube: (title: string, artist: string) => Promise<any>;
}) {
  const [saving, setSaving] = useState(false);
  const [tagInput, setTagInput] = useState('');


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const submitData = {
        ...formData,
        searchTags: formData.searchTags.filter((tag: string) => tag.trim())
      };
      
      // 생성 모드에서는 부른 횟수와 마지막 부른 날짜 제외
      if (modalMode === 'create') {
        delete submitData.sungCount;
        delete submitData.lastSungDate;
      }

      await onSubmit(submitData);
    } catch (error) {
      console.error('저장 오류:', error);
      showToast('저장 중 오류가 발생했습니다.', 'error');
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
    setFormData(prev => {
      const newMRLinks = prev.mrLinks.filter((_, i) => i !== index);
      let newSelectedIndex = prev.selectedMRIndex;
      
      // 선택된 항목이 삭제되는 경우
      if (prev.selectedMRIndex === index) {
        newSelectedIndex = 0; // 첫 번째 항목으로 이동
      }
      // 선택된 항목보다 앞의 항목이 삭제되는 경우
      else if (prev.selectedMRIndex > index) {
        newSelectedIndex = prev.selectedMRIndex - 1; // 인덱스 조정
      }
      
      // MR 링크가 모두 삭제되는 경우
      if (newMRLinks.length === 0) {
        newSelectedIndex = 0;
      }
      // 선택된 인덱스가 범위를 벗어나는 경우
      else if (newSelectedIndex >= newMRLinks.length) {
        newSelectedIndex = newMRLinks.length - 1;
      }
      
      return {
        ...prev,
        mrLinks: newMRLinks,
        selectedMRIndex: newSelectedIndex
      };
    });
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) {
            const startTime = Date.now();
            const startX = e.clientX;
            const startY = e.clientY;
            
            const handleMouseUp = (upEvent: MouseEvent) => {
              const endTime = Date.now();
              const endX = upEvent.clientX;
              const endY = upEvent.clientY;
              
              // 드래그 감지 (거리 또는 시간으로 판단)
              const distance = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
              const duration = endTime - startTime;
              
              // 클릭으로 간주하는 조건: 이동거리 5px 이하, 시간 300ms 이하
              if (distance <= 5 && duration <= 300) {
                onClose();
              }
              
              document.removeEventListener('mouseup', handleMouseUp);
            };
            
            document.addEventListener('mouseup', handleMouseUp);
          }
        }}
      >
        <div 
          className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-5xl w-full max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              {modalMode === 'create' ? '새 곡 추가' : '곡 정보 수정'}
            </h3>
            <button
              onClick={onClose}
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
                  disabled={false}
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
                  disabled={false}
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
                  disabled={false}
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
                  disabled={false}
                  value={formData.artistAlias}
                  onChange={(e) => setFormData(prev => ({ ...prev, artistAlias: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                             bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                             disabled:bg-gray-50 dark:disabled:bg-gray-800"
                />
              </div>
            </div>

            {/* 언어 및 설정 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  언어
                </label>
                <select
                  disabled={false}
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
                  disabled={false}
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
            </div>

            {/* 부른 횟수 및 마지막 부른 날짜 (편집 모드에서만 표시) */}
            {modalMode !== 'create' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    부른 횟수
                  </label>
                  <input
                    type="number"
                    min="0"
                    disabled={false}
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
                    disabled={false}
                    value={formData.lastSungDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, lastSungDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                               bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                               disabled:bg-gray-50 dark:disabled:bg-gray-800"
                  />
                </div>
              </div>
            )}

            {/* 검색 태그 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                검색 태그
              </label>
              {(
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
                    {(
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    MR 링크
                  </label>
                  {formData.mrLinks.length > 1 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      여러 MR 중 하나를 선택하세요. 선택된 MR이 기본값으로 사용됩니다.
                    </p>
                  )}
                </div>
                {(
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        if (!formData.title || !formData.artist) {
                          alert('곡 제목과 아티스트를 먼저 입력해주세요.');
                          return;
                        }
                        
                        console.log('MR 검색 시작:', { title: formData.title, artist: formData.artist });
                        
                        try {
                          // 버튼을 비활성화하여 중복 클릭 방지
                          const button = document.activeElement as HTMLButtonElement;
                          if (button) button.disabled = true;
                          
                          const mrResult = await searchMRFromYouTube(formData.title, formData.artist);
                          console.log('MR 검색 결과:', mrResult);
                          
                          if (mrResult && mrResult !== 'QUOTA_EXCEEDED') {
                            console.log('MR 링크 추가 전 상태:', formData.mrLinks);
                            
                            const newMRLink = {
                              url: mrResult.url,
                              skipSeconds: 0,
                              label: `Auto-found: ${mrResult.title.substring(0, 30)}...`,
                              duration: ''
                            };
                            
                            console.log('MR 링크 추가 시도 - 현재 상태:', formData.mrLinks);
                            console.log('추가할 MR 링크:', newMRLink);
                            
                            // 상태 업데이트 함수를 사용하여 현재 상태를 기반으로 업데이트
                            setFormData(prevFormData => {
                              console.log('setFormData 콜백 진입 성공!');
                              console.log('이전 MR 링크 배열:', prevFormData.mrLinks);
                              
                              const newMRLinks = [...prevFormData.mrLinks, newMRLink];
                              console.log('새로운 MR 링크 배열:', newMRLinks);
                              
                              return {
                                ...prevFormData,
                                mrLinks: newMRLinks
                              };
                            });
                            
                            console.log('setFormData 호출 완료');
                            
                            showToast(`MR 링크를 찾았습니다! 제목: ${mrResult.title}`, 'success');
                          } else if (mrResult === 'QUOTA_EXCEEDED') {
                            console.log('YouTube API 할당량 초과');
                            showToast('YouTube API 할당량이 초과되었습니다. 나중에 다시 시도해주세요.', 'error');
                          } else {
                            console.log('MR 링크를 찾을 수 없음');
                            showToast('해당 곡의 MR 링크를 찾을 수 없습니다. 수동으로 추가해주세요.', 'error');
                          }
                        } catch (error) {
                          console.error('MR 검색 오류:', error);
                          showToast('MR 검색 중 오류가 발생했습니다. 네트워크 연결을 확인해주세요.', 'error');
                        } finally {
                          // 버튼 재활성화
                          const button = document.activeElement as HTMLButtonElement;
                          if (button) button.disabled = false;
                        }
                      }}
                      className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-md"
                    >
                      YouTube 검색
                    </button>
                    <button
                      type="button"
                      onClick={addMRLink}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md"
                    >
                      수동 추가
                    </button>
                  </div>
                )}
              </div>
              
              <div className="space-y-3 max-w-full overflow-hidden">
                {formData.mrLinks.map((link, index) => (
                  <div key={index} className={`p-3 border rounded-md transition-colors ${
                    formData.selectedMRIndex === index 
                      ? 'border-blue-500 dark:border-blue-400 bg-blue-50/50 dark:bg-blue-900/20' 
                      : 'border-gray-300 dark:border-gray-600'
                  }`}>
                    <div className="space-y-3">
                      {/* 선택 라디오 버튼과 헤더 */}
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="selectedMR"
                          checked={formData.selectedMRIndex === index}
                          onChange={() => setFormData(prev => ({ ...prev, selectedMRIndex: index }))}
                          className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                        />
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          MR #{index + 1} {formData.selectedMRIndex === index && '(선택됨)'}
                        </label>
                        {link.label && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            - {link.label}
                          </span>
                        )}
                      </div>

                      {/* URL - 전체 폭 사용 */}
                      <div>
                        <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">URL</label>
                        <input
                          type="url"
                          disabled={false}
                          value={link.url}
                          onChange={(e) => updateMRLink(index, 'url', e.target.value)}
                          placeholder="https://youtube.com/watch?v=..."
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md
                                     bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                                     disabled:bg-gray-50 dark:disabled:bg-gray-800"
                        />
                      </div>
                      
                      {/* 시작 시간, 라벨, 삭제 버튼 */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">시작 시간(초)</label>
                          <input
                            type="number"
                            min="0"
                            disabled={false}
                            value={link.skipSeconds}
                            onChange={(e) => updateMRLink(index, 'skipSeconds', parseInt(e.target.value) || 0)}
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md
                                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                                       disabled:bg-gray-50 dark:disabled:bg-gray-800"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">라벨</label>
                          <input
                            type="text"
                            disabled={false}
                            value={link.label}
                            onChange={(e) => updateMRLink(index, 'label', e.target.value)}
                            placeholder="MR 설명"
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md
                                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                                       disabled:bg-gray-50 dark:disabled:bg-gray-800"
                          />
                        </div>
                        <div className="flex items-end">
                          {(
                            <button
                              type="button"
                              onClick={() => removeMRLink(index)}
                              className="w-full px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-md transition-colors"
                              title="삭제"
                            >
                              삭제
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                
                {formData.mrLinks.length === 0 && (
                  <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
                    MR 링크가 없습니다.
                  </div>
                )}
              </div>
            </div>

            {/* 버튼 */}
            <div className="flex justify-end gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg"
              >
                취소
              </button>
              {(
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg"
                >
                  {saving ? '저장 중...' : modalMode === 'create' ? '추가' : '수정'}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    );
});