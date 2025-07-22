'use client'

import { useState, useRef, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  XMarkIcon, 
  PhotoIcon, 
  UserIcon,
  CheckIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'

interface ProfileEditorProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  initialUserData?: {
    displayName?: string
    profileImageUrl?: string
  }
}

export default function ProfileEditor({ isOpen, onClose, onSuccess, initialUserData }: ProfileEditorProps) {
  const { data: session, update } = useSession()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [userProfile, setUserProfile] = useState(null)
  
  const [formData, setFormData] = useState({
    displayName: initialUserData?.displayName || '',
    profileImageUrl: initialUserData?.profileImageUrl || session?.user?.image || ''
  })
  
  const [previewImage, setPreviewImage] = useState(initialUserData?.profileImageUrl || session?.user?.image || '')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 사용자 프로필 정보 로드 (초기 데이터가 없을 때만)
  useEffect(() => {
    if (isOpen && session?.user?.channelId && !initialUserData?.displayName) {
      loadUserProfile()
    }
  }, [isOpen, session?.user?.channelId, initialUserData?.displayName])

  const loadUserProfile = async () => {
    try {
      const response = await fetch('/api/user/profile')
      if (response.ok) {
        const data = await response.json()
        const profile = data.user
        console.log('🔍 로드된 사용자 프로필:', profile)
        setUserProfile(profile)
        setFormData({
          displayName: profile.displayName || profile.channelName || '',
          profileImageUrl: profile.profileImageUrl || ''
        })
        setPreviewImage(profile.profileImageUrl || '')
        console.log('📝 폼 데이터 설정:', {
          displayName: profile.displayName || profile.channelName || '',
          profileImageUrl: profile.profileImageUrl || ''
        })
      }
    } catch (error) {
      console.error('프로필 로딩 실패:', error)
      // 폴백: 세션 정보 사용
      setFormData({
        displayName: session?.user?.channelName || session?.user?.name || '',
        profileImageUrl: session?.user?.image || ''
      })
    }
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // 파일 크기 체크 (5MB 제한)
      if (file.size > 5 * 1024 * 1024) {
        setError('이미지 파일은 5MB 이하로 업로드해주세요.')
        return
      }

      const reader = new FileReader()
      reader.onload = (event) => {
        const result = event.target?.result as string
        setPreviewImage(result)
        setFormData(prev => ({ ...prev, profileImageUrl: result }))
      }
      reader.readAsDataURL(file)
    }
  }

  const handleImageUrlChange = (url: string) => {
    setPreviewImage(url)
    setFormData(prev => ({ ...prev, profileImageUrl: url }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '프로필 업데이트에 실패했습니다.')
      }

      const result = await response.json()
      
      // 세션 업데이트 (NextAuth가 자동으로 DB에서 최신 정보를 가져올 것임)
      await update()
      
      setSuccess('프로필이 성공적으로 업데이트되었습니다!')
      
      setTimeout(() => {
        if (onSuccess) {
          onSuccess()
        } else {
          onClose()
          // 페이지 새로고침으로 세션 정보 확실히 업데이트
          window.location.reload()
        }
      }, 1500)

    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const resetImage = () => {
    setPreviewImage(session?.user?.image || '')
    setFormData(prev => ({ ...prev, profileImageUrl: session?.user?.image || '' }))
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
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
            onClick={onClose}
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
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                프로필 편집
              </h2>
              <button
                onClick={onClose}
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
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* 프로필 이미지 */}
              <div className="space-y-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  프로필 사진
                </label>
                
                {/* 이미지 미리보기 */}
                <div className="flex flex-col items-center space-y-4">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-light-accent to-light-secondary dark:from-dark-accent to-dark-secondary ring-4 ring-white/20 dark:ring-gray-800/20">
                      {previewImage ? (
                        <img
                          src={previewImage}
                          alt="Profile preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <UserIcon className="w-8 h-8 text-white" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 이미지 업로드 버튼들 */}
                  <div className="flex flex-wrap gap-2 justify-center">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isLoading}
                      className="px-3 py-2 text-xs bg-light-accent/10 dark:bg-dark-accent/10 text-light-accent dark:text-dark-accent border border-light-accent/20 dark:border-dark-accent/20 rounded-lg hover:bg-light-accent/20 dark:hover:bg-dark-accent/20 transition-colors duration-200 flex items-center gap-1 disabled:opacity-50"
                    >
                      <PhotoIcon className="w-3 h-3" />
                      파일 선택
                    </button>
                    
                    <button
                      type="button"
                      onClick={resetImage}
                      disabled={isLoading}
                      className="px-3 py-2 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200 disabled:opacity-50"
                    >
                      초기화
                    </button>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </div>

                {/* URL 직접 입력 */}
                <div className="space-y-2">
                  <label className="block text-xs text-gray-500 dark:text-gray-400">
                    또는 이미지 URL 직접 입력
                  </label>
                  <input
                    type="url"
                    value={formData.profileImageUrl}
                    onChange={(e) => {
                      const url = e.target.value
                      setFormData(prev => ({ ...prev, profileImageUrl: url }))
                      setPreviewImage(url)
                    }}
                    disabled={isLoading}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent focus:border-transparent outline-none transition-all duration-200 disabled:opacity-50"
                    placeholder="https://example.com/image.jpg"
                  />
                </div>
              </div>

              {/* 닉네임 */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  닉네임
                </label>
                <input
                  type="text"
                  value={formData.displayName}
                  onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
                  disabled={isLoading}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent focus:border-transparent outline-none transition-all duration-200 disabled:opacity-50"
                  placeholder="사용할 닉네임을 입력하세요"
                  maxLength={20}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {formData.displayName.length}/20자 (2자 이상 필요)
                </p>
              </div>

              {/* 버튼 */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200 disabled:opacity-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isLoading || !formData.displayName.trim() || formData.displayName.trim().length < 2}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-light-accent to-light-secondary dark:from-dark-accent dark:to-dark-secondary text-white rounded-lg hover:from-light-secondary hover:to-light-accent dark:hover:from-dark-secondary dark:hover:to-dark-accent transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      저장 중...
                    </>
                  ) : (
                    '저장하기'
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