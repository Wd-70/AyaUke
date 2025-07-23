'use client';

import { useState, useEffect } from 'react';
import { MagnifyingGlassIcon, MusicalNoteIcon } from '@heroicons/react/24/outline';
import { SongDetail } from '@/types';

interface SongWithId extends SongDetail {
  _id: string;
}

export default function SongManagerTab() {
  const [songs, setSongs] = useState<SongWithId[]>([]);
  const [filteredSongs, setFilteredSongs] = useState<SongWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // 노래 데이터 로드
  const loadSongs = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/song-details?limit=1000');
      if (response.ok) {
        const data = await response.json();
        
        // 응답 형식 확인 및 처리
        if (data.success && data.songs) {
          // {success: true, songs: [...]} 형식
          setSongs(data.songs);
          setFilteredSongs(data.songs);
        } else if (Array.isArray(data)) {
          // 직접 배열 형식
          setSongs(data);
          setFilteredSongs(data);
        } else {
          console.error('예상하지 못한 데이터 형식:', data);
        }
      } else {
        console.error('노래 데이터 로드 실패:', response.status);
      }
    } catch (error) {
      console.error('노래 데이터 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  // 검색 필터링
  const handleSearch = (term: string) => {
    setSearchTerm(term);
    if (!term.trim()) {
      setFilteredSongs(songs);
    } else {
      const filtered = songs.filter(song => 
        song.title?.toLowerCase().includes(term.toLowerCase()) ||
        song.artist?.toLowerCase().includes(term.toLowerCase()) ||
        song.aliases?.some(alias => alias.toLowerCase().includes(term.toLowerCase())) ||
        song.personalNotes?.toLowerCase().includes(term.toLowerCase())
      );
      setFilteredSongs(filtered);
    }
  };

  useEffect(() => {
    loadSongs();
  }, []);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-light-accent dark:border-dark-accent"></div>
        <span className="ml-3 text-gray-600 dark:text-gray-400">노래 데이터 로딩 중...</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <MusicalNoteIcon className="w-6 h-6 text-light-accent dark:text-dark-accent" />
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            노래 관리
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            MongoDB의 노래 상세 데이터를 조회하고 관리합니다.
          </p>
        </div>
      </div>

      {/* 검색 */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="노래 제목, 아티스트, 별명, 메모로 검색..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent focus:border-transparent"
          />
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {filteredSongs.length} / {songs.length}곡
        </div>
      </div>

      {/* 노래 목록 */}
      <div className="space-y-3">
        {filteredSongs.map((song) => (
          <div
            key={song._id}
            className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {song.title}
                  </h3>
                  <span className="text-gray-500 dark:text-gray-400">-</span>
                  <span className="text-gray-700 dark:text-gray-300">
                    {song.artist}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  {/* 기본 정보 */}
                  <div className="space-y-1">
                    {song.language && (
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">언어:</span>{' '}
                        <span className="text-gray-700 dark:text-gray-300">{song.language}</span>
                      </div>
                    )}
                    {song.dateAdded && (
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">추가일:</span>{' '}
                        <span className="text-gray-700 dark:text-gray-300">{song.dateAdded}</span>
                      </div>
                    )}
                    {song.lastSungDate && (
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">마지막 부른 날:</span>{' '}
                        <span className="text-gray-700 dark:text-gray-300">{song.lastSungDate}</span>
                      </div>
                    )}
                    {song.difficulty && (
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">난이도:</span>{' '}
                        <span className="text-gray-700 dark:text-gray-300">{song.difficulty}/5</span>
                      </div>
                    )}
                  </div>

                  {/* 추가 정보 */}
                  <div className="space-y-1">
                    {song.aliases && song.aliases.length > 0 && (
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">별명:</span>{' '}
                        <span className="text-gray-700 dark:text-gray-300">
                          {song.aliases.join(', ')}
                        </span>
                      </div>
                    )}
                    {song.tags && song.tags.length > 0 && (
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">태그:</span>{' '}
                        <div className="inline-flex flex-wrap gap-1 mt-1">
                          {song.tags.map((tag, index) => (
                            <span
                              key={index}
                              className="px-2 py-1 bg-light-accent/10 dark:bg-dark-accent/10 text-light-accent dark:text-dark-accent rounded-full text-xs"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 개인 메모 */}
                {song.personalNotes && (
                  <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
                    <div className="text-sm">
                      <span className="text-yellow-700 dark:text-yellow-300 font-medium">메모:</span>{' '}
                      <span className="text-yellow-600 dark:text-yellow-400">{song.personalNotes}</span>
                    </div>
                  </div>
                )}

                {/* MR 링크 */}
                {song.mrLinks && song.mrLinks.length > 0 && (
                  <div className="mt-3">
                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">MR 링크:</div>
                    <div className="space-y-1">
                      {song.mrLinks.map((link, index) => (
                        <div key={index} className="text-xs">
                          <span className="text-gray-600 dark:text-gray-400">{link.type}:</span>{' '}
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            {link.url}
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 통계 */}
                <div className="mt-3 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                  {typeof song.timesPlayed === 'number' && (
                    <span>재생 횟수: {song.timesPlayed}</span>
                  )}
                  {typeof song.likes === 'number' && (
                    <span>좋아요: {song.likes}</span>
                  )}
                  {typeof song.bookmarks === 'number' && (
                    <span>즐겨찾기: {song.bookmarks}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

        {filteredSongs.length === 0 && !loading && (
          <div className="text-center py-8">
            <MusicalNoteIcon className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">
              {searchTerm ? '검색 결과가 없습니다.' : '노래 데이터가 없습니다.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}