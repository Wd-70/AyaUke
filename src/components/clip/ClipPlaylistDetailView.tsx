'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import ClipSourceLink from './ClipSourceLink'
import { useClipPlayer } from './player/ClipPlayerProvider'
import { toPlayerClip, type PlayerClip } from './player/types'
import { useToast } from '@/components/Toast'
import type { VideoPlatform } from '@/shared/utils/video-url'
import {
  PlayIcon,
  TrashIcon,
  ShareIcon,
  EyeIcon,
  EyeSlashIcon,
  MusicalNoteIcon,
  ArrowsUpDownIcon,
  InformationCircleIcon,
  ArrowsRightLeftIcon,
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
const fmtDur = (start?: number, end?: number) => {
  if (start == null || end == null || end <= start) return null
  const s = Math.round(end - start)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export default function ClipPlaylistDetailView({ data, shareId }: Props) {
  const { showSuccess, showError } = useToast()
  const { playQueue, current } = useClipPlayer()
  const { playlist, isOwner } = data

  // 클립 목록(소유자 편집 반영용 로컬 상태). clipId가 null(삭제된 클립)인 항목은 제외.
  const [clips, setClips] = useState<ClipItem[]>(
    () => playlist.clips.map((c) => c.clipId).filter((c): c is ClipItem => !!c),
  )
  const [isPublic, setIsPublic] = useState(!!playlist.isPublic)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)

  const clipKey = (c: ClipItem) => c.id || c._id || ''

  // 재생 큐(PlayerClip) — null(재생불가/필드누락)은 제외. 행→큐 인덱스 매핑용으로 병렬 배열 유지.
  const playerClips = useMemo(() => clips.map((c) => toPlayerClip(c)), [clips])
  const queue = useMemo(() => playerClips.filter((c): c is PlayerClip => !!c), [playerClips])

  const playFrom = (rowIndex: number, opts?: { shuffle?: boolean }) => {
    if (queue.length === 0) {
      showError('재생할 수 없어요', '재생 가능한 클립이 없습니다.')
      return
    }
    const qIndex = playerClips.slice(0, rowIndex).filter(Boolean).length
    playQueue(queue, qIndex, opts)
  }

  // ── 소유자 작업 ──────────────────────────────────────────────
  const removeClip = async (clipId: string) => {
    const res = await fetch(`/api/clip-playlists/${playlist._id}/clips?clipId=${clipId}`, { method: 'DELETE' })
    if (!res.ok) {
      showError('제거 실패', '클립을 제거하지 못했습니다.')
      return
    }
    setClips((prev) => prev.filter((c) => clipKey(c) !== clipId))
    showSuccess('제거됨', '클립을 플레이리스트에서 제거했습니다.')
  }

  const persistOrder = async (next: ClipItem[]) => {
    const res = await fetch(`/api/clip-playlists/${playlist._id}/clips`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clips: next.map((c) => ({ clipId: clipKey(c) })) }),
    })
    if (!res.ok) showError('순서 변경 실패', '잠시 후 다시 시도해주세요.')
  }

  const moveClip = (from: number, to: number) => {
    if (to < 0 || to >= clips.length || from === to) return
    const next = [...clips]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    setClips(next)
    void persistOrder(next)
  }

  // ── 드래그 순서 변경 ─────────────────────────────────────────
  const onDrop = (to: number) => {
    if (dragIndex != null) moveClip(dragIndex, to)
    setDragIndex(null)
    setOverIndex(null)
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
      <main className={`mx-auto max-w-3xl px-4 pt-24 ${current ? 'pb-28' : 'pb-12'}`}>
        {/* 헤더 */}
        <div className="mb-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold">{playlist.name}</h1>
              {playlist.description && (
                <p className="mt-1 whitespace-pre-line text-sm text-light-text/60 dark:text-dark-text/60">{playlist.description}</p>
              )}
              <p className="mt-1 text-xs text-light-text/45 dark:text-dark-text/45">{clips.length}개 클립</p>
            </div>
            {isOwner && (
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={togglePublic}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-light-primary/20 px-3 py-1.5 text-sm transition-colors hover:border-light-accent/40 dark:border-dark-primary/20"
                  title={isPublic ? '비공개로 전환' : '공개로 전환'}
                >
                  {isPublic ? <EyeIcon className="h-4 w-4" /> : <EyeSlashIcon className="h-4 w-4" />}
                  {isPublic ? '공개' : '비공개'}
                </button>
                <button
                  onClick={copyShareLink}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-light-primary/20 px-3 py-1.5 text-sm transition-colors hover:border-light-accent/40 dark:border-dark-primary/20"
                  title={isPublic ? '공유 링크 복사' : '비공개 상태 — 공개로 전환해야 다른 사람이 볼 수 있어요'}
                >
                  <ShareIcon className="h-4 w-4" />
                  공유
                </button>
              </div>
            )}
          </div>

          {/* 재생 액션 */}
          {clips.length > 0 && (
            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={() => playFrom(0)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-light-accent to-light-purple px-4 py-2 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-[1.02] dark:from-dark-accent dark:to-dark-purple"
              >
                <PlayIcon className="h-4 w-4" /> 전체 재생
              </button>
              <button
                onClick={() => playFrom(0, { shuffle: true })}
                className="inline-flex items-center gap-1.5 rounded-lg border border-light-primary/25 px-4 py-2 text-sm font-medium text-light-text/70 transition-colors hover:border-light-accent/40 hover:text-light-accent dark:border-dark-primary/25 dark:text-dark-text/70 dark:hover:text-dark-accent"
              >
                <ArrowsRightLeftIcon className="h-4 w-4" /> 셔플 재생
              </button>
            </div>
          )}
        </div>

        {/* 클립 목록 (관리) */}
        {clips.length === 0 ? (
          <div className="rounded-xl border border-light-primary/15 p-10 text-center text-light-text/55 dark:border-dark-primary/15 dark:text-dark-text/55">
            <MusicalNoteIcon className="mx-auto mb-3 h-10 w-10 opacity-40" />
            담긴 클립이 없습니다.
          </div>
        ) : (
          <div className="space-y-1.5">
            {isOwner && (
              <p className="mb-2 text-xs text-light-text/45 dark:text-dark-text/45">
                <ArrowsUpDownIcon className="mr-1 inline h-3.5 w-3.5" />
                손잡이를 잡고 끌어 순서를 바꿀 수 있어요.
              </p>
            )}
            {clips.map((clip, index) => {
              const key = clipKey(clip)
              const dur = fmtDur(clip.startTime, clip.endTime)
              const canPlay = !!playerClips[index]
              const isOver = overIndex === index && dragIndex !== null && dragIndex !== index
              return (
                <div
                  key={key}
                  onDragOver={(e) => {
                    if (dragIndex == null) return
                    e.preventDefault()
                    setOverIndex(index)
                  }}
                  onDrop={() => onDrop(index)}
                  className={`group flex items-center gap-3 rounded-lg border p-2 transition-colors ${
                    isOver
                      ? 'border-light-accent/60 bg-light-accent/10 dark:border-dark-accent/60 dark:bg-dark-accent/10'
                      : 'border-light-primary/15 dark:border-dark-primary/15'
                  } ${dragIndex === index ? 'opacity-50' : ''}`}
                >
                  {/* 드래그 손잡이 */}
                  {isOwner && (
                    <span
                      draggable
                      onDragStart={() => setDragIndex(index)}
                      onDragEnd={() => {
                        setDragIndex(null)
                        setOverIndex(null)
                      }}
                      className="shrink-0 cursor-grab touch-none px-0.5 text-light-text/35 active:cursor-grabbing dark:text-dark-text/35"
                      title="끌어서 순서 변경"
                      aria-label="순서 변경 손잡이"
                    >
                      <ArrowsUpDownIcon className="h-5 w-5" />
                    </span>
                  )}

                  <span className="w-5 shrink-0 text-center text-xs text-light-text/40 dark:text-dark-text/40">{index + 1}</span>

                  {/* 썸네일 (클릭 재생) */}
                  <button
                    onClick={() => playFrom(index)}
                    disabled={!canPlay}
                    aria-label={`${clip.title ?? '클립'} 재생`}
                    className="relative aspect-video w-24 shrink-0 overflow-hidden rounded bg-light-primary/10 disabled:opacity-50 dark:bg-dark-primary/10"
                  >
                    {clip.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={clip.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <MusicalNoteIcon className="h-4 w-4 text-light-accent/40 dark:text-dark-accent/40" />
                      </div>
                    )}
                    <span className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
                      <PlayIcon className="h-6 w-6 text-white" />
                    </span>
                    {dur && (
                      <span className="absolute bottom-0.5 right-0.5 rounded bg-black/70 px-1 text-[10px] font-medium text-white">{dur}</span>
                    )}
                  </button>

                  {/* 정보 */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 truncate text-sm font-medium">
                      <span className="truncate">{clip.title}</span>
                      {clip.sourceUnavailable && <span className="shrink-0 text-[10px] text-rose-500">재생불가</span>}
                    </div>
                    <div className="truncate text-xs text-light-text/55 dark:text-dark-text/55">
                      {clip.artist}
                      {clip.sungDate && <span> · {fmtDate(clip.sungDate)}</span>}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                          clip.platform === 'chzzk'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                            : 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300'
                        }`}
                      >
                        {clip.platform === 'chzzk' ? '치지직' : 'YT'}
                      </span>
                    </div>
                  </div>

                  {/* 액션: 상세페이지 · 원본 다시보기 · (소유자)제거 */}
                  <div className="flex shrink-0 items-center gap-0.5">
                    <Link
                      href={`/clip/${key}`}
                      title="클립 상세 페이지"
                      aria-label="클립 상세 페이지"
                      className="inline-flex items-center px-1.5 py-1 text-light-text/45 transition-colors hover:text-light-accent dark:text-dark-text/45 dark:hover:text-dark-accent"
                    >
                      <InformationCircleIcon className="h-4 w-4" />
                    </Link>
                    {clip.videoId && clip.platform && (
                      <ClipSourceLink
                        platform={clip.platform as VideoPlatform}
                        videoId={clip.videoId}
                        startTime={clip.startTime ?? 0}
                      />
                    )}
                    {isOwner && (
                      <button
                        onClick={() => removeClip(key)}
                        title="플레이리스트에서 제거"
                        aria-label="제거"
                        className="inline-flex items-center px-1.5 py-1 text-light-text/40 transition-colors hover:text-red-500 dark:text-dark-text/40"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}
