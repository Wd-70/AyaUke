'use client'

import { useState, useEffect } from 'react'
import { PencilIcon, PlusIcon, StarIcon, TrashIcon } from '@heroicons/react/24/outline'
import type { AdminSong, MRLink } from './song-admin-types'

interface SongEditModalProps {
  /** 없으면 '새 곡 추가' 모드 */
  song?: AdminSong
  onClose: () => void
  onSubmit: (
    songData: {
      title?: string
      artist?: string
      language?: string
      keyAdjustment?: number | null
      lyrics?: string
      mrLinks?: MRLink[]
      tags?: string[]
      selectedMRIndex?: number
      imageUrl?: string
    },
    isAdd: boolean,
  ) => void
  loading: boolean
}

const formatKeyAdjustment = (value?: number | null) => {
  if (value == null) return '설정 없음'
  if (value === 0) return '원본키'
  return `${value > 0 ? '+' : ''}${value}`
}

export default function SongEditModal({ song, onClose, onSubmit, loading }: SongEditModalProps) {
  const isAdd = !song
  const currentKeyAdjustmentLabel = isAdd ? '신규: 설정 없음' : formatKeyAdjustment(song.keyAdjustment)
  const [formData, setFormData] = useState({
    title: song?.title || '',
    artist: song?.artist || '',
    language: song?.language || 'Korean',
    keyAdjustment: song?.keyAdjustment != null ? song.keyAdjustment.toString() : '999',
    lyrics: song?.lyrics || '',
    mrLinks: song?.mrLinks?.length ? song.mrLinks : [{ url: '', skipSeconds: 0, label: '', duration: '' }],
    tags: song?.tags || [],
    selectedMRIndex: song?.selectedMRIndex || 0,
    imageUrl: song?.imageUrl || ''
  })
  const [currentTag, setCurrentTag] = useState('')
  const [isSearchingMR, setIsSearchingMR] = useState(false)

  // 배경 스크롤 방지 (노래책과 동일한 방식)
  useEffect(() => {
    // body 스크롤 완전 비활성화
    document.body.style.overflow = 'hidden'
    document.body.style.paddingRight = '0px' // 스크롤바 공간 보정
    document.body.style.touchAction = 'none' // 터치 스크롤 방지
    document.documentElement.style.overflow = 'hidden' // html 요소도 차단
    
    // 컴포넌트 언마운트 시 스크롤 복원
    return () => {
      document.body.style.overflow = ''
      document.body.style.paddingRight = ''
      document.body.style.touchAction = ''
      document.documentElement.style.overflow = ''
    }
  }, [])

  const handleAddTag = () => {
    if (currentTag.trim() && !formData.tags.includes(currentTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, currentTag.trim()]
      }))
      setCurrentTag('')
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }))
  }

  const handleTagKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddTag()
    }
  }

  // MR 링크 관리 함수들
  const addMRLink = () => {
    setFormData(prev => ({
      ...prev,
      mrLinks: [...prev.mrLinks, { url: '', skipSeconds: 0, label: '', duration: '' }]
    }))
  }

  const removeMRLink = (index: number) => {
    if (formData.mrLinks.length > 1) {
      const newLinks = formData.mrLinks.filter((_, i) => i !== index)
      setFormData(prev => ({
        ...prev,
        mrLinks: newLinks,
        selectedMRIndex: Math.min(prev.selectedMRIndex, newLinks.length - 1)
      }))
    }
  }

  const updateMRLink = (index: number, field: keyof MRLink, value: string | number) => {
    const updatedLinks = formData.mrLinks.map((link, i) => 
      i === index ? { ...link, [field]: value } : link
    )
    setFormData(prev => ({
      ...prev,
      mrLinks: updatedLinks
    }))
  }

  const setMainMRLink = (index: number) => {
    setFormData(prev => ({
      ...prev,
      selectedMRIndex: index
    }))
  }

  // YouTube에서 MR 링크 자동 검색
  const searchMRFromYouTube = async () => {
    if (!formData.title.trim() || !formData.artist.trim()) {
      alert('곡 제목과 아티스트를 먼저 입력해주세요.')
      return
    }

    setIsSearchingMR(true)
    try {
      const response = await fetch('/api/youtube-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          title: formData.title.trim(), 
          artist: formData.artist.trim() 
        })
      })

      const result = await response.json()
      if (result.success && result.selectedResult) {
        const mrResult = result.selectedResult
        // 새로운 MR 링크를 목록에 추가
        setFormData(prev => ({
          ...prev,
          mrLinks: [...prev.mrLinks, {
            url: mrResult.url,
            skipSeconds: 0,
            label: `Auto: ${mrResult.title.substring(0, 25)}...`,
            duration: ''
          }]
        }))
        alert(`MR 링크를 찾았습니다!\n제목: ${mrResult.title}`)
        
        // API 키 상태 로깅
        if (result.keyStats) {
          console.log(`🔑 API 키 상태: ${result.keyStats.availableKeys}/${result.keyStats.totalKeys} 사용 가능`)
        }
      } else {
        alert(result.error || '검색 결과를 찾을 수 없습니다.')
      }
    } catch (error) {
      console.error('MR 검색 오류:', error)
      alert('MR 검색 중 오류가 발생했습니다.')
    } finally {
      setIsSearchingMR(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.title.trim() || !formData.artist.trim()) {
      alert('제목과 아티스트는 필수 항목입니다.')
      return
    }

    // 추가 모드: 전체 데이터 전송
    if (!song) {
      onSubmit(
        {
          title: formData.title.trim(),
          artist: formData.artist.trim(),
          language: formData.language,
          keyAdjustment: formData.keyAdjustment === '999' ? null : parseInt(formData.keyAdjustment),
          lyrics: formData.lyrics.trim() || undefined,
          mrLinks: formData.mrLinks.filter(link => link.url.trim()),
          tags: formData.tags,
          selectedMRIndex: formData.selectedMRIndex,
          imageUrl: formData.imageUrl.trim() || undefined,
        },
        true,
      )
      return
    }

    // 편집 모드: 변경된 데이터만 전송
    const updateData: Record<string, unknown> = {}
    
    if (formData.title.trim() !== song.title) {
      updateData.title = formData.title.trim()
    }
    
    if (formData.artist.trim() !== song.artist) {
      updateData.artist = formData.artist.trim()
    }
    
    if (formData.language !== song.language) {
      updateData.language = formData.language
    }
    
    const currentKeyValue = song.keyAdjustment != null ? song.keyAdjustment.toString() : '999'
    if (formData.keyAdjustment !== currentKeyValue) {
      if (formData.keyAdjustment === '999') {
        updateData.keyAdjustment = null
      } else {
        updateData.keyAdjustment = parseInt(formData.keyAdjustment)
      }
    }
    
    if (formData.lyrics.trim() !== (song.lyrics || '')) {
      updateData.lyrics = formData.lyrics.trim()
    }
    
    const newMrLinks = formData.mrLinks.filter(link => link.url.trim())
    const currentMrLinks = song.mrLinks || []
    if (JSON.stringify(newMrLinks) !== JSON.stringify(currentMrLinks)) {
      updateData.mrLinks = newMrLinks
    }
    
    if (formData.selectedMRIndex !== (song.selectedMRIndex || 0)) {
      updateData.selectedMRIndex = formData.selectedMRIndex
    }
    
    const newTags = formData.tags
    const currentTags = song.tags || []
    if (JSON.stringify(newTags) !== JSON.stringify(currentTags)) {
      updateData.tags = newTags
    }

    if (formData.imageUrl.trim() !== (song.imageUrl || '')) {
      updateData.imageUrl = formData.imageUrl.trim()
    }

    if (Object.keys(updateData).length === 0) {
      alert('변경된 내용이 없습니다.')
      return
    }

    onSubmit(updateData, false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-light-text dark:text-dark-text">{isAdd ? '새 곡 추가' : '곡 편집'}</h2>
          <p className="text-sm text-light-text/60 dark:text-dark-text/60 mt-1">
            {song ? `${song.title} - ${song.artist}` : '새로운 곡 정보를 입력하세요'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-8 h-8 bg-light-primary/20 dark:bg-dark-primary/20 rounded-lg 
                     hover:bg-light-primary/30 dark:hover:bg-dark-primary/30 transition-colors
                     flex items-center justify-center"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 왼쪽 컬럼 - 기본 정보 */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-light-text dark:text-dark-text mb-2">
              제목 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-3 py-2 bg-white/50 dark:bg-gray-800/50 border border-light-primary/20 dark:border-dark-primary/20 
                         rounded-lg focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent 
                         text-light-text dark:text-dark-text"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-light-text dark:text-dark-text mb-2">
              아티스트 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.artist}
              onChange={(e) => setFormData(prev => ({ ...prev, artist: e.target.value }))}
              className="w-full px-3 py-2 bg-white/50 dark:bg-gray-800/50 border border-light-primary/20 dark:border-dark-primary/20 
                         rounded-lg focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent 
                         text-light-text dark:text-dark-text"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-light-text dark:text-dark-text mb-3">
              언어
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'Korean', label: '한국어', color: 'bg-blue-500' },
                { value: 'English', label: '영어', color: 'bg-purple-500' },
                { value: 'Japanese', label: '일본어', color: 'bg-pink-500' },
                { value: 'Chinese', label: '중국어', color: 'bg-red-500' },
                { value: 'Other', label: '기타', color: 'bg-gray-500' }
              ].map((lang) => (
                <button
                  key={lang.value}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, language: lang.value }))}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 border-2 ${
                    formData.language === lang.value
                      ? `${lang.color} text-white border-transparent shadow-lg scale-105`
                      : 'bg-white/50 dark:bg-gray-800/50 text-light-text dark:text-dark-text border-light-primary/20 dark:border-dark-primary/20 hover:border-light-accent/40 dark:hover:border-dark-accent/40 hover:scale-102'
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>

          {/* 키 조절 UI */}
          <div>
            <label className="block text-sm font-medium text-light-text dark:text-dark-text mb-3">
              키 조절
              <span className="text-xs text-light-text/60 dark:text-dark-text/60 ml-2">
                (현재: {currentKeyAdjustmentLabel})
              </span>
            </label>
            <div className="space-y-3">
              {/* 상태 버튼들 */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, keyAdjustment: '0' }))}
                  className={`px-3 py-2 text-sm rounded-lg border transition-all duration-200 ${
                    formData.keyAdjustment === '0' 
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400' 
                      : 'border-light-primary/20 dark:border-dark-primary/20 text-light-text/70 dark:text-dark-text/70 hover:border-green-400'
                  }`}
                >
                  원본 키
                </button>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, keyAdjustment: '999' }))}
                  className={`px-3 py-2 text-sm rounded-lg border transition-all duration-200 ${
                    formData.keyAdjustment === '999' 
                      ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' 
                      : 'border-light-primary/20 dark:border-dark-primary/20 text-light-text/70 dark:text-dark-text/70 hover:border-red-400'
                  }`}
                >
                  조절 해제
                </button>
              </div>
              
              {/* 키 조절 값 입력 */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    let current = 0;
                    if (formData.keyAdjustment === '999') {
                      current = 0;
                    } else {
                      current = parseInt(formData.keyAdjustment) || 0;
                    }
                    const newValue = Math.max(-12, current - 1);
                    setFormData(prev => ({ ...prev, keyAdjustment: newValue.toString() }));
                  }}
                  className="w-10 h-10 bg-white/50 dark:bg-gray-800/50 border border-light-primary/20 dark:border-dark-primary/20 
                            rounded-lg hover:border-light-accent/40 dark:hover:border-dark-accent/40 transition-all duration-200
                            flex items-center justify-center text-light-text dark:text-dark-text font-medium"
                >
                  -
                </button>
                
                <div className="flex-1 relative">
                  <input
                    type="number"
                    min="-12"
                    max="12"
                    value={formData.keyAdjustment === '999' ? '' : formData.keyAdjustment}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '') {
                        setFormData(prev => ({ ...prev, keyAdjustment: '0' }));
                      } else if (parseInt(value) >= -12 && parseInt(value) <= 12) {
                        setFormData(prev => ({ ...prev, keyAdjustment: value }));
                      }
                    }}
                    className="w-full px-3 py-2 bg-white/50 dark:bg-gray-800/50 border border-light-primary/20 dark:border-dark-primary/20 
                              rounded-lg focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent 
                              text-light-text dark:text-dark-text text-center"
                    placeholder="키값"
                  />
                </div>
                
                <button
                  type="button"
                  onClick={() => {
                    let current = 0;
                    if (formData.keyAdjustment === '999') {
                      current = 0;
                    } else {
                      current = parseInt(formData.keyAdjustment) || 0;
                    }
                    const newValue = Math.min(12, current + 1);
                    setFormData(prev => ({ ...prev, keyAdjustment: newValue.toString() }));
                  }}
                  className="w-10 h-10 bg-white/50 dark:bg-gray-800/50 border border-light-primary/20 dark:border-dark-primary/20 
                            rounded-lg hover:border-light-accent/40 dark:hover:border-dark-accent/40 transition-all duration-200
                            flex items-center justify-center text-light-text dark:text-dark-text font-medium"
                >
                  +
                </button>
              </div>
              
              {/* 상태 표시 */}
              <div className="text-xs text-light-text/60 dark:text-dark-text/60 text-center">
                {formData.keyAdjustment === '0' && '원본 키로 설정됩니다'}
                {formData.keyAdjustment === '999' && '키 조절 설정이 해제됩니다'}
                {(formData.keyAdjustment !== '0' && formData.keyAdjustment !== '999') && 
                  `키를 ${parseInt(formData.keyAdjustment) > 0 ? '+' : ''}${formData.keyAdjustment} 조절합니다`
                }
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-light-text dark:text-dark-text mb-2">
              태그
            </label>
            <div className="space-y-3">
              {/* 태그 입력 */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={currentTag}
                  onChange={(e) => setCurrentTag(e.target.value)}
                  onKeyPress={handleTagKeyPress}
                  className="flex-1 px-3 py-2 bg-white/50 dark:bg-gray-800/50 border border-light-primary/20 dark:border-dark-primary/20 
                             rounded-lg focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent 
                             text-light-text dark:text-dark-text"
                  placeholder="태그를 입력하고 엔터를 누르세요"
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="px-4 py-2 bg-light-accent/20 dark:bg-dark-accent/20 text-light-accent dark:text-dark-accent 
                             rounded-lg hover:bg-light-accent/30 dark:hover:bg-dark-accent/30 transition-colors"
                >
                  추가
                </button>
              </div>
              
              {/* 태그 목록 */}
              {formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-light-accent/20 to-light-purple/20 
                                 dark:from-dark-accent/20 dark:to-dark-purple/20 text-light-accent dark:text-dark-accent 
                                 rounded-full text-sm border border-light-accent/30 dark:border-dark-accent/30"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-1 w-4 h-4 flex items-center justify-center rounded-full hover:bg-red-500/20 
                                   text-red-500 hover:text-red-600 transition-colors"
                        title="태그 제거"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 오른쪽 컬럼 - 상세 정보 */}
        <div className="space-y-4">
          {/* MR 링크 */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-light-text dark:text-dark-text">
                MR 링크
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={searchMRFromYouTube}
                  disabled={isSearchingMR}
                  className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg transition-all duration-200 text-sm flex items-center gap-1"
                >
                  {isSearchingMR ? (
                    <>
                      <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                      검색중...
                    </>
                  ) : (
                    <>
                      🔍 자동 검색
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={addMRLink}
                  className="px-3 py-1 bg-light-accent dark:bg-dark-accent text-white rounded-lg hover:opacity-90 transition-opacity text-sm"
                >
                  <PlusIcon className="w-4 h-4 inline mr-1" />
                  추가
                </button>
              </div>
            </div>
            <div className="space-y-3">
              {formData.mrLinks.map((link, index) => (
                <div key={index} className="p-4 bg-light-primary/10 dark:bg-dark-primary/10 rounded-lg border border-light-primary/20 dark:border-dark-primary/20">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setMainMRLink(index)}
                        className={`p-1 rounded-full transition-colors duration-200 ${
                          formData.selectedMRIndex === index
                            ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400'
                            : 'bg-gray-500/20 text-gray-600 dark:text-gray-400 hover:bg-gray-500/30'
                        }`}
                        title={formData.selectedMRIndex === index ? "메인 MR" : "메인으로 설정"}
                      >
                        <StarIcon className="w-4 h-4" />
                      </button>
                      <span className="text-sm font-medium text-light-text/70 dark:text-dark-text/70">
                        MR 링크 {index + 1}
                        {formData.selectedMRIndex === index && (
                          <span className="ml-2 text-xs text-yellow-600 dark:text-yellow-400">(메인)</span>
                        )}
                      </span>
                    </div>
                    {formData.mrLinks.length > 1 && (
                      <button
                        type="button"
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

          <div>
            <label className="block text-sm font-medium text-light-text dark:text-dark-text mb-2">
              가사
            </label>
            <textarea
              value={formData.lyrics}
              onChange={(e) => setFormData(prev => ({ ...prev, lyrics: e.target.value }))}
              className="w-full px-3 py-2 bg-white/50 dark:bg-gray-800/50 border border-light-primary/20 dark:border-dark-primary/20 
                         rounded-lg focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent 
                         text-light-text dark:text-dark-text"
              placeholder="가사를 입력하세요"
              rows={8}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-light-text dark:text-dark-text mb-2">
              커버 이미지 URL
            </label>
            <div className="flex items-start gap-3">
              <input
                type="url"
                value={formData.imageUrl}
                onChange={(e) => setFormData(prev => ({ ...prev, imageUrl: e.target.value }))}
                className="flex-1 px-3 py-2 bg-white/50 dark:bg-gray-800/50 border border-light-primary/20 dark:border-dark-primary/20
                           rounded-lg focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent
                           text-light-text dark:text-dark-text"
                placeholder="https://... (비우면 카드 배경 미사용)"
              />
              {formData.imageUrl.trim() && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={formData.imageUrl}
                  alt="커버 미리보기"
                  className="w-20 h-12 object-cover rounded-lg border border-light-primary/20 dark:border-dark-primary/20 flex-shrink-0"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                  onLoad={(e) => { (e.currentTarget as HTMLImageElement).style.display = '' }}
                />
              )}
            </div>
            <p className="text-xs text-light-text/50 dark:text-dark-text/50 mt-1">
              노래책 곡 카드의 배경 이미지로 사용됩니다.
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-light-primary/20 dark:border-dark-primary/20">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-light-text dark:text-dark-text hover:bg-light-primary/20 dark:hover:bg-dark-primary/20 
                     rounded-lg transition-colors"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 bg-gradient-to-r from-blue-500 to-blue-600 
                     text-white rounded-lg hover:shadow-lg transition-all duration-300 
                     disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              {isAdd ? '추가 중...' : '수정 중...'}
            </>
          ) : (
            <>
              <PencilIcon className="w-4 h-4" />
              {isAdd ? '곡 추가' : '곡 수정'}
            </>
          )}
        </button>
      </div>
    </form>
  )
}