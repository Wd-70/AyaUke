'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SongVideo } from '@/types';
import { 
  PlusIcon, 
  XMarkIcon, 
  PencilIcon, 
  TrashIcon, 
  CheckIcon,
  ClockIcon,
  CalendarIcon,
  PlayIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { useSession } from 'next-auth/react';
import { UserRole, roleToIsAdmin } from '@/lib/permissions';

interface LiveClipEditorProps {
  songId: string;
  songTitle: string;
  songVideos: SongVideo[];
  setSongVideos: (videos: SongVideo[]) => void;
  videosLoading: boolean;
  loadSongVideos: () => Promise<void>;
}

export default function LiveClipEditor({ 
  songId, 
  songTitle, 
  songVideos, 
  setSongVideos, 
  videosLoading, 
  loadSongVideos 
}: LiveClipEditorProps) {
  const { data: session } = useSession();
  
  // 편집 UI 상태
  const [showAddVideoForm, setShowAddVideoForm] = useState(false);
  const [editingVideoId, setEditingVideoId] = useState<string | null>(null);
  const [isDeletingVideo, setIsDeletingVideo] = useState<string | null>(null);
  
  // 추가/편집 폼 데이터
  const [formData, setFormData] = useState({
    videoUrl: '',
    sungDate: '',
    description: '',
    startTime: 0,
    endTime: undefined as number | undefined
  });
  
  const [videoMetadata, setVideoMetadata] = useState({
    title: '',
    extractedDate: ''
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // 권한 확인
  const isAdmin = session?.user?.isAdmin && roleToIsAdmin(session.user.role as UserRole);
  const canEditAllClips = isAdmin;

  // YouTube URL에서 시간 파라미터 추출
  const extractTimeFromUrl = (url: string): number => {
    if (!url) return 0;
    
    const timeMatch = url.match(/[?&]t=(\d+)/);
    if (timeMatch) {
      return parseInt(timeMatch[1], 10);
    }
    
    const startMatch = url.match(/[?&]start=(\d+)/);
    if (startMatch) {
      return parseInt(startMatch[1], 10);
    }
    
    return 0;
  };

  // YouTube URL에서 비디오 ID 추출
  const extractVideoId = (url: string): string => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
    return match ? match[1] : '';
  };

  // 시간을 hh:mm:ss 형식으로 변환
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
  };

  // URL 변경 시 메타데이터 추출
  const handleUrlChange = (url: string) => {
    setFormData(prev => ({ ...prev, videoUrl: url }));
    
    if (url) {
      const startTime = extractTimeFromUrl(url);
      setFormData(prev => ({ ...prev, startTime }));
    }
  };

  // 시작 시간 입력 처리 (숫자 또는 URL 자동 인식)
  const handleStartTimeChange = (value: string) => {
    // URL인지 확인 (http로 시작하거나 youtube.com 포함)
    if (value.includes('youtube.com') || value.includes('youtu.be') || value.startsWith('http')) {
      const extractedTime = extractTimeFromUrl(value);
      setFormData(prev => ({ ...prev, startTime: extractedTime }));
    } else {
      // 숫자로 처리
      const numValue = parseInt(value) || 0;
      setFormData(prev => ({ ...prev, startTime: numValue }));
    }
  };

  // 종료 시간 입력 처리 (숫자 또는 URL 자동 인식)
  const handleEndTimeChange = (value: string) => {
    if (!value) {
      setFormData(prev => ({ ...prev, endTime: undefined }));
      return;
    }
    
    // URL인지 확인
    if (value.includes('youtube.com') || value.includes('youtu.be') || value.startsWith('http')) {
      const extractedTime = extractTimeFromUrl(value);
      setFormData(prev => ({ ...prev, endTime: extractedTime }));
    } else {
      // 숫자로 처리
      const numValue = parseInt(value);
      setFormData(prev => ({ ...prev, endTime: isNaN(numValue) ? undefined : numValue }));
    }
  };

  // 폼 초기화
  const resetForm = () => {
    setFormData({
      videoUrl: '',
      sungDate: '',
      description: '',
      startTime: 0,
      endTime: undefined
    });
    setVideoMetadata({
      title: '',
      extractedDate: ''
    });
    setError('');
  };

  // 편집 시작
  const startEdit = (video: SongVideo) => {
    setEditingVideoId(video._id);
    
    // 날짜를 YYYY-MM-DD 형식으로 변환 (HTML input[type="date"] 호환)
    let formattedDate = '';
    if (video.sungDate) {
      const date = new Date(video.sungDate);
      if (!isNaN(date.getTime())) {
        formattedDate = date.toISOString().split('T')[0];
      }
    }
    
    setFormData({
      videoUrl: video.videoUrl,
      sungDate: formattedDate,
      description: video.description || '',
      startTime: video.startTime || 0,
      endTime: video.endTime
    });
  };

  // 편집 취소
  const cancelEdit = () => {
    setEditingVideoId(null);
    resetForm();
  };

  // 클립 추가/수정
  const handleSubmit = async () => {
    if (!formData.videoUrl || !formData.sungDate) {
      setError('YouTube URL과 부른 날짜는 필수입니다.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const url = editingVideoId 
        ? `/api/videos/${editingVideoId}`
        : `/api/songs/${songId}/videos`;
      
      const method = editingVideoId ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        await loadSongVideos();
        resetForm();
        setShowAddVideoForm(false);
        setEditingVideoId(null);
      } else {
        const errorData = await response.json();
        setError(errorData.error || '저장에 실패했습니다.');
      }
    } catch (error) {
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 클립 삭제
  const handleDelete = async (videoId: string) => {
    if (!confirm('정말로 이 라이브 클립을 삭제하시겠습니까?')) return;
    
    setIsDeletingVideo(videoId);
    
    try {
      const response = await fetch(`/api/videos/${videoId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await loadSongVideos();
      } else {
        console.error('삭제 실패');
      }
    } catch (error) {
      console.error('삭제 오류:', error);
    } finally {
      setIsDeletingVideo(null);
    }
  };

  // 사용자가 편집할 수 있는 클립인지 확인
  const canEditClip = (video: SongVideo) => {
    if (canEditAllClips) return true;
    return video.addedBy === session?.user?.userId;
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          라이브 클립 편집
        </h3>
        <button
          onClick={() => {
            resetForm();
            setShowAddVideoForm(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-light-accent dark:bg-dark-accent text-white rounded-lg hover:opacity-90 transition-opacity duration-200"
        >
          <PlusIcon className="w-4 h-4" />
          클립 추가
        </button>
      </div>

      {/* 에러 메시지 */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg flex items-center gap-2"
          >
            <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 추가/편집 폼 */}
      <AnimatePresence>
        {(showAddVideoForm || editingVideoId) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg space-y-4"
          >
            <h4 className="font-medium text-gray-900 dark:text-white">
              {editingVideoId ? '클립 편집' : '새 클립 추가'}
            </h4>
            
            {/* YouTube URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                YouTube URL *
              </label>
              <input
                type="url"
                value={formData.videoUrl}
                onChange={(e) => handleUrlChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="https://youtube.com/watch?v=..."
              />
            </div>

            {/* 시간 설정 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 시작 시간 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  시작 시간
                </label>
                <input
                  type="text"
                  value={formData.startTime}
                  onChange={(e) => handleStartTimeChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="초 단위 또는 YouTube URL"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {formatTime(formData.startTime)}
                </p>
              </div>

              {/* 종료 시간 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  종료 시간 (선택사항)
                </label>
                <input
                  type="text"
                  value={formData.endTime || ''}
                  onChange={(e) => handleEndTimeChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="초 단위 또는 YouTube URL"
                />
                {formData.endTime && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {formatTime(formData.endTime)}
                  </p>
                )}
              </div>
            </div>

            {/* 부른 날짜 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                부른 날짜 *
              </label>
              <input
                type="date"
                value={formData.sungDate}
                onChange={(e) => setFormData(prev => ({ ...prev, sungDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            {/* 설명 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                설명 (선택사항)
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                rows={3}
                placeholder="클립에 대한 추가 설명..."
              />
            </div>

            {/* 버튼들 */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex items-center gap-2 px-4 py-2 bg-light-accent dark:bg-dark-accent text-white rounded-lg hover:opacity-90 transition-opacity duration-200 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    저장 중...
                  </>
                ) : (
                  <>
                    <CheckIcon className="w-4 h-4" />
                    {editingVideoId ? '수정' : '추가'}
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  if (editingVideoId) {
                    cancelEdit();
                  } else {
                    setShowAddVideoForm(false);
                    resetForm();
                  }
                }}
                disabled={isSubmitting}
                className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors duration-200 disabled:opacity-50"
              >
                취소
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 클립 목록 */}
      <div className="space-y-3">
        {videosLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-light-accent dark:border-dark-accent mx-auto"></div>
            <p className="text-gray-500 dark:text-gray-400 mt-2">클립을 불러오는 중...</p>
          </div>
        ) : songVideos.length === 0 ? (
          <div className="text-center py-8">
            <PlayIcon className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">등록된 라이브 클립이 없습니다.</p>
          </div>
        ) : (
          songVideos.map((video, index) => (
            <motion.div
              key={video._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {/* 비디오 정보 */}
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-16 h-12 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden flex-shrink-0">
                      {video.videoUrl && (
                        <img
                          src={`https://img.youtube.com/vi/${extractVideoId(video.videoUrl)}/mqdefault.jpg`}
                          alt="Video thumbnail"
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">
                        {songTitle} - 라이브 클립 #{index + 1}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mt-1">
                        <span className="flex items-center gap-1">
                          <CalendarIcon className="w-3 h-3" />
                          {new Date(video.sungDate).toLocaleDateString('ko-KR')}
                        </span>
                        {video.startTime && (
                          <span className="flex items-center gap-1">
                            <ClockIcon className="w-3 h-3" />
                            {formatTime(video.startTime)}
                            {video.endTime && ` - ${formatTime(video.endTime)}`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 설명 */}
                  {video.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {video.description}
                    </p>
                  )}

                  {/* 업로더 정보 */}
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    업로더: {video.addedByName || '알 수 없음'}
                  </p>
                </div>

                {/* 액션 버튼들 */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {canEditClip(video) && (
                    <>
                      <button
                        onClick={() => startEdit(video)}
                        disabled={editingVideoId === video._id}
                        className="p-2 text-gray-400 hover:text-light-accent dark:hover:text-dark-accent transition-colors duration-200 disabled:opacity-50"
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(video._id)}
                        disabled={isDeletingVideo === video._id}
                        className="p-2 text-gray-400 hover:text-red-500 transition-colors duration-200 disabled:opacity-50"
                      >
                        {isDeletingVideo === video._id ? (
                          <div className="w-4 h-4 border-2 border-gray-400 border-t-red-500 rounded-full animate-spin" />
                        ) : (
                          <TrashIcon className="w-4 h-4" />
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}