'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  FilmIcon,
  PlusIcon,
  TrashIcon,
  ArrowTopRightOnSquareIcon,
  EyeIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/outline'
import { useGlobalClipPlaylists } from '@/hooks/useGlobalClipPlaylists'
import { useToast } from '@/components/Toast'

/** /profile 플레이리스트 탭의 '내 클립 플레이리스트' 섹션 */
export default function ClipPlaylistManager() {
  const { playlists, isLoading, createPlaylist, deletePlaylist, refresh } = useGlobalClipPlaylists()
  const { showSuccess, showError } = useToast()
  const [isCreating, setIsCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleCreate = async () => {
    const name = newName.trim()
    if (!name) return
    const created = await createPlaylist({ name })
    if (created) {
      showSuccess('생성 완료', `'${name}' 클립 플레이리스트를 만들었습니다.`)
      setNewName('')
      setIsCreating(false)
      await refresh()
    } else {
      showError('생성 실패', '같은 이름이 있거나 오류가 발생했습니다.')
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`'${name}' 클립 플레이리스트를 삭제할까요?`)) return
    setDeletingId(id)
    const ok = await deletePlaylist(id)
    setDeletingId(null)
    if (ok) showSuccess('삭제됨', '클립 플레이리스트를 삭제했습니다.')
    else showError('삭제 실패', '잠시 후 다시 시도해주세요.')
  }

  return (
    <div className="mt-10">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-lg font-bold text-light-text dark:text-dark-text">
          <FilmIcon className="h-5 w-5 text-light-accent dark:text-dark-accent" />
          내 클립 플레이리스트
        </h3>
        <button
          onClick={() => setIsCreating((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-light-accent dark:bg-dark-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
        >
          <PlusIcon className="h-4 w-4" />
          새로 만들기
        </button>
      </div>

      {isCreating && (
        <div className="mb-4 flex gap-2">
          <input
            type="text"
            value={newName}
            autoFocus
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleCreate()
              }
            }}
            placeholder="클립 플레이리스트 이름"
            maxLength={100}
            className="flex-1 rounded-lg border border-light-primary/20 dark:border-dark-primary/20 bg-white/60 dark:bg-gray-800/50 px-3 py-2 text-sm text-light-text dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent"
          />
          <button onClick={handleCreate} disabled={!newName.trim()} className="rounded-lg bg-light-accent dark:bg-dark-accent px-4 py-2 text-sm text-white disabled:opacity-50">
            생성
          </button>
        </div>
      )}

      {isLoading && playlists.length === 0 ? (
        <p className="py-8 text-center text-sm text-light-text/55 dark:text-dark-text/55">로딩 중...</p>
      ) : playlists.length === 0 ? (
        <p className="py-8 text-center text-sm text-light-text/55 dark:text-dark-text/55">
          아직 클립 플레이리스트가 없습니다. 라이브 클립에서 추가해보세요.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {playlists.map((p) => (
            <div
              key={p._id}
              className="flex items-center gap-3 rounded-xl border border-light-primary/15 dark:border-dark-primary/15 bg-white/50 dark:bg-gray-800/40 p-3"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-light-accent/15 dark:bg-dark-accent/15">
                <FilmIcon className="h-5 w-5 text-light-accent dark:text-dark-accent" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-medium text-light-text dark:text-dark-text">{p.name}</span>
                  {p.isPublic ? (
                    <EyeIcon className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  ) : (
                    <EyeSlashIcon className="h-3.5 w-3.5 shrink-0 text-light-text/40 dark:text-dark-text/40" />
                  )}
                </div>
                <div className="text-xs text-light-text/55 dark:text-dark-text/55">{p.clipCount}개 클립</div>
              </div>
              {p.shareId && (
                <Link
                  href={`/clip-playlist/${p.shareId}`}
                  className="p-1.5 text-light-text/50 hover:text-light-accent dark:text-dark-text/50 dark:hover:text-dark-accent"
                  title="열기 / 재생"
                >
                  <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                </Link>
              )}
              <button
                onClick={() => handleDelete(p._id, p.name)}
                disabled={deletingId === p._id}
                className="p-1.5 text-light-text/50 hover:text-red-500 disabled:opacity-40 dark:text-dark-text/50"
                title="삭제"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
