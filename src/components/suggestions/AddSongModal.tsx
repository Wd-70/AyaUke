'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XMarkIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { MRLink } from '@/types';

interface AddSongModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSongAdded: () => void;
}

export default function AddSongModal({ isOpen, onClose, onSongAdded }: AddSongModalProps) {
  const [formData, setFormData] = useState({
    title: '',
    artist: '',
    description: '',
    lyrics: '',
    searchTags: [] as string[],
    genre: '',
    language: '',
    difficulty: '',
    duration: '',
    releaseYear: '',
    keyAdjustment: null as number | null,
    mrLinks: [] as MRLink[],
    selectedMRIndex: 0,
    originalTrackUrl: '',
    lyricsUrl: ''
  });

  const [searchTagInput, setSearchTagInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAddTag = (type: 'searchTags', input: string, setInput: (value: string) => void) => {
    if (input.trim() && !formData[type].includes(input.trim())) {
      setFormData(prev => ({
        ...prev,
        [type]: [...prev[type], input.trim()]
      }));
      setInput('');
    }
  };

  const handleRemoveTag = (type: 'searchTags', index: number) => {
    setFormData(prev => ({
      ...prev,
      [type]: prev[type].filter((_, i) => i !== index)
    }));
  };

  const handleAddMRLink = () => {
    setFormData(prev => ({
      ...prev,
      mrLinks: [...prev.mrLinks, { url: '', skipSeconds: 0, label: '', duration: '' }]
    }));
  };

  const handleUpdateMRLink = (index: number, field: keyof MRLink, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      mrLinks: prev.mrLinks.map((link, i) =>
        i === index ? { ...link, [field]: value } : link
      )
    }));
  };

  const handleRemoveMRLink = (index: number) => {
    setFormData(prev => ({
      ...prev,
      mrLinks: prev.mrLinks.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !formData.artist) {
      alert('제목과 아티스트는 필수 입력 항목입니다.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/suggestions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '노래 추가에 실패했습니다.');
      }

      onSongAdded();
      resetForm();
    } catch (error) {
      console.error('노래 추가 오류:', error);
      alert(error instanceof Error ? error.message : '노래 추가에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      artist: '',
      description: '',
      lyrics: '',
      searchTags: [],
      genre: '',
      language: '',
      difficulty: '',
      duration: '',
      releaseYear: '',
      keyAdjustment: null,
      mrLinks: [],
      selectedMRIndex: 0,
      originalTrackUrl: '',
      lyricsUrl: ''
    });
    setSearchTagInput('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white dark:bg-gray-900 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-light-text dark:text-dark-text">
                새 노래 추천
              </h2>
              <button
                onClick={handleClose}
                className="p-2 hover:bg-light-primary/10 dark:hover:bg-dark-primary/10 rounded-lg transition-colors"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* 기본 정보 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-light-text dark:text-dark-text mb-2">
                    제목 *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    className="w-full px-4 py-3 bg-light-primary/5 dark:bg-dark-primary/5 border border-light-primary/20 dark:border-dark-primary/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-light-accent/50 dark:focus:ring-dark-accent/50"
                    placeholder="노래 제목을 입력하세요"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-light-text dark:text-dark-text mb-2">
                    아티스트 *
                  </label>
                  <input
                    type="text"
                    value={formData.artist}
                    onChange={(e) => handleInputChange('artist', e.target.value)}
                    className="w-full px-4 py-3 bg-light-primary/5 dark:bg-dark-primary/5 border border-light-primary/20 dark:border-dark-primary/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-light-accent/50 dark:focus:ring-dark-accent/50"
                    placeholder="아티스트명을 입력하세요"
                  />
                </div>
              </div>

              {/* 추천 이유 */}
              <div>
                <label className="block text-sm font-medium text-light-text dark:text-dark-text mb-2">
                  추천 이유
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 bg-light-primary/5 dark:bg-dark-primary/5 border border-light-primary/20 dark:border-dark-primary/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-light-accent/50 dark:focus:ring-dark-accent/50"
                  placeholder="이 노래를 추천하는 이유를 알려주세요"
                />
              </div>

              {/* 메타데이터 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-light-text dark:text-dark-text mb-2">
                    장르
                  </label>
                  <select
                    value={formData.genre}
                    onChange={(e) => handleInputChange('genre', e.target.value)}
                    className="w-full px-4 py-3 bg-light-primary/5 dark:bg-gray-800 border border-light-primary/20 dark:border-dark-primary/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-light-accent/50 dark:focus:ring-dark-accent/50 text-light-text dark:text-dark-text"
                  >
                    <option value="" className="bg-white dark:bg-gray-800 text-light-text dark:text-dark-text">선택하세요</option>
                    <option value="K-pop" className="bg-white dark:bg-gray-800 text-light-text dark:text-dark-text">K-pop</option>
                    <option value="J-pop" className="bg-white dark:bg-gray-800 text-light-text dark:text-dark-text">J-pop</option>
                    <option value="Pop" className="bg-white dark:bg-gray-800 text-light-text dark:text-dark-text">Pop</option>
                    <option value="Rock" className="bg-white dark:bg-gray-800 text-light-text dark:text-dark-text">Rock</option>
                    <option value="Ballad" className="bg-white dark:bg-gray-800 text-light-text dark:text-dark-text">Ballad</option>
                    <option value="R&B" className="bg-white dark:bg-gray-800 text-light-text dark:text-dark-text">R&B</option>
                    <option value="Hip-hop" className="bg-white dark:bg-gray-800 text-light-text dark:text-dark-text">Hip-hop</option>
                    <option value="Folk" className="bg-white dark:bg-gray-800 text-light-text dark:text-dark-text">Folk</option>
                    <option value="Indie" className="bg-white dark:bg-gray-800 text-light-text dark:text-dark-text">Indie</option>
                    <option value="Electronic" className="bg-white dark:bg-gray-800 text-light-text dark:text-dark-text">Electronic</option>
                    <option value="Jazz" className="bg-white dark:bg-gray-800 text-light-text dark:text-dark-text">Jazz</option>
                    <option value="Classical" className="bg-white dark:bg-gray-800 text-light-text dark:text-dark-text">Classical</option>
                    <option value="OST" className="bg-white dark:bg-gray-800 text-light-text dark:text-dark-text">OST</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-light-text dark:text-dark-text mb-2">
                    언어
                  </label>
                  <select
                    value={formData.language}
                    onChange={(e) => handleInputChange('language', e.target.value)}
                    className="w-full px-4 py-3 bg-light-primary/5 dark:bg-gray-800 border border-light-primary/20 dark:border-dark-primary/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-light-accent/50 dark:focus:ring-dark-accent/50 text-light-text dark:text-dark-text"
                  >
                    <option value="" className="bg-white dark:bg-gray-800 text-light-text dark:text-dark-text">선택하세요</option>
                    <option value="한국어" className="bg-white dark:bg-gray-800 text-light-text dark:text-dark-text">한국어</option>
                    <option value="일본어" className="bg-white dark:bg-gray-800 text-light-text dark:text-dark-text">일본어</option>
                    <option value="영어" className="bg-white dark:bg-gray-800 text-light-text dark:text-dark-text">영어</option>
                    <option value="중국어" className="bg-white dark:bg-gray-800 text-light-text dark:text-dark-text">중국어</option>
                    <option value="기타" className="bg-white dark:bg-gray-800 text-light-text dark:text-dark-text">기타</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-light-text dark:text-dark-text mb-2">
                    난이도
                  </label>
                  <select
                    value={formData.difficulty}
                    onChange={(e) => handleInputChange('difficulty', e.target.value)}
                    className="w-full px-4 py-3 bg-light-primary/5 dark:bg-gray-800 border border-light-primary/20 dark:border-dark-primary/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-light-accent/50 dark:focus:ring-dark-accent/50 text-light-text dark:text-dark-text"
                  >
                    <option value="" className="bg-white dark:bg-gray-800 text-light-text dark:text-dark-text">선택하세요</option>
                    <option value="쉬움" className="bg-white dark:bg-gray-800 text-light-text dark:text-dark-text">쉬움</option>
                    <option value="보통" className="bg-white dark:bg-gray-800 text-light-text dark:text-dark-text">보통</option>
                    <option value="어려움" className="bg-white dark:bg-gray-800 text-light-text dark:text-dark-text">어려움</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-light-text dark:text-dark-text mb-2">
                    발매년도
                  </label>
                  <input
                    type="text"
                    value={formData.releaseYear}
                    onChange={(e) => handleInputChange('releaseYear', e.target.value)}
                    className="w-full px-4 py-3 bg-light-primary/5 dark:bg-dark-primary/5 border border-light-primary/20 dark:border-dark-primary/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-light-accent/50 dark:focus:ring-dark-accent/50"
                    placeholder="2024"
                  />
                </div>
              </div>

              {/* 검색 태그 */}
              <div>
                <label className="block text-sm font-medium text-light-text dark:text-dark-text mb-2">
                  검색 태그
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {formData.searchTags.map((tag, index) => (
                    <span
                      key={index}
                      className="flex items-center gap-1 px-3 py-1 bg-light-accent/20 dark:bg-dark-accent/20 text-sm rounded-full"
                    >
                      #{tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag('searchTags', index)}
                        className="text-light-text/50 dark:text-dark-text/50 hover:text-light-text dark:hover:text-dark-text"
                      >
                        <XMarkIcon className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchTagInput}
                    onChange={(e) => setSearchTagInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag('searchTags', searchTagInput, setSearchTagInput);
                      }
                    }}
                    className="flex-1 px-4 py-2 bg-light-primary/5 dark:bg-dark-primary/5 border border-light-primary/20 dark:border-dark-primary/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-light-accent/50 dark:focus:ring-dark-accent/50"
                    placeholder="검색 태그를 입력하세요"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddTag('searchTags', searchTagInput, setSearchTagInput)}
                    className="px-4 py-2 bg-light-accent dark:bg-dark-accent text-white rounded-lg hover:opacity-90 transition-opacity"
                  >
                    추가
                  </button>
                </div>
              </div>

              {/* MR 링크 */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <label className="block text-sm font-medium text-light-text dark:text-dark-text">
                    MR 링크
                  </label>
                  <button
                    type="button"
                    onClick={handleAddMRLink}
                    className="flex items-center gap-1 px-3 py-1 bg-light-secondary/20 dark:bg-dark-secondary/20 text-sm rounded-lg hover:bg-light-secondary/30 dark:hover:bg-dark-secondary/30 transition-colors"
                  >
                    <PlusIcon className="w-4 h-4" />
                    MR 추가
                  </button>
                </div>
                <div className="space-y-3">
                  {formData.mrLinks.map((link, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="url"
                        value={link.url}
                        onChange={(e) => handleUpdateMRLink(index, 'url', e.target.value)}
                        className="flex-1 px-4 py-2 bg-light-primary/5 dark:bg-dark-primary/5 border border-light-primary/20 dark:border-dark-primary/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-light-accent/50 dark:focus:ring-dark-accent/50"
                        placeholder="MR 링크 URL"
                      />
                      <input
                        type="text"
                        value={link.label}
                        onChange={(e) => handleUpdateMRLink(index, 'label', e.target.value)}
                        className="w-24 px-3 py-2 bg-light-primary/5 dark:bg-dark-primary/5 border border-light-primary/20 dark:border-dark-primary/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-light-accent/50 dark:focus:ring-dark-accent/50"
                        placeholder="라벨"
                      />
                      <input
                        type="number"
                        value={link.skipSeconds || 0}
                        onChange={(e) => handleUpdateMRLink(index, 'skipSeconds', parseInt(e.target.value) || 0)}
                        className="w-20 px-3 py-2 bg-light-primary/5 dark:bg-dark-primary/5 border border-light-primary/20 dark:border-dark-primary/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-light-accent/50 dark:focus:ring-dark-accent/50"
                        placeholder="스킵초"
                        title="스킵할 초 수"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveMRLink(index)}
                        className="px-3 py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* 원곡 링크 */}
              <div>
                <label className="block text-sm font-medium text-light-text dark:text-dark-text mb-2">
                  원곡 링크
                </label>
                <input
                  type="url"
                  value={formData.originalTrackUrl}
                  onChange={(e) => handleInputChange('originalTrackUrl', e.target.value)}
                  className="w-full px-4 py-3 bg-light-primary/5 dark:bg-dark-primary/5 border border-light-primary/20 dark:border-dark-primary/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-light-accent/50 dark:focus:ring-dark-accent/50"
                  placeholder="YouTube, Spotify 등 원곡 링크"
                />
              </div>

              {/* 가사 */}
              <div>
                <label className="block text-sm font-medium text-light-text dark:text-dark-text mb-2">
                  가사
                </label>
                <textarea
                  value={formData.lyrics}
                  onChange={(e) => handleInputChange('lyrics', e.target.value)}
                  rows={6}
                  className="w-full px-4 py-3 bg-light-primary/5 dark:bg-dark-primary/5 border border-light-primary/20 dark:border-dark-primary/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-light-accent/50 dark:focus:ring-dark-accent/50"
                  placeholder="가사를 입력하세요"
                />
              </div>

              {/* 버튼 */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 px-6 py-3 bg-light-primary/10 dark:bg-dark-primary/10 text-light-text dark:text-dark-text rounded-lg hover:bg-light-primary/20 dark:hover:bg-dark-primary/20 transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-light-accent to-light-purple dark:from-dark-accent dark:to-dark-purple text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {isSubmitting ? '추가 중...' : '노래 추가'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}