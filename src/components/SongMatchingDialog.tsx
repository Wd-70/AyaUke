'use client';

import { useState, useEffect } from 'react';
import { XMarkIcon, MagnifyingGlassIcon, MusicalNoteIcon } from '@heroicons/react/24/outline';

interface SongCandidate {
  song: {
    _id: string;
    title: string;
    artist: string;
    titleAlias?: string;
    artistAlias?: string;
    searchTags?: string[];
  };
  artistSimilarity: number;
  titleSimilarity: number;
  overallSimilarity: number;
  isExactMatch: boolean;
}

interface SongMatchingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  timelineItem: {
    id: string;
    artist: string;
    songTitle: string;
    timeText: string;
    matchedSong?: {
      songId: string;
      title: string;
      artist: string;
      confidence: number;
    };
  };
  onMatch: (songId: string | null, confidence?: number) => Promise<void>;
}

export default function SongMatchingDialog({
  isOpen,
  onClose,
  timelineItem,
  onMatch,
}: SongMatchingDialogProps) {
  const [candidates, setCandidates] = useState<SongCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>('');
  const [customArtist, setCustomArtist] = useState(timelineItem.artist);
  const [customTitle, setCustomTitle] = useState(timelineItem.songTitle);
  const [isCustomSearch, setIsCustomSearch] = useState(false);

  // 초기 검색
  useEffect(() => {
    if (isOpen) {
      searchSongs(timelineItem.artist, timelineItem.songTitle);
      setCustomArtist(timelineItem.artist);
      setCustomTitle(timelineItem.songTitle);
      setIsCustomSearch(false);
    }
  }, [isOpen, timelineItem.id, timelineItem.artist, timelineItem.songTitle]);

  const searchSongs = async (artist: string, title: string) => {
    if (!artist.trim() || !title.trim()) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/timeline-parser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'search-song-matches',
          searchArtist: artist.trim(),
          searchTitle: title.trim(),
        }),
      });

      const result = await response.json();
      if (result.success) {
        setCandidates(result.data.candidates || []);
        
        // 완전 일치하는 항목이 있으면 자동 선택
        const exactMatch = result.data.candidates?.find((c: SongCandidate) => c.isExactMatch);
        if (exactMatch && !timelineItem.matchedSong) {
          setSelectedCandidateId(exactMatch.song._id);
        }
      }
    } catch (error) {
      console.error('곡 검색 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCustomSearch = () => {
    if (customArtist.trim() && customTitle.trim()) {
      setIsCustomSearch(true);
      searchSongs(customArtist, customTitle);
    }
  };

  const handleMatch = async () => {
    try {
      const selectedCandidate = candidates.find(c => c.song._id === selectedCandidateId);
      await onMatch(
        selectedCandidateId || null,
        selectedCandidate?.overallSimilarity || 0.9
      );
      onClose();
    } catch (error) {
      console.error('매칭 오류:', error);
    }
  };

  const handleUnmatch = async () => {
    try {
      await onMatch(null);
      onClose();
    } catch (error) {
      console.error('매칭 해제 오류:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              곡 매칭 - {timelineItem.timeText}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              원본: "{timelineItem.artist}" - "{timelineItem.songTitle}"
            </p>
            {timelineItem.matchedSong && (
              <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                현재 매칭: {timelineItem.matchedSong.artist} - {timelineItem.matchedSong.title}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* 커스텀 검색 */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            검색어 수정
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                아티스트
              </label>
              <input
                type="text"
                value={customArtist}
                onChange={(e) => setCustomArtist(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                placeholder="아티스트명 입력"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                곡명
              </label>
              <input
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                placeholder="곡명 입력"
              />
            </div>
          </div>
          <button
            onClick={handleCustomSearch}
            disabled={loading || !customArtist.trim() || !customTitle.trim()}
            className="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <MagnifyingGlassIcon className="h-4 w-4 mr-2" />
            다시 검색
          </button>
        </div>

        {/* 검색 결과 */}
        <div className="flex-1 p-6">
          <div className="max-h-80 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-gray-100 dark:scrollbar-track-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              검색 결과 ({candidates.length}개)
            </h3>
            {loading && (
              <div className="text-sm text-gray-500">검색 중...</div>
            )}
          </div>

          {candidates.length === 0 && !loading && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              검색 결과가 없습니다.
            </div>
          )}

          <div className="space-y-3">
            {candidates.map((candidate) => (
              <div
                key={candidate.song._id}
                className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                  selectedCandidateId === candidate.song._id
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
                onClick={() => setSelectedCandidateId(candidate.song._id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <MusicalNoteIcon className="h-4 w-4 text-purple-500" />
                      <span className="font-medium text-gray-900 dark:text-white">
                        {candidate.song.artist}
                      </span>
                      <span className="text-gray-500">-</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {candidate.song.title}
                      </span>
                      {candidate.isExactMatch && (
                        <span className="px-2 py-1 text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded">
                          완전 일치
                        </span>
                      )}
                    </div>
                    
                    {(candidate.song.artistAlias || candidate.song.titleAlias) && (
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {candidate.song.artistAlias && `아티스트 별명: ${candidate.song.artistAlias}`}
                        {candidate.song.artistAlias && candidate.song.titleAlias && ' | '}
                        {candidate.song.titleAlias && `곡명 별명: ${candidate.song.titleAlias}`}
                      </div>
                    )}
                    
                    {candidate.song.searchTags && candidate.song.searchTags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {candidate.song.searchTags.map((tag, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="ml-4 text-right">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      전체: {Math.round(candidate.overallSimilarity * 100)}%
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-500">
                      아티스트: {Math.round(candidate.artistSimilarity * 100)}% | 
                      곡명: {Math.round(candidate.titleSimilarity * 100)}%
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
          <div>
            {timelineItem.matchedSong && (
              <button
                onClick={handleUnmatch}
                className="px-4 py-2 text-red-600 hover:text-red-700 border border-red-300 hover:border-red-400 rounded-md"
              >
                매칭 해제
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
            >
              취소
            </button>
            <button
              onClick={handleMatch}
              disabled={!selectedCandidateId}
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              매칭하기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}