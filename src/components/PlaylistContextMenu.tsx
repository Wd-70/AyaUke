'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGlobalPlaylists, useSongPlaylists } from '@/hooks/useGlobalPlaylists';
import { useSession } from 'next-auth/react';
import { PlusIcon, CheckIcon, ListBulletIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';

interface PlaylistContextMenuProps {
  songId: string;
  isOpen: boolean;
  position: { x: number; y: number };
  onClose: () => void;
}

export default function PlaylistContextMenu({ songId, isOpen, position, onClose }: PlaylistContextMenuProps) {
  const { data: session } = useSession();
  const { playlists: allPlaylists, isLoading: playlistsLoading, createPlaylist, addSongToPlaylist, removeSongFromPlaylist, refresh, isSongOperating } = useGlobalPlaylists();
  const { playlists: songPlaylists } = useSongPlaylists(songId);
  const [isCreating, setIsCreating] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const createInputRef = useRef<HTMLInputElement>(null);

  // 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isCreating) {
          setIsCreating(false);
          setNewPlaylistName('');
        } else {
          onClose();
        }
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, isCreating, onClose]);

  // 새 플레이리스트 생성 모드 시 input에 포커스
  useEffect(() => {
    if (isCreating && createInputRef.current) {
      createInputRef.current.focus();
    }
  }, [isCreating]);

  const handlePlaylistToggle = async (playlistId: string) => {
    const isInPlaylist = songPlaylists.some(p => p._id === playlistId);
    
    console.log(`🎵 곡 ${songId} - 플레이리스트 ${playlistId}: ${isInPlaylist ? '제거' : '추가'} 시도`);
    console.log('📋 현재 songPlaylists:', songPlaylists);
    console.log('📋 전체 플레이리스트:', allPlaylists.map(p => ({ id: p._id, name: p.name, songCount: p.songCount })));
    
    let success = false;
    if (isInPlaylist) {
      console.log('❌ 곡 제거 실행');
      success = await removeSongFromPlaylist(playlistId, songId);
    } else {
      console.log('➕ 곡 추가 실행');
      success = await addSongToPlaylist(playlistId, songId);
    }
    
    if (success) {
      console.log('✅ 플레이리스트 작업 성공, 데이터 새로고침');
      // 성공 시 플레이리스트 데이터 새로고침
      await refresh();
    } else {
      console.error('❌ 플레이리스트 작업 실패');
    }
  };

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return;

    const newPlaylist = await createPlaylist({
      name: newPlaylistName.trim()
    });

    if (newPlaylist) {
      // 새로 생성된 플레이리스트에 곡 추가
      const success = await addSongToPlaylist(newPlaylist._id, songId);
      if (success) {
        await refresh(); // 플레이리스트 데이터 새로고침
      }
      setNewPlaylistName('');
      setIsCreating(false);
    } else {
      // 이미 같은 이름의 플레이리스트가 있는 경우 자동으로 번호 추가
      let counter = 2;
      let uniqueName = `${newPlaylistName.trim()} (${counter})`;
      
      while (counter <= 10) { // 최대 10번까지 시도
        const result = await createPlaylist({
          name: uniqueName
        });
        
        if (result) {
          const success = await addSongToPlaylist(result._id, songId);
          if (success) {
            await refresh(); // 플레이리스트 데이터 새로고침
          }
          setNewPlaylistName('');
          setIsCreating(false);
          break;
        }
        
        counter++;
        uniqueName = `${newPlaylistName.trim()} (${counter})`;
      }
    }
  };

  const handleCreateKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCreatePlaylist();
    }
  };

  const handleGoToPlaylist = (e: React.MouseEvent, shareId: string) => {
    e.preventDefault();
    e.stopPropagation();
    window.open(`/playlist/${shareId}`, '_blank');
    onClose();
  };

  // 메뉴 위치 조정 (화면 밖으로 나가지 않도록)
  const getMenuPosition = () => {
    if (!menuRef.current) return position;

    const menuWidth = 280;
    const menuHeight = 400;
    const padding = 16;

    let { x, y } = position;

    // 오른쪽 경계 체크
    if (x + menuWidth > window.innerWidth - padding) {
      x = window.innerWidth - menuWidth - padding;
    }

    // 하단 경계 체크
    if (y + menuHeight > window.innerHeight - padding) {
      y = window.innerHeight - menuHeight - padding;
    }

    // 최소값 체크
    x = Math.max(padding, x);
    y = Math.max(padding, y);

    return { x, y };
  };

  const adjustedPosition = getMenuPosition();

  if (!isOpen || !session?.user?.channelId) return null;

  return (
    <AnimatePresence>
      <motion.div
        ref={menuRef}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.15 }}
        className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-light-primary/20 dark:border-dark-primary/20 backdrop-blur-sm"
        style={{
          left: adjustedPosition.x,
          top: adjustedPosition.y,
          width: '280px',
          maxHeight: '400px'
        }}
      >
        {/* 헤더 */}
        <div className="px-4 py-3 border-b border-light-primary/10 dark:border-dark-primary/10">
          <div className="flex items-center gap-2">
            <ListBulletIcon className="w-5 h-5 text-light-accent dark:text-dark-accent" />
            <h3 className="font-semibold text-light-text dark:text-dark-text">플레이리스트에 추가</h3>
          </div>
        </div>

        {/* 플레이리스트 목록 */}
        <div className="max-h-64 overflow-y-auto">
          {playlistsLoading && allPlaylists.length === 0 ? (
            <div className="px-4 py-6 text-center text-light-text/60 dark:text-dark-text/60">
              로딩 중...
            </div>
          ) : allPlaylists.length === 0 ? (
            <div className="px-4 py-6 text-center text-light-text/60 dark:text-dark-text/60">
              플레이리스트가 없습니다
            </div>
          ) : (
            allPlaylists.map((playlist) => {
              const isInPlaylist = songPlaylists.some(p => p._id === playlist._id);
              const isOperating = isSongOperating(songId, playlist._id);
              
              return (
                <div
                  key={playlist._id}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-light-primary/10 dark:hover:bg-dark-primary/10 transition-colors duration-200"
                >
                  <button
                    onClick={() => handlePlaylistToggle(playlist._id)}
                    disabled={isOperating}
                    className="flex items-center gap-3 flex-1 disabled:opacity-50"
                  >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors duration-200 ${
                      isOperating
                        ? 'border-light-accent dark:border-dark-accent animate-spin'
                        : isInPlaylist 
                          ? 'bg-light-accent dark:bg-dark-accent border-light-accent dark:border-dark-accent' 
                          : 'border-light-text/30 dark:border-dark-text/30'
                    }`}>
                      {isOperating ? (
                        <div className="w-2 h-2 bg-light-accent dark:bg-dark-accent rounded-full animate-pulse" />
                      ) : isInPlaylist ? (
                        <CheckIcon className="w-3 h-3 text-white" />
                      ) : null}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-medium text-light-text dark:text-dark-text">
                        {playlist.name}
                      </div>
                      <div className="text-xs text-light-text/60 dark:text-dark-text/60">
                        {playlist.songCount}곡
                      </div>
                    </div>
                  </button>
                  {playlist.shareId && (
                    <button
                      onClick={(e) => handleGoToPlaylist(e, playlist.shareId!)}
                      className="p-1 rounded hover:bg-light-primary/20 dark:hover:bg-dark-primary/20 transition-colors duration-200"
                      title="플레이리스트 상세 보기"
                    >
                      <ArrowTopRightOnSquareIcon className="w-4 h-4 text-light-text/60 dark:text-dark-text/60 hover:text-light-accent dark:hover:text-dark-accent" />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* 새 플레이리스트 생성 */}
        <div className="border-t border-light-primary/10 dark:border-dark-primary/10">
          {isCreating ? (
            <div className="p-4">
              <input
                ref={createInputRef}
                type="text"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                onKeyDown={handleCreateKeyDown}
                placeholder="플레이리스트 이름"
                className="w-full px-3 py-2 text-sm border border-light-primary/20 dark:border-dark-primary/20 rounded-lg 
                         bg-white dark:bg-gray-700 text-light-text dark:text-dark-text
                         focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent"
                maxLength={100}
              />
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleCreatePlaylist}
                  disabled={!newPlaylistName.trim()}
                  className="flex-1 px-3 py-2 text-sm bg-light-accent dark:bg-dark-accent text-white rounded-lg
                           hover:opacity-90 transition-opacity duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  생성
                </button>
                <button
                  onClick={() => {
                    setIsCreating(false);
                    setNewPlaylistName('');
                  }}
                  className="flex-1 px-3 py-2 text-sm bg-light-primary/20 dark:bg-dark-primary/20 text-light-text dark:text-dark-text rounded-lg
                           hover:bg-light-primary/30 dark:hover:bg-dark-primary/30 transition-colors duration-200"
                >
                  취소
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsCreating(true)}
              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-light-primary/10 dark:hover:bg-dark-primary/10 transition-colors duration-200 text-light-accent dark:text-dark-accent"
            >
              <PlusIcon className="w-5 h-5" />
              <span className="font-medium">새 플레이리스트 만들기</span>
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}