'use client';

import { useState, useEffect } from 'react';
import { SongData } from '@/types';
import { StarIcon, TrashIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface SongEditFormProps {
  song: SongData;
  isVisible: boolean;
  onSave: (updatedSong: SongData) => void;
  onCancel: () => void;
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

export default function SongEditForm({ song, isVisible, onSave, onCancel }: SongEditFormProps) {
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

  // 현재 표시되는 제목과 아티스트 (alias 우선)
  const displayTitle = song.titleAlias || song.title;
  const displayArtist = song.artistAlias || song.artist;

  // 편집 데이터 초기화
  const initializeEditData = () => {
    const mrLinks = song.mrLinks || [];
    setEditData({
      title: song.title || '',
      artist: song.artist || '',
      titleAlias: displayTitle,
      artistAlias: displayArtist,
      lyrics: song.lyrics || '',
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
  };

  // 컴포넌트가 보여질 때 데이터 초기화
  useEffect(() => {
    if (isVisible) {
      initializeEditData();
    }
  }, [isVisible, song]);

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
        alert('곡 정보가 성공적으로 수정되었습니다.');
      } else {
        alert(result.error || '저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('저장 오류:', error);
      alert('저장 중 오류가 발생했습니다.');
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

  if (!isVisible) return null;

  return (
    <div className="flex flex-col h-full min-h-0 p-4 sm:p-6">
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
      <div className="flex-1 overflow-y-auto space-y-6">
        {/* 제목과 아티스트 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-light-text/70 dark:text-dark-text/70 mb-2">
              제목 별칭
            </label>
            <input
              type="text"
              value={editData.titleAlias}
              onChange={(e) => setEditData({...editData, titleAlias: e.target.value})}
              className="w-full px-3 py-2 border border-light-primary/30 dark:border-dark-primary/30 rounded-lg 
                       bg-white dark:bg-gray-800 text-light-text dark:text-dark-text
                       focus:border-light-accent dark:focus:border-dark-accent outline-none"
              placeholder={song.title}
            />
            <p className="text-xs text-light-text/50 dark:text-dark-text/50 mt-1">
              원본: {song.title}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-light-text/70 dark:text-dark-text/70 mb-2">
              아티스트 별칭
            </label>
            <input
              type="text"
              value={editData.artistAlias}
              onChange={(e) => setEditData({...editData, artistAlias: e.target.value})}
              className="w-full px-3 py-2 border border-light-primary/30 dark:border-dark-primary/30 rounded-lg 
                       bg-white dark:bg-gray-800 text-light-text dark:text-dark-text
                       focus:border-light-accent dark:focus:border-dark-accent outline-none"
              placeholder={song.artist}
            />
            <p className="text-xs text-light-text/50 dark:text-dark-text/50 mt-1">
              원본: {song.artist}
            </p>
          </div>
        </div>

        {/* 언어와 키 조절 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-light-text/70 dark:text-dark-text/70 mb-2">
              언어
            </label>
            <select
              value={editData.language}
              onChange={(e) => setEditData({...editData, language: e.target.value})}
              className="w-full px-3 py-2 border border-light-primary/30 dark:border-dark-primary/30 rounded-lg 
                       bg-white dark:bg-gray-800 text-light-text dark:text-dark-text
                       focus:border-light-accent dark:focus:border-dark-accent outline-none"
            >
              <option value="">언어 선택</option>
              <option value="Korean">Korean</option>
              <option value="English">English</option>
              <option value="Japanese">Japanese</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-light-text/70 dark:text-dark-text/70 mb-2">
              키 조절
            </label>
            <input
              type="number"
              value={editData.keyAdjustment ?? ''}
              onChange={(e) => setEditData({...editData, keyAdjustment: e.target.value ? parseInt(e.target.value) : null})}
              className="w-full px-3 py-2 border border-light-primary/30 dark:border-dark-primary/30 rounded-lg 
                       bg-white dark:bg-gray-800 text-light-text dark:text-dark-text
                       focus:border-light-accent dark:focus:border-dark-accent outline-none"
              placeholder="키 조절 값"
              min="-12"
              max="12"
            />
          </div>
        </div>

        {/* 가사 */}
        <div>
          <label className="block text-sm font-medium text-light-text/70 dark:text-dark-text/70 mb-2">
            가사
          </label>
          <textarea
            value={editData.lyrics}
            onChange={(e) => setEditData({...editData, lyrics: e.target.value})}
            rows={8}
            className="w-full px-3 py-2 border border-light-primary/30 dark:border-dark-primary/30 rounded-lg 
                     bg-white dark:bg-gray-800 text-light-text dark:text-dark-text
                     focus:border-light-accent dark:focus:border-dark-accent outline-none resize-none"
            placeholder="가사를 입력하세요..."
          />
        </div>

        {/* 개인 노트 */}
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
      </div>
    </div>
  );
}