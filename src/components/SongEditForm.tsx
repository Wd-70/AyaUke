'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { SongData } from '@/types';
import { StarIcon, TrashIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useToast } from './Toast';

interface SongEditFormProps {
  song: SongData;
  isVisible: boolean;
  onSave: (updatedSong: SongData) => void;
  onCancel: () => void;
  onLyricsChange?: (lyrics: string) => void; // 왼쪽 가사 패널과 동기화용
  initialLyrics?: string; // 왼쪽 패널의 현재 가사 텍스트
}

interface EditData {
  title: string;
  artist: string;
  titleAlias: string;
  artistAlias: string;
  lyrics: string;
  personalNotes: string;
  keyAdjustment: number | null;
  language: string;
  searchTags: string[];
  mrLinks: Array<{
    url: string;
    skipSeconds?: number;
    label?: string;
    duration?: string;
  }>;
  selectedMRIndex: number;
}

export default function SongEditForm({ song, isVisible, onSave, onCancel, onLyricsChange, initialLyrics }: SongEditFormProps) {
  const { showSuccess, showError } = useToast();
  const [editData, setEditData] = useState<EditData>({
    title: '',
    artist: '',
    titleAlias: '',
    artistAlias: '',
    lyrics: '',
    personalNotes: '',
    keyAdjustment: null,
    language: '',
    searchTags: [],
    mrLinks: [],
    selectedMRIndex: 0,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [keyAdjustmentWidth, setKeyAdjustmentWidth] = useState(0);
  const keyAdjustmentRef = useRef<HTMLDivElement>(null);
  const [languageWidth, setLanguageWidth] = useState(0);
  const languageRef = useRef<HTMLDivElement>(null);
  const lastSyncedLyricsRef = useRef<string>('');

  // 현재 표시되는 제목과 아티스트 (alias 우선)
  const displayTitle = song.titleAlias || song.title;
  const displayArtist = song.artistAlias || song.artist;

  // 편집 데이터 초기화
  const initializeEditData = useCallback(() => {
    const mrLinks = song.mrLinks || [];
    const lyricsValue = initialLyrics || song.lyrics || '';
    setEditData({
      title: song.title || '',
      artist: song.artist || '',
      titleAlias: displayTitle,
      artistAlias: displayArtist,
      lyrics: lyricsValue,
      personalNotes: song.personalNotes || '',
      keyAdjustment: song.keyAdjustment ?? null,
      language: song.language || '',
      searchTags: song.searchTags || [],
      mrLinks: mrLinks.length > 0 ? mrLinks.map(link => ({
        url: link.url || '',
        skipSeconds: link.skipSeconds || 0,
        label: link.label || '',
        duration: link.duration || '',
      })) : [{ url: '', skipSeconds: 0, label: '', duration: '' }],
      selectedMRIndex: song.selectedMRIndex || 0,
    });
    // 초기화 시점의 가사를 기록
    lastSyncedLyricsRef.current = lyricsValue;
  }, [song, displayTitle, displayArtist]);

  // 컴포넌트가 보여질 때 데이터 초기화
  useEffect(() => {
    if (isVisible) {
      initializeEditData();
    }
  }, [isVisible, initializeEditData]);

  // 가사 변경 핸들러 (직접 호출용)
  const handleLyricsTextChange = useCallback((newLyrics: string) => {
    setEditData(prev => ({ ...prev, lyrics: newLyrics }));
    // 왼쪽 패널에 동기화 (useEffect 없이 직접 호출)
    if (onLyricsChange && newLyrics !== lastSyncedLyricsRef.current) {
      lastSyncedLyricsRef.current = newLyrics;
      onLyricsChange(newLyrics);
    }
  }, [onLyricsChange]);

  // initialLyrics가 변경되면 editData도 업데이트 (왼쪽 패널에서 직접 수정한 경우)
  useEffect(() => {
    if (initialLyrics !== undefined && initialLyrics !== editData.lyrics) {
      setEditData(prev => ({ ...prev, lyrics: initialLyrics }));
      lastSyncedLyricsRef.current = initialLyrics;
    }
  }, [initialLyrics]);

  // 키 조절 컨테이너 너비 감지
  useEffect(() => {
    if (!keyAdjustmentRef.current) return;

    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        setKeyAdjustmentWidth(width);
      }
    });

    resizeObserver.observe(keyAdjustmentRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [isVisible]);

  // 언어 선택 컨테이너 너비 감지
  useEffect(() => {
    if (!languageRef.current) return;

    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        setLanguageWidth(width);
      }
    });

    resizeObserver.observe(languageRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [isVisible]);

  // 태그 관리 함수들
  const addTag = () => {
    if (newTag.trim() && !editData.searchTags.includes(newTag.trim())) {
      setEditData({
        ...editData,
        searchTags: [...editData.searchTags, newTag.trim()]
      });
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setEditData({
      ...editData,
      searchTags: editData.searchTags.filter(tag => tag !== tagToRemove)
    });
  };

  const handleTagKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  // MR 링크 관리 함수들
  const addMRLink = () => {
    setEditData({
      ...editData,
      mrLinks: [...editData.mrLinks, { url: '', skipSeconds: 0, label: '', duration: '' }]
    });
  };

  const removeMRLink = (index: number) => {
    if (editData.mrLinks.length > 1) {
      const newLinks = editData.mrLinks.filter((_, i) => i !== index);
      setEditData({
        ...editData,
        mrLinks: newLinks,
        selectedMRIndex: Math.min(editData.selectedMRIndex, newLinks.length - 1)
      });
    }
  };

  const updateMRLink = (index: number, field: string, value: string | number) => {
    const updatedLinks = editData.mrLinks.map((link, i) => 
      i === index ? { ...link, [field]: value } : link
    );
    setEditData({
      ...editData,
      mrLinks: updatedLinks
    });
  };

  const setMainMRLink = (index: number) => {
    setEditData({
      ...editData,
      selectedMRIndex: index
    });
  };

  // 편집 데이터 저장
  const saveEditData = async () => {
    if (!song.id) return;
    
    setIsSaving(true);
    try {
      // 저장할 데이터 준비 - alias 로직 처리
      const saveData = {
        ...editData,
        titleAlias: (!editData.titleAlias.trim() || editData.titleAlias.trim() === song.title.trim()) ? null : editData.titleAlias.trim(),
        artistAlias: (!editData.artistAlias.trim() || editData.artistAlias.trim() === song.artist.trim()) ? null : editData.artistAlias.trim(),
        mrLinks: editData.mrLinks.filter(link => link.url.trim() !== ''),
      };
      
      // 기본값은 제거 (수정 불가능)
      delete saveData.title;
      delete saveData.artist;

      console.log('🚀 저장할 데이터:', JSON.stringify(saveData, null, 2));

      const response = await fetch(`/api/songdetails/${song.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(saveData),
      });

      const result = await response.json();

      if (result.success) {
        console.log('✅ 저장 성공, 반환된 데이터:', result.song);
        onSave(result.song);
        showSuccess('수정 완료', '곡 정보가 성공적으로 수정되었습니다.');
      } else {
        showError('저장 실패', result.error || '저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('저장 오류:', error);
      showError('저장 오류', '저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 편집 취소
  const handleCancel = () => {
    onCancel();
    initializeEditData();
  };

  const languageColors = {
    Korean: 'bg-blue-500',
    English: 'bg-purple-500',
    Japanese: 'bg-pink-500',
  };

  // 키 조절 레이아웃 결정: 320px 이상이면 한 줄 레이아웃 사용
  const useHorizontalLayout = keyAdjustmentWidth >= 320;

  // 언어 선택 레이아웃 결정
  // 500px 이상: 4개/줄, 250px-500px: 2개/줄, 250px 미만: 1개/줄
  const getLanguageGridCols = () => {
    if (languageWidth >= 500) return 4; // 1줄에 4개
    if (languageWidth >= 250) return 2; // 2줄에 2개씩
    return 1; // 4줄에 1개씩
  };

  if (!isVisible) return null;

  return (
    <div className="flex flex-col h-full min-h-0 xl:pb-0 pb-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold text-light-text dark:text-dark-text">
          곡 정보 편집
        </h3>
        <div className="flex gap-2">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
          >
            취소
          </button>
          <button
            onClick={saveEditData}
            disabled={isSaving}
            className="px-4 py-2 bg-light-accent dark:bg-dark-accent text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isSaving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>

      {/* 편집 폼 */}
      <div className="flex-1 xl:overflow-visible xl:h-auto overflow-y-auto space-y-6">
        {/* 기본 정보 */}
        <div className="bg-light-primary/5 dark:bg-dark-primary/5 rounded-xl p-4 space-y-4">
          
          {/* 제목과 아티스트 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm font-medium text-light-text/80 dark:text-dark-text/80">
                <div className="w-2 h-2 bg-light-accent dark:bg-dark-accent rounded-full"></div>
                제목
              </label>
              <input
                type="text"
                value={editData.titleAlias}
                onChange={(e) => setEditData({...editData, titleAlias: e.target.value})}
                className="w-full px-4 py-3 border border-light-primary/20 dark:border-dark-primary/20 rounded-xl 
                         bg-white/80 dark:bg-gray-800/80 text-light-text dark:text-dark-text
                         focus:border-light-accent dark:focus:border-dark-accent focus:ring-2 focus:ring-light-accent/20 dark:focus:ring-dark-accent/20
                         transition-all outline-none backdrop-blur-sm"
                placeholder="제목을 입력하세요"
              />
            </div>
            
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm font-medium text-light-text/80 dark:text-dark-text/80">
                <div className="w-2 h-2 bg-light-accent dark:bg-dark-accent rounded-full"></div>
                아티스트
              </label>
              <input
                type="text"
                value={editData.artistAlias}
                onChange={(e) => setEditData({...editData, artistAlias: e.target.value})}
                className="w-full px-4 py-3 border border-light-primary/20 dark:border-dark-primary/20 rounded-xl 
                         bg-white/80 dark:bg-gray-800/80 text-light-text dark:text-dark-text
                         focus:border-light-accent dark:focus:border-dark-accent focus:ring-2 focus:ring-light-accent/20 dark:focus:ring-dark-accent/20
                         transition-all outline-none backdrop-blur-sm"
                placeholder="아티스트를 입력하세요"
              />
            </div>
          </div>

          {/* 언어와 키 조절 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm font-medium text-light-text/80 dark:text-dark-text/80">
                <div className="w-2 h-2 bg-light-secondary dark:bg-dark-secondary rounded-full"></div>
                언어
              </label>
              <div 
                ref={languageRef}
                className={`grid gap-2`}
                style={{ gridTemplateColumns: `repeat(${getLanguageGridCols()}, 1fr)` }}
              >
                {[
                  { value: 'Korean', label: '🇰🇷 Korean', color: 'bg-blue-500' },
                  { value: 'English', label: '🇺🇸 English', color: 'bg-purple-500' },
                  { value: 'Japanese', label: '🇯🇵 Japanese', color: 'bg-pink-500' },
                  { value: 'Chinese', label: '🇨🇳 Chinese', color: 'bg-red-500' }
                ].map((lang) => (
                  <button
                    key={lang.value}
                    type="button"
                    onClick={() => setEditData({...editData, language: editData.language === lang.value ? '' : lang.value})}
                    className={`w-full px-3 py-2 rounded-lg border transition-all duration-200 text-sm font-medium text-center ${
                      editData.language === lang.value
                        ? `${lang.color} text-white border-transparent shadow-md scale-105`
                        : 'bg-white/80 dark:bg-gray-800/80 text-light-text/70 dark:text-dark-text/70 border-light-primary/20 dark:border-dark-primary/20 hover:border-light-accent dark:hover:border-dark-accent hover:bg-light-primary/10 dark:hover:bg-dark-primary/10'
                    }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm font-medium text-light-text/80 dark:text-dark-text/80">
                <div className="w-2 h-2 bg-light-secondary dark:bg-dark-secondary rounded-full"></div>
                키 조절
              </label>
              <div 
                ref={keyAdjustmentRef}
                className={useHorizontalLayout ? "flex items-center gap-2" : "flex flex-col gap-2"}
              >
                {/* 키 조절 컨트롤 */}
                <div className="flex items-center gap-2 bg-white/50 dark:bg-gray-800/50 rounded-lg p-2 border border-light-primary/20 dark:border-dark-primary/20 flex-1">
                  <button
                    type="button"
                    onClick={() => setEditData({
                      ...editData,
                      keyAdjustment: editData.keyAdjustment === null ? -1 : Math.max(-12, editData.keyAdjustment - 1)
                    })}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-light-accent/10 dark:bg-dark-accent/10 hover:bg-light-accent/20 dark:hover:bg-dark-accent/20 transition-colors duration-200 text-light-accent dark:text-dark-accent"
                    title="키 내리기"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                    </svg>
                  </button>
                  
                  <div className="flex-1 text-center">
                    <div className="text-xs font-medium text-light-text dark:text-dark-text">
                      {editData.keyAdjustment === null ? '설정없음' : 
                       editData.keyAdjustment === 0 ? '원본키' : 
                       `${editData.keyAdjustment > 0 ? '+' : ''}${editData.keyAdjustment}`}
                    </div>
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => setEditData({
                      ...editData,
                      keyAdjustment: editData.keyAdjustment === null ? 1 : Math.min(12, editData.keyAdjustment + 1)
                    })}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-light-accent/10 dark:bg-dark-accent/10 hover:bg-light-accent/20 dark:hover:bg-dark-accent/20 transition-colors duration-200 text-light-accent dark:text-dark-accent"
                    title="키 올리기"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>
                
                {/* 프리셋 버튼들 */}
                <div className={`flex gap-2 flex-shrink-0 ${useHorizontalLayout ? 'justify-end' : 'justify-center'}`}>
                  <button
                    type="button"
                    onClick={() => setEditData({...editData, keyAdjustment: 0})}
                    className={`px-2 py-1 text-xs rounded transition-colors duration-200 ${
                      editData.keyAdjustment === 0
                        ? 'bg-light-accent dark:bg-dark-accent text-white'
                        : 'bg-light-primary/10 dark:bg-dark-primary/10 text-light-text/70 dark:text-dark-text/70 hover:bg-light-primary/20 dark:hover:bg-dark-primary/20'
                    }`}
                    title="원본키"
                  >
                    원본
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditData({...editData, keyAdjustment: null})}
                    className={`px-2 py-1 text-xs rounded transition-colors duration-200 ${
                      editData.keyAdjustment === null
                        ? 'bg-gray-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                    title="미설정"
                  >
                    미설정
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 검색 태그 */}
        <div>
          <label className="block text-sm font-medium text-light-text/70 dark:text-dark-text/70 mb-2">
            검색 태그
          </label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyPress={handleTagKeyPress}
              className="flex-1 px-3 py-2 border border-light-primary/30 dark:border-dark-primary/30 rounded-lg 
                       bg-white dark:bg-gray-800 text-light-text dark:text-dark-text
                       focus:border-light-accent dark:focus:border-dark-accent outline-none"
              placeholder="태그 추가..."
            />
            <button
              onClick={addTag}
              className="px-4 py-2 bg-light-accent dark:bg-dark-accent text-white rounded-lg hover:opacity-90 transition-opacity"
            >
              <PlusIcon className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {editData.searchTags.map((tag, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1 px-2 py-1 bg-light-primary/20 dark:bg-dark-primary/20 
                         text-light-text dark:text-dark-text rounded-full text-sm"
              >
                {tag}
                <button
                  onClick={() => removeTag(tag)}
                  className="hover:text-red-500 transition-colors"
                >
                  <XMarkIcon className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* 가사 - XL 화면에서는 숨김 (왼쪽에 별도 가사 수정란 있음) */}
        <div className="xl:hidden">
          <label className="block text-sm font-medium text-light-text/70 dark:text-dark-text/70 mb-2">
            가사
          </label>
          <textarea
            value={editData.lyrics}
            onChange={(e) => handleLyricsTextChange(e.target.value)}
            rows={16}
            className="w-full px-3 py-2 border border-light-primary/30 dark:border-dark-primary/30 rounded-lg 
                     bg-white dark:bg-gray-800 text-light-text dark:text-dark-text
                     focus:border-light-accent dark:focus:border-dark-accent outline-none resize-none"
            placeholder="가사를 입력하세요..."
          />
        </div>

        {/* MR 링크 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-light-text/70 dark:text-dark-text/70">
              MR 링크
            </label>
            <button
              onClick={addMRLink}
              className="px-3 py-1 bg-light-accent dark:bg-dark-accent text-white rounded-lg hover:opacity-90 transition-opacity text-sm"
            >
              <PlusIcon className="w-4 h-4 inline mr-1" />
              추가
            </button>
          </div>
          <div className="space-y-3">
            {editData.mrLinks.map((link, index) => (
              <div key={index} className="p-4 bg-light-primary/10 dark:bg-dark-primary/10 rounded-lg border border-light-primary/20 dark:border-dark-primary/20">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setMainMRLink(index)}
                      className={`p-1 rounded-full transition-colors duration-200 ${
                        editData.selectedMRIndex === index
                          ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400'
                          : 'bg-gray-500/20 text-gray-600 dark:text-gray-400 hover:bg-gray-500/30'
                      }`}
                      title={editData.selectedMRIndex === index ? "메인 MR" : "메인으로 설정"}
                    >
                      <StarIcon className="w-4 h-4" />
                    </button>
                    <span className="text-sm font-medium text-light-text/70 dark:text-dark-text/70">
                      MR 링크 {index + 1}
                      {editData.selectedMRIndex === index && (
                        <span className="ml-2 text-xs text-yellow-600 dark:text-yellow-400">(메인)</span>
                      )}
                    </span>
                  </div>
                  {editData.mrLinks.length > 1 && (
                    <button
                      onClick={() => removeMRLink(index)}
                      className="p-1 rounded-full bg-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-500/30 transition-colors duration-200"
                      title="삭제"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-light-text/70 dark:text-dark-text/70 mb-1">URL</label>
                    <input
                      type="url"
                      value={link.url}
                      onChange={(e) => updateMRLink(index, 'url', e.target.value)}
                      className="w-full px-3 py-2 border border-light-primary/30 dark:border-dark-primary/30 rounded-lg 
                               bg-white dark:bg-gray-800 text-light-text dark:text-dark-text text-sm
                               focus:border-light-accent dark:focus:border-dark-accent outline-none"
                      placeholder="https://www.youtube.com/watch?v=..."
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-light-text/70 dark:text-dark-text/70 mb-1">스킵 시간 (초)</label>
                      <input
                        type="number"
                        value={link.skipSeconds || 0}
                        onChange={(e) => updateMRLink(index, 'skipSeconds', parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-light-primary/30 dark:border-dark-primary/30 rounded-lg 
                                 bg-white dark:bg-gray-800 text-light-text dark:text-dark-text text-sm
                                 focus:border-light-accent dark:focus:border-dark-accent outline-none"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-light-text/70 dark:text-dark-text/70 mb-1">라벨</label>
                      <input
                        type="text"
                        value={link.label || ''}
                        onChange={(e) => updateMRLink(index, 'label', e.target.value)}
                        className="w-full px-3 py-2 border border-light-primary/30 dark:border-dark-primary/30 rounded-lg 
                                 bg-white dark:bg-gray-800 text-light-text dark:text-dark-text text-sm
                                 focus:border-light-accent dark:focus:border-dark-accent outline-none"
                        placeholder="예: 남성키"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-light-text/70 dark:text-dark-text/70 mb-1">길이</label>
                      <input
                        type="text"
                        value={link.duration || ''}
                        onChange={(e) => updateMRLink(index, 'duration', e.target.value)}
                        className="w-full px-3 py-2 border border-light-primary/30 dark:border-dark-primary/30 rounded-lg 
                                 bg-white dark:bg-gray-800 text-light-text dark:text-dark-text text-sm
                                 focus:border-light-accent dark:focus:border-dark-accent outline-none"
                        placeholder="예: 3:45"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 개인 노트 - 가장 아래쪽으로 이동 */}
        <div>
          <label className="block text-sm font-medium text-light-text/70 dark:text-dark-text/70 mb-2">
            개인 노트
          </label>
          <textarea
            value={editData.personalNotes}
            onChange={(e) => setEditData({...editData, personalNotes: e.target.value})}
            rows={4}
            className="w-full px-3 py-2 border border-light-primary/30 dark:border-dark-primary/30 rounded-lg 
                     bg-white dark:bg-gray-800 text-light-text dark:text-dark-text
                     focus:border-light-accent dark:focus:border-dark-accent outline-none resize-none"
            placeholder="개인적인 노트나 메모를 입력하세요..."
          />
        </div>
      </div>
    </div>
  );
}