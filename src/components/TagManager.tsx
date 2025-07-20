'use client';

import { useState } from 'react';
import { PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface TagManagerProps {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  isEditMode: boolean;
}

export default function TagManager({ tags, onTagsChange, isEditMode }: TagManagerProps) {
  const [newTag, setNewTag] = useState('');

  // 태그 추가 함수
  const addTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      onTagsChange([...tags, newTag.trim()]);
      setNewTag('');
    }
  };

  // 태그 제거 함수
  const removeTag = (tagToRemove: string) => {
    onTagsChange(tags.filter(tag => tag !== tagToRemove));
  };

  // 태그 키보드 이벤트 처리
  const handleTagKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  // 편집 모드가 아닐 때는 태그 표시만
  if (!isEditMode) {
    if (!tags || tags.length === 0) return null;
    
    return (
      <div className="flex flex-wrap gap-2">
        {tags.map((tag, index) => (
          <span
            key={index}
            className="px-2 py-1 text-xs bg-light-secondary/20 dark:bg-dark-secondary/20 
                     text-light-text/70 dark:text-dark-text/70 rounded-full"
          >
            #{tag}
          </span>
        ))}
      </div>
    );
  }

  // 편집 모드일 때는 태그 관리 UI 표시
  return (
    <div>
      <label className="block text-sm font-medium text-light-text/70 dark:text-dark-text/70 mb-2">
        검색 태그
      </label>
      <div className="space-y-3">
        {/* 새 태그 추가 */}
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyPress={handleTagKeyPress}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 
                       border border-light-accent/50 dark:border-dark-accent/50 
                       rounded-lg outline-none text-light-text dark:text-dark-text
                       focus:border-light-accent dark:focus:border-dark-accent
                       focus:ring-1 focus:ring-light-accent dark:focus:ring-dark-accent"
              placeholder="새 태그 입력 (Enter로 추가)"
            />
          </div>
          <button
            onClick={addTag}
            disabled={!newTag.trim() || tags.includes(newTag.trim())}
            className="px-3 py-2 rounded-lg bg-light-accent/20 hover:bg-light-accent/30 
                     dark:bg-dark-accent/20 dark:hover:bg-dark-accent/30
                     transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed
                     text-light-accent dark:text-dark-accent"
            title="태그 추가"
          >
            <PlusIcon className="w-4 h-4" />
          </button>
        </div>
        
        {/* 기존 태그들 */}
        <div className="flex flex-wrap gap-2">
          {tags.map((tag, index) => (
            <div
              key={index}
              className="flex items-center gap-1 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900 
                       text-blue-800 dark:text-blue-200 text-sm"
            >
              <span>#{tag}</span>
              <button
                onClick={() => removeTag(tag)}
                className="p-0.5 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800 
                         transition-colors duration-200"
                title="태그 삭제"
              >
                <XMarkIcon className="w-3 h-3" />
              </button>
            </div>
          ))}
          {tags.length === 0 && (
            <span className="text-light-text/50 dark:text-dark-text/50 text-sm italic">
              검색 태그가 없습니다
            </span>
          )}
        </div>
      </div>
    </div>
  );
}