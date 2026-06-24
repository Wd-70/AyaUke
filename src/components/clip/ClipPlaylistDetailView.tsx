'use client'

import { useState, useCallback } from 'react'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import ClipPlayer from './ClipPlayer'
import { useToast } from '@/components/Toast'
import {
  PlayIcon,
  TrashIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ShareIcon,
  EyeIcon,
  EyeSlashIcon,
  MusicalNoteIcon,
} from '@heroicons/react/24/outline'

interface ClipItem {
  _id?: string
  id?: string
  songId?: string
  title?: string
  artist?: string
  platform?: 'youtube' | 'chzzk'
  videoId?: string
  videoUrl?: string
  startTime?: number
  endTime?: number
  sungDate?: string
  thumbnailUrl?: string
  description?: string
  sourceUnavailable?: boolean
}

interface ClipPlaylistData {
  playlist: {
    _id: string
    name: string
    description?: string
    coverImage?: string
    tags: string[]
    clips: Array<{ clipId: ClipItem | null; addedAt: string; order: number }>
    clipCount: number
    createdAt: string
    updatedAt: string
    shareId?: string
    isPublic?: boolean
  }
  isOwner: boolean
  permissions: { canEdit: boolean; canDelete: boolean; canShare: boolean; canCopy: boolean }
}

interface Props {
  data: ClipPlaylistData
  shareId: string
}

const fmtDate = (s?: string) => (s ? new Date(s).toLocaleDateString('ko-KR') : '')

export default function ClipPlaylistDetailView({ data, shareId }: Props) {
  const { showSuccess, showError } = useToast()
  const { playlist, isOwner } = data

  // 클립 목록(소유자 편집 반영용 로컬 상태). clipId가 null(삭제된 클립)인 항목은 제외.
  const [clips, setClips] = useState<ClipItem[]>(
    () => playlist.clips.map((c) => c.clipId).filter((c): c is ClipItem => !!c),
  )
  const [currentIndex, setCurrentIndex] = useState(0)
  const [hasInteracted, setHasInteracted] = useState(false)
  const [isPublic, setIsPublic] = useState(!!playlist.isPublic)

  const clipKey = (c: ClipItem) => c.id || c._id || ''
  const current = clips[currentIndex]

  const playAt = useCallback((index: number) => {
    setHasInteracted(true)
    setCurrentIndex(index)
  }, [])

  const handleEnded = useCallback(() => {
    setCurrentIndex((i) => (i + 1 < clips.length ? i + 1 : i))
  }, [clips.length])

  // ── 소유자 작업 ──────────────────────────────────────────────
  const removeClip = async (clipId: string) => {
    const res = await fetch(`/api/clip-playlists/${playlist._id}/clips?clipId=${clipId}`, { method: 'DELETE' })
    if (!res.ok) {
      showError('제거 실패', '클립을 제거하지 못했습니다.')
      return
    }
    setClips((prev) => {
      const next = prev.filter((c) => clipKey(c) !== clipId)
      setCurrentIndex((idx) => Math.min(idx, Math.max(0, next.length - 1)))
      return next
    })
    showSuccess('제거됨', '클립을 플레이리스트에서 제거했습니다.')
  }

  const reorder = async (from: number, to: number) => {
    if (to < 0 || to >= clips.length) return
    const next = [...clips]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    setClips(next)
    // 현재 재생 중인 클립을 따라가도록 인덱스 보정
    setCurrentIndex((idx) => (idx === from ? to : idx === to ? from : idx))
    const res = await fetch(`/api/clip-playlists/${playlist._id}/clips`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clips: next.map((c) => ({ clipId: clipKey(c) })) }),
    })
    if (!res.ok) showError('순서 변경 실패', '잠시 후 다시 시도해주세요.')
  }

  const togglePublic = async () => {
    const next = !isPublic
    const res = await fetch(`/api/clip-playlists/${playlist._id}/share/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPublic: next }),
    })
    if (!res.ok) {
      showError('설정 실패', '공개 설정을 변경하지 못했습니다.')
      return
    }
    setIsPublic(next)
    showSuccess(next ? '공개로 전환' : '비공개로 전환', next ? '이제 링크로 공유할 수 있습니다.' : '나만 볼 수 있습니다.')
  }

  const copyShareLink = async () => {
    const url = `${window.location.origin}/clip-playlist/${shareId}`
    try {
      await navigator.clipboard.writeText(url)
      showSuccess('링크 복사됨', '공유 링크를 클립보드에 복사했습니다.')
    } catch {
      showError('복사 실패', url)
    }
  }

  return (
    <div className="min-h-screen bg-light-background text-light-text dark:bg-dark-background dark:text-dark-text">
      <Navigation />
      <main className="mx-auto max-w-4xl px-4 py-8">
        {/* 헤더 */}
        <div className="mb-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold truncate">{playlist.name}</h1>
              {playlist.description && (
                <p className="mt-1 text-sm text-light-text/60 dark:text-dark-text/60 whitespace-pre-line">{playlist.description}</p>
              )}
              <p className="mt-1 text-xs text-light-text/45 dark:text-dark-text/45">{clips.length}개 클립</p>
            </div>
            {isOwner && (
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={togglePublic}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-light-primary/20 dark:border-dark-primary/20 px-3 py-1.5 text-sm hover:border-light-accent/40 transition-colors"
                  title={isPublic ? '비공개로 전환' : '공개로 전환'}
                >
                  {isPublic ? <EyeIcon className="h-4 w-4" /> : <EyeSlashIcon className="h-4 w-4" />}
                  {isPublic ? '공개' : '비공개'}
                </button>
                <button
                  onClick={copyShareLink}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-light-primary/20 dark:border-dark-primary/20 px-3 py-1.5 text-sm hover:border-light-accent/40 transition-colors"
                >
                  <ShareIcon className="h-4 w-4" />
                  공유
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 플레이어 */}
        {current ? (
          <div className="mb-6">
            <ClipPlayer
              key={`${clipKey(current)}-${currentIndex}`}
              platform={current.platform || 'youtube'}
              videoId={current.videoId || ''}
              startTime={current.startTime || 0}
              endTime={current.endTime}
              autoplay={hasInteracted}
              onEnded={handleEnded}
              posterDate={fmtDate(current.sungDate)}
              posterThumbnail={current.thumbnailUrl ?? undefined}
              posterDescription={current.description ?? undefined}
              trackPlayClipId={clipKey(current)}
              className="w-full"
            />
            <div className="mt-2 text-sm">
              <span className="font-semibold">{current.title}</span>
              <span className="text-light-text/55 dark:text-dark-text/55"> · {current.artist}</span>
            </div>
          </div>
        ) : (
          <div className="mb-6 rounded-xl border border-light-primary/15 dark:border-dark-primary/15 p-10 text-center text-light-text/55 dark:text-dark-text/55">
            <MusicalNoteIcon className="mx-auto mb-3 h-10 w-10 opacity-40" />
            담긴 클립이 없습니다.
          </div>
        )}

        {/* 클립 목록 */}
        <div className="space-y-1.5">
          {clips.map((clip, index) => {
            const active = index === currentIndex
            return (
              <div
                key={clipKey(clip)}
                onClick={() => playAt(index)}
                className={`group flex cursor-pointer items-center gap-3 rounded-lg border p-2 transition-colors ${
                  active
                    ? 'border-light-accent/50 bg-light-accent/10 dark:border-dark-accent/50 dark:bg-dark-accent/10'
                    : 'border-light-primary/15 hover:border-light-accent/30 hover:bg-light-primary/5 dark:border-dark-primary/15 dark:hover:bg-dark-primary/5'
                }`}
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center text-xs text-light-text/50 dark:text-dark-text/50">
                  {active ? <PlayIcon className="h-4 w-4 text-light-accent dark:text-dark-accent" /> : index + 1}
                </div>
                <div className="relative aspect-video w-20 shrink-0 overflow-hidden rounded bg-light-primary/10 dark:bg-dark-primary/10">
                  {clip.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={clip.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <MusicalNoteIcon className="h-4 w-4 text-light-accent/40 dark:text-dark-accent/40" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 truncate text-sm font-medium">
                    <span className="truncate">{clip.title}</span>
                    {clip.sourceUnavailable && (
                      <span className="shrink-0 text-[10px] text-rose-500">재생불가</span>
                    )}
                  </div>
                  <div className="truncate text-xs text-light-text/55 dark:text-dark-text/55">
                    {clip.artist}
                    {clip.sungDate && <span> · {fmtDate(clip.sungDate)}</span>}
                  </div>
                </div>
                {clip.platform === 'chzzk' ? (
                  <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">치지직</span>
                ) : (
                  <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300">YT</span>
                )}
                {isOwner && (
                  <div className="flex shrink-0 items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => reorder(index, index - 1)}
                      disabled={index === 0}
                      className="p-1 text-light-text/40 hover:text-light-accent disabled:opacity-30 dark:text-dark-text/40"
                      title="위로"
                    >
                      <ArrowUpIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => reorder(index, index + 1)}
                      disabled={index === clips.length - 1}
                      className="p-1 text-light-text/40 hover:text-light-accent disabled:opacity-30 dark:text-dark-text/40"
                      title="아래로"
                    >
                      <ArrowDownIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => removeClip(clipKey(clip))}
                      className="p-1 text-light-text/40 hover:text-red-500 dark:text-dark-text/40"
                      title="제거"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </main>
      <Footer />
    </div>
  )
}
