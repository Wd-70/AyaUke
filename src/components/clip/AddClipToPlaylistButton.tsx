'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useSession } from 'next-auth/react';
import { PlusIcon, CheckIcon, ListBulletIcon, ArrowTopRightOnSquareIcon, QueueListIcon } from '@heroicons/react/24/outline';
import { useGlobalClipPlaylists } from '@/hooks/useGlobalClipPlaylists';
import { useToast } from '@/components/Toast';

interface AddClipToPlaylistButtonProps {
  clipId: string;
  /** 트리거 버튼 className (아이콘 버튼 스타일) */
  className?: string;
  /** 큰 버튼(텍스트 포함)으로 렌더 — 공유 페이지 등에서 사용 */
  variant?: 'icon' | 'button';
}

/** 클립을 사용자의 클립 플레이리스트에 추가/제거하는 트리거 버튼 + 팝오버 */
export default function AddClipToPlaylistButton({ clipId, className = '', variant = 'icon' }: AddClipToPlaylistButtonProps) {
  const { data: session } = useSession();
  const { showError } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);

  const openMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!session?.user?.channelId) {
      showError('로그인 필요', '클립 플레이리스트는 로그인 후 이용할 수 있습니다.');
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setPosition({ x: rect.left, y: rect.bottom + 6 });
    setIsOpen(true);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={openMenu}
        aria-label="클립 플레이리스트에 추가"
        title="클립 플레이리스트에 추가"
        className={
          variant === 'button'
            ? `inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-light-primary/20 dark:border-dark-primary/20 text-light-text/70 dark:text-dark-text/70 hover:border-light-accent/40 hover:text-light-accent dark:hover:text-dark-accent transition-colors ${className}`
            : `inline-flex items-center px-1.5 py-0.5 text-light-text/45 transition-colors hover:text-light-accent dark:text-dark-text/45 dark:hover:text-dark-accent ${className}`
        }
      >
        <QueueListIcon className="h-4 w-4" />
        {variant === 'button' && <span>플레이리스트</span>}
      </button>

      {isOpen && (
        <ClipPlaylistMenu clipId={clipId} position={position} onClose={() => setIsOpen(false)} />
      )}
    </>
  );
}

interface MenuProps {
  clipId: string;
  position: { x: number; y: number };
  onClose: () => void;
}

function ClipPlaylistMenu({ clipId, position, onClose }: MenuProps) {
  const {
    playlists,
    isLoading,
    createPlaylist,
    addClipToPlaylist,
    removeClipFromPlaylist,
    getPlaylistsForClip,
    isClipOperating,
    refresh,
  } = useGlobalClipPlaylists();
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const clipPlaylists = getPlaylistsForClip(clipId);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) onClose();
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isCreating) {
          setIsCreating(false);
          setNewName('');
        } else {
          onClose();
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isCreating, onClose]);

  useEffect(() => {
    if (isCreating) inputRef.current?.focus();
  }, [isCreating]);

  const toggle = async (playlistId: string) => {
    const isIn = clipPlaylists.some((p) => p._id === playlistId);
    const success = isIn
      ? await removeClipFromPlaylist(playlistId, clipId)
      : await addClipToPlaylist(playlistId, clipId);
    if (success) await refresh();
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    let created = await createPlaylist({ name });
    // 이름 중복 시 번호 부여 재시도
    let counter = 2;
    while (!created && counter <= 10) {
      created = await createPlaylist({ name: `${name} (${counter})` });
      counter++;
    }
    if (created) {
      await addClipToPlaylist(created._id, clipId);
      await refresh();
    }
    setNewName('');
    setIsCreating(false);
  };

  // 화면 밖으로 나가지 않게 위치 보정
  const menuWidth = 280;
  const padding = 16;
  const x = Math.max(padding, Math.min(position.x, window.innerWidth - menuWidth - padding));
  const y = Math.max(padding, Math.min(position.y, window.innerHeight - 420));

  return createPortal(
    <AnimatePresence>
      <motion.div
        ref={menuRef}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        className="fixed z-[90] bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-light-primary/20 dark:border-dark-primary/20"
        style={{ left: x, top: y, width: menuWidth, maxHeight: 400 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-light-primary/10 dark:border-dark-primary/10">
          <div className="flex items-center gap-2">
            <ListBulletIcon className="w-5 h-5 text-light-accent dark:text-dark-accent" />
            <h3 className="font-semibold text-light-text dark:text-dark-text">클립 플레이리스트에 추가</h3>
          </div>
        </div>

        <div className="max-h-64 overflow-y-auto">
          {isLoading && playlists.length === 0 ? (
            <div className="px-4 py-6 text-center text-light-text/60 dark:text-dark-text/60">로딩 중...</div>
          ) : playlists.length === 0 ? (
            <div className="px-4 py-6 text-center text-light-text/60 dark:text-dark-text/60">클립 플레이리스트가 없습니다</div>
          ) : (
            playlists.map((playlist) => {
              const isIn = clipPlaylists.some((p) => p._id === playlist._id);
              const operating = isClipOperating(clipId, playlist._id);
              return (
                <div
                  key={playlist._id}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-light-primary/10 dark:hover:bg-dark-primary/10 transition-colors"
                >
                  <button
                    onClick={() => toggle(playlist._id)}
                    disabled={operating}
                    className="flex items-center gap-3 flex-1 disabled:opacity-50"
                  >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      operating
                        ? 'border-light-accent dark:border-dark-accent animate-spin'
                        : isIn
                          ? 'bg-light-accent dark:bg-dark-accent border-light-accent dark:border-dark-accent'
                          : 'border-light-text/30 dark:border-dark-text/30'
                    }`}>
                      {operating ? (
                        <div className="w-2 h-2 bg-light-accent dark:bg-dark-accent rounded-full animate-pulse" />
                      ) : isIn ? (
                        <CheckIcon className="w-3 h-3 text-white" />
                      ) : null}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-medium text-light-text dark:text-dark-text">{playlist.name}</div>
                      <div className="text-xs text-light-text/60 dark:text-dark-text/60">{playlist.clipCount}개</div>
                    </div>
                  </button>
                  {playlist.shareId && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(`/clip-playlist/${playlist.shareId}`, '_blank');
                        onClose();
                      }}
                      className="p-1 rounded hover:bg-light-primary/20 dark:hover:bg-dark-primary/20 transition-colors"
                      title="클립 플레이리스트 보기"
                    >
                      <ArrowTopRightOnSquareIcon className="w-4 h-4 text-light-text/60 dark:text-dark-text/60 hover:text-light-accent dark:hover:text-dark-accent" />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="border-t border-light-primary/10 dark:border-dark-primary/10">
          {isCreating ? (
            <div className="p-4">
              <input
                ref={inputRef}
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCreate();
                  }
                }}
                placeholder="클립 플레이리스트 이름"
                maxLength={100}
                className="w-full px-3 py-2 text-sm border border-light-primary/20 dark:border-dark-primary/20 rounded-lg bg-white dark:bg-gray-700 text-light-text dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent"
              />
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleCreate}
                  disabled={!newName.trim()}
                  className="flex-1 px-3 py-2 text-sm bg-light-accent dark:bg-dark-accent text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  생성
                </button>
                <button
                  onClick={() => {
                    setIsCreating(false);
                    setNewName('');
                  }}
                  className="flex-1 px-3 py-2 text-sm bg-light-primary/20 dark:bg-dark-primary/20 text-light-text dark:text-dark-text rounded-lg hover:bg-light-primary/30 dark:hover:bg-dark-primary/30 transition-colors"
                >
                  취소
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsCreating(true)}
              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-light-primary/10 dark:hover:bg-dark-primary/10 transition-colors text-light-accent dark:text-dark-accent"
            >
              <PlusIcon className="w-5 h-5" />
              <span className="font-medium">새 클립 플레이리스트 만들기</span>
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
