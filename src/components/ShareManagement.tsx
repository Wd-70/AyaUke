'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  LinkIcon, 
  ClipboardDocumentIcon,
  ArrowPathIcon,
  EyeIcon,
  EyeSlashIcon,
  UserIcon,
  ClockIcon
} from '@heroicons/react/24/outline'
import { CheckIcon } from '@heroicons/react/24/solid'

interface ShareManagementProps {
  shareId: string
  playlist: {
    _id: string
    name: string
    isPublic?: boolean
    shareSettings?: {
      allowCopy: boolean
      requireLogin: boolean
      expiresAt?: string
    }
    shareHistory?: Array<{
      shareId: string
      createdAt: string
      revokedAt: string
    }>
  }
  onUpdate: () => void
}

export default function ShareManagement({ shareId, playlist, onUpdate }: ShareManagementProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [originalSettings] = useState({
    isPublic: playlist.isPublic || false,
    requireLogin: playlist.shareSettings?.requireLogin || false
  })
  const [settings, setSettings] = useState({
    isPublic: playlist.isPublic || false,
    requireLogin: playlist.shareSettings?.requireLogin || false
  })

  const shareUrl = `${window.location.origin}/playlist/${shareId}`

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('링크 복사 실패:', error)
    }
  }

  const handleRegenerateLink = async () => {
    if (!confirm('새로운 공유 링크를 생성하시겠습니까? 기존 링크는 더 이상 사용할 수 없습니다.')) {
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`/api/playlists/${playlist._id}/share/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      if (response.ok) {
        const result = await response.json()
        console.log('API 응답:', result)
        
        // API 응답에서 shareId를 가져오기 (여러 경로 시도)
        const newShareId = result.shareId || result.playlist?.shareId
        
        console.log('새로운 shareId:', newShareId)
        
        // 새로운 링크로 즉시 이동
        if (newShareId) {
          console.log('새 주소로 이동:', `/playlist/${newShareId}`)
          window.location.href = `/playlist/${newShareId}`
        } else {
          console.log('shareId를 찾을 수 없음, 페이지 새로고침')
          // fallback: 페이지 새로고침
          onUpdate()
        }
      } else {
        throw new Error('링크 재생성 실패')
      }
    } catch (error) {
      console.error('링크 재생성 오류:', error)
      alert('링크 재생성에 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  // 변경사항 추적
  const checkForChanges = (newSettings: typeof settings) => {
    const changed = JSON.stringify(newSettings) !== JSON.stringify(originalSettings)
    setHasChanges(changed)
  }

  const handleSettingsChange = (newSettings: Partial<typeof settings>) => {
    const updatedSettings = { ...settings, ...newSettings }
    setSettings(updatedSettings)
    checkForChanges(updatedSettings)
  }

  const handleSaveSettings = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/playlists/${playlist._id}/share/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isPublic: settings.isPublic,
          shareSettings: {
            allowCopy: true,
            requireLogin: settings.requireLogin,
            expiresAt: null
          }
        })
      })

      if (response.ok) {
        setHasChanges(false)
        // 새로고침 대신 부드러운 업데이트
        setTimeout(() => {
          onUpdate()
        }, 500)
      } else {
        throw new Error('설정 업데이트 실패')
      }
    } catch (error) {
      console.error('설정 업데이트 오류:', error)
      alert('설정 업데이트에 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleResetSettings = () => {
    setSettings(originalSettings)
    setHasChanges(false)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-light-text dark:text-dark-text flex items-center gap-2">
        <LinkIcon className="w-5 h-5" />
        공유 링크 관리
      </h3>

      {/* 현재 공유 링크 */}
      <div className="bg-light-primary/5 dark:bg-dark-primary/5 rounded-lg p-4">
        <label className="block text-sm font-medium text-light-text dark:text-dark-text mb-2">
          현재 공유 링크
        </label>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={shareUrl}
            readOnly
            className="flex-1 px-3 py-2 bg-white dark:bg-gray-700 border border-light-primary/20 dark:border-dark-primary/20 rounded-lg text-sm"
          />
          <button
            onClick={handleCopyLink}
            className="px-4 py-2 bg-light-accent dark:bg-dark-accent text-white rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            {copied ? (
              <CheckIcon className="w-4 h-4" />
            ) : (
              <ClipboardDocumentIcon className="w-4 h-4" />
            )}
            {copied ? '복사됨' : '복사'}
          </button>
        </div>
        
        {/* 새 링크 생성 버튼 */}
        <div className="flex flex-col sm:flex-row gap-3 pt-3 border-t border-light-primary/10 dark:border-dark-primary/10">
          <button
            onClick={handleRegenerateLink}
            disabled={isLoading}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50"
          >
            <ArrowPathIcon className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            새 링크 생성
          </button>
          
          <div className="text-sm text-light-text/60 dark:text-dark-text/60 flex items-center">
            <span>새 링크 생성 시 기존 링크는 무효화됩니다</span>
          </div>
        </div>
      </div>

      {/* 공유 설정 */}
      <div className="space-y-4">
        <h4 className="font-medium text-light-text dark:text-dark-text">공유 설정</h4>
        
        {/* 공개/비공개 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {settings.isPublic ? (
              <EyeIcon className="w-5 h-5 text-green-500" />
            ) : (
              <EyeSlashIcon className="w-5 h-5 text-gray-400" />
            )}
            <div>
              <div className="font-medium text-light-text dark:text-dark-text">
                {settings.isPublic ? '공개 플레이리스트' : '비공개 플레이리스트'}
              </div>
              <div className="text-sm text-light-text/60 dark:text-dark-text/60">
                {settings.isPublic ? '누구나 링크로 접근 가능' : '링크를 알아도 접근 불가'}
              </div>
            </div>
          </div>
          <button
            onClick={() => handleSettingsChange({ isPublic: !settings.isPublic })}
            disabled={isLoading}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              settings.isPublic 
                ? 'bg-green-500' 
                : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <div
              className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                settings.isPublic ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>


        {/* 로그인 필수 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-orange-500" />
            <div>
              <div className="font-medium text-light-text dark:text-dark-text">
                {settings.requireLogin ? '로그인 필수' : '로그인 선택사항'}
              </div>
              <div className="text-sm text-light-text/60 dark:text-dark-text/60">
                {settings.requireLogin ? '로그인한 사용자만 플레이리스트 보기 가능' : '누구나 플레이리스트 보기 가능'}
              </div>
            </div>
          </div>
          <button
            onClick={() => handleSettingsChange({ requireLogin: !settings.requireLogin })}
            disabled={isLoading}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              settings.requireLogin 
                ? 'bg-orange-500' 
                : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <div
              className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                settings.requireLogin ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

      </div>

      {/* 설정 저장 버튼 */}
      {hasChanges && (
        <div className="flex flex-col gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg">
          <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
            <span className="text-sm font-medium">변경사항이 있습니다</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSaveSettings}
              disabled={isLoading}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 flex-1"
            >
              {isLoading ? (
                <ArrowPathIcon className="w-4 h-4 animate-spin" />
              ) : (
                <CheckIcon className="w-4 h-4" />
              )}
              {isLoading ? '저장 중...' : '변경사항 저장'}
            </button>
            <button
              onClick={handleResetSettings}
              disabled={isLoading}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"
            >
              취소
            </button>
          </div>
        </div>
      )}


      {/* 공유 히스토리 */}
      {playlist.shareHistory && playlist.shareHistory.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-medium text-light-text dark:text-dark-text flex items-center gap-2">
            <ClockIcon className="w-5 h-5" />
            공유 히스토리
          </h4>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {playlist.shareHistory.map((history, index) => (
              <div
                key={index}
                className="flex justify-between items-center px-3 py-2 bg-light-primary/5 dark:bg-dark-primary/5 rounded-lg text-sm"
              >
                <div>
                  <div className="font-mono text-xs text-light-text/70 dark:text-dark-text/70">
                    {history.shareId.slice(0, 8)}...
                  </div>
                  <div className="text-light-text/60 dark:text-dark-text/60">
                    생성: {formatDate(history.createdAt)}
                  </div>
                </div>
                <div className="text-red-500 text-xs">
                  {formatDate(history.revokedAt)} 무효화
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}