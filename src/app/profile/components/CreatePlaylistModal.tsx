'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  XMarkIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  EyeSlashIcon,
  MusicalNoteIcon
} from '@heroicons/react/24/outline'

interface CreatePlaylistModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (playlist: unknown) => void
}

export default function CreatePlaylistModal({ isOpen, onClose, onSuccess }: CreatePlaylistModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isPublic: false
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch('/api/playlists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '플레이리스트 생성에 실패했습니다.')
      }

      const result = await response.json()
      setSuccess('플레이리스트가 성공적으로 생성되었습니다!')
      
      // 부모 컴포넌트에 새 플레이리스트 전달
      onSuccess(result.playlist)
      
      setTimeout(() => {
        handleClose()
      }, 1500)

    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    setFormData({ name: '', description: '', isPublic: false })
    setError('')
    setSuccess('')
    onClose()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* 배경 오버레이 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />
          
          {/* 모달 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-md bg-white/95 dark:bg-gray-800/95 backdrop-blur-md rounded-2xl border border-gray-200/60 dark:border-gray-700/60 shadow-2xl"
          >
            {/* 헤더 */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200/60 dark:border-gray-700/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-light-accent to-light-secondary dark:from-dark-accent dark:to-dark-secondary rounded-lg flex items-center justify-center">
                  <MusicalNoteIcon className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  새 플레이리스트
                </h2>
              </div>
              <button
                onClick={handleClose}
                disabled={isLoading}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors duration-200 disabled:opacity-50"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* 알림 메시지 */}
            <AnimatePresence>
              {(error || success) && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className={`mx-6 mt-4 p-3 rounded-lg flex items-center gap-2 text-sm ${
                    error 
                      ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800'
                      : 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800'
                  }`}>
                    {error ? (
                      <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0" />
                    ) : (
                      <CheckIcon className="w-4 h-4 flex-shrink-0" />
                    )}
                    <span>{error || success}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 폼 */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* 플레이리스트 이름 */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  플레이리스트 이름 *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  disabled={isLoading}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent focus:border-transparent outline-none transition-all duration-200 disabled:opacity-50"
                  placeholder="플레이리스트 이름을 입력하세요"
                  maxLength={100}
                  required
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {formData.name.length}/100자
                </p>
              </div>

              {/* 설명 */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  설명
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  disabled={isLoading}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent focus:border-transparent outline-none transition-all duration-200 disabled:opacity-50 resize-none"
                  placeholder="플레이리스트에 대한 설명을 입력하세요 (선택사항)"
                  rows={3}
                  maxLength={500}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {formData.description.length}/500자
                </p>
              </div>

              {/* 공개 설정 */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  공개 설정
                </label>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, isPublic: true }))}
                    disabled={isLoading}
                    className={`w-full p-3 rounded-lg border-2 transition-all duration-200 flex items-center gap-3 disabled:opacity-50 ${
                      formData.isPublic
                        ? 'border-light-accent dark:border-dark-accent bg-light-accent/10 dark:bg-dark-accent/10'
                        : 'border-gray-200 dark:border-gray-600 hover:border-light-accent/30 dark:hover:border-dark-accent/30'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      formData.isPublic
                        ? 'border-light-accent dark:border-dark-accent bg-light-accent dark:bg-dark-accent'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}>
                      {formData.isPublic && (
                        <div className="w-2 h-2 rounded-full bg-white" />
                      )}
                    </div>
                    <EyeIcon className="w-5 h-5 text-green-500" />
                    <div className="flex-1 text-left">
                      <div className="font-medium text-gray-900 dark:text-white">공개</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        다른 사용자가 공유 링크로 플레이리스트를 볼 수 있습니다
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, isPublic: false }))}
                    disabled={isLoading}
                    className={`w-full p-3 rounded-lg border-2 transition-all duration-200 flex items-center gap-3 disabled:opacity-50 ${
                      !formData.isPublic
                        ? 'border-light-accent dark:border-dark-accent bg-light-accent/10 dark:bg-dark-accent/10'
                        : 'border-gray-200 dark:border-gray-600 hover:border-light-accent/30 dark:hover:border-dark-accent/30'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      !formData.isPublic
                        ? 'border-light-accent dark:border-dark-accent bg-light-accent dark:bg-dark-accent'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}>
                      {!formData.isPublic && (
                        <div className="w-2 h-2 rounded-full bg-white" />
                      )}
                    </div>
                    <EyeSlashIcon className="w-5 h-5 text-gray-500" />
                    <div className="flex-1 text-left">
                      <div className="font-medium text-gray-900 dark:text-white">비공개</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        나만 볼 수 있는 개인 플레이리스트입니다
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* 안내 메시지 */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <div className="text-sm text-blue-600 dark:text-blue-400">
                  💡 플레이리스트를 생성한 후 노래책에서 곡을 추가할 수 있습니다.
                </div>
              </div>

              {/* 버튼 */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200 disabled:opacity-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isLoading || !formData.name.trim()}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-light-accent to-light-secondary dark:from-dark-accent dark:to-dark-secondary text-white rounded-lg hover:from-light-secondary hover:to-light-accent dark:hover:from-dark-secondary dark:hover:to-dark-accent transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      생성 중...
                    </>
                  ) : (
                    '플레이리스트 생성'
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}