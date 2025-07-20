'use client';

import { useState } from 'react';
import { PlusIcon, TrashIcon, StarIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

interface MRLink {
  url: string;
  skipSeconds?: number;
  label?: string;
  duration?: string;
}

interface MRLinkManagerProps {
  mrLinks: MRLink[];
  selectedMRIndex: number;
  onMRLinksChange: (mrLinks: MRLink[]) => void;
  onSelectedMRIndexChange: (index: number) => void;
  isEditMode: boolean;
  songTitle?: string;
  songArtist?: string;
}

export default function MRLinkManager({ 
  mrLinks, 
  selectedMRIndex, 
  onMRLinksChange, 
  onSelectedMRIndexChange, 
  isEditMode,
  songTitle,
  songArtist 
}: MRLinkManagerProps) {

  // MR 링크 추가 함수
  const addMRLink = () => {
    const newLinks = [...mrLinks, { url: '', skipSeconds: 0, label: '', duration: '' }];
    onMRLinksChange(newLinks);
  };

  // MR 링크 제거 함수
  const removeMRLink = (index: number) => {
    if (mrLinks.length > 1) {
      const newLinks = mrLinks.filter((_, i) => i !== index);
      onMRLinksChange(newLinks);
      onSelectedMRIndexChange(Math.min(selectedMRIndex, newLinks.length - 1));
    }
  };

  // MR 링크 업데이트 함수
  const updateMRLink = (index: number, field: string, value: string | number) => {
    const updatedLinks = mrLinks.map((link, i) => 
      i === index ? { ...link, [field]: value } : link
    );
    onMRLinksChange(updatedLinks);
  };

  // 메인 MR 링크 설정 함수
  const setMainMRLink = (index: number) => {
    onSelectedMRIndexChange(index);
  };

  // MR 검색 함수
  const handleMRSearch = () => {
    const searchQuery = encodeURIComponent(`${songTitle} ${songArtist} karaoke MR`);
    const youtubeSearchUrl = `https://www.youtube.com/results?search_query=${searchQuery}`;
    window.open(youtubeSearchUrl, '_blank');
  };

  // 편집 모드가 아닐 때는 아무것도 표시하지 않음
  if (!isEditMode) {
    return null;
  }

  // 편집 모드일 때는 MR 링크 관리 UI 표시
  return (
    <div className="scrollable-content flex-1 space-y-4 overflow-y-auto min-h-0">
      {mrLinks.map((link, index) => (
        <div key={index} className="p-4 bg-light-primary/10 dark:bg-dark-primary/10 rounded-lg border border-light-primary/20 dark:border-dark-primary/20">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMainMRLink(index)}
                className={`p-1 rounded-full transition-colors duration-200 ${
                  selectedMRIndex === index
                    ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400'
                    : 'bg-gray-500/20 text-gray-600 dark:text-gray-400 hover:bg-gray-500/30'
                }`}
                title={selectedMRIndex === index ? "메인 MR" : "메인으로 설정"}
              >
                <StarIcon className="w-4 h-4" />
              </button>
              <span className="text-sm font-medium text-light-text/70 dark:text-dark-text/70">
                MR 링크 {index + 1}
                {selectedMRIndex === index && (
                  <span className="ml-2 text-xs text-yellow-600 dark:text-yellow-400">(메인)</span>
                )}
              </span>
            </div>
            {mrLinks.length > 1 && (
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
                className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-light-accent/50 dark:border-dark-accent/50 
                           rounded-md outline-none text-light-text dark:text-dark-text"
                placeholder="https://youtube.com/watch?v=..."
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-light-text/70 dark:text-dark-text/70 mb-1">시작 시간 (초)</label>
                <input
                  type="number"
                  value={link.skipSeconds}
                  onChange={(e) => updateMRLink(index, 'skipSeconds', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-light-accent/50 dark:border-dark-accent/50 
                             rounded-md outline-none text-light-text dark:text-dark-text"
                  min="0"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-light-text/70 dark:text-dark-text/70 mb-1">라벨</label>
                <input
                  type="text"
                  value={link.label}
                  onChange={(e) => updateMRLink(index, 'label', e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-light-accent/50 dark:border-dark-accent/50 
                             rounded-md outline-none text-light-text dark:text-dark-text"
                  placeholder="공식 MR"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-light-text/70 dark:text-dark-text/70 mb-1">길이</label>
                <input
                  type="text"
                  value={link.duration}
                  onChange={(e) => updateMRLink(index, 'duration', e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-light-accent/50 dark:border-dark-accent/50 
                             rounded-md outline-none text-light-text dark:text-dark-text"
                  placeholder="3:45"
                />
              </div>
            </div>
          </div>
        </div>
      ))}
      
      <div className="flex gap-2">
        <button
          onClick={addMRLink}
          className="flex-1 flex items-center justify-center gap-2 py-3 px-4 border-2 border-dashed 
                     border-light-accent/50 dark:border-dark-accent/50 rounded-lg
                     text-light-accent dark:text-dark-accent hover:bg-light-accent/10 dark:hover:bg-dark-accent/10
                     transition-colors duration-200"
        >
          <PlusIcon className="w-5 h-5" />
          <span>MR 링크 추가</span>
        </button>
        <button
          onClick={handleMRSearch}
          className="px-4 py-3 border-2 border-dashed 
                     border-blue-500/50 rounded-lg
                     text-blue-600 dark:text-blue-400 hover:bg-blue-500/10
                     transition-colors duration-200"
          title="YouTube에서 MR 검색"
        >
          <MagnifyingGlassIcon className="w-5 h-5" />
          <span className="hidden sm:inline ml-2">MR 검색</span>
        </button>
      </div>
    </div>
  );
}