"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  MusicalNoteIcon,
  UsersIcon,
  ListBulletIcon,
  PlayIcon,
  ShieldCheckIcon,
  ClockIcon,
  EyeIcon,
  ChartBarIcon,
  HeartIcon,
  ArrowTrendingUpIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";

interface DashboardStats {
  overview: {
    totalUsers: number;
    totalSongs: number;
    totalClips: number;
    totalPlaylists: number;
    verificationRate: number;
    recentClipsWeek: number;
  };
  clips: {
    total: number;
    verified: number;
    unverified: number;
    recentWeek: number;
    topContributors: Array<{ name: string; count: number }>;
    clipsPerSong: Array<{ songId: string; title: string; artist: string; count: number }>;
  };
  users: {
    total: number;
    active: number;
    recent: number;
    byRole: Record<string, number>;
  };
  playlists: {
    total: number;
    public: number;
    private: number;
    averageSize: number;
    topTags: Array<{ tag: string; count: number }>;
  };
  songs: {
    total: number;
    byLanguage: Record<string, number>;
    topSung: Array<{ title: string; artist: string; sungCount: number }>;
    withMR: number;
    byStatus: Record<string, number>;
  };
  trends: {
    clips: Array<{ month: string; count: number }>;
    users: Array<{ month: string; count: number }>;
    playlists: Array<{ month: string; count: number }>;
  };
}

export default function DashboardTab() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recalculatingStats, setRecalculatingStats] = useState(false);
  const [recalculatingLikes, setRecalculatingLikes] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/admin/dashboard-stats');
        if (!response.ok) {
          throw new Error('Failed to fetch dashboard statistics');
        }
        const data = await response.json();
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  // 곡 통계 재계산 함수
  const recalculateSongStats = async () => {
    if (recalculatingStats) return;
    
    try {
      setRecalculatingStats(true);
      
      const response = await fetch('/api/admin/recalculate-song-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert(`✅ 곡 통계 재계산 완료!\n처리된 곡: ${result.processedCount}개\n오류: ${result.errorCount}개`);
        // 통계 새로고침
        window.location.reload();
      } else {
        alert('❌ 통계 재계산 실패: ' + (result.error || '알 수 없는 오류'));
      }
    } catch (error) {
      console.error('통계 재계산 오류:', error);
      alert('❌ 통계 재계산 중 오류가 발생했습니다.');
    } finally {
      setRecalculatingStats(false);
    }
  };

  // 좋아요 카운트 재계산 함수
  const recalculateLikeCounts = async () => {
    if (recalculatingLikes) return;
    
    try {
      setRecalculatingLikes(true);
      
      const response = await fetch('/api/admin/recalculate-like-counts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert(`✅ 좋아요 카운트 재계산 완료!\n처리된 곡: ${result.processedCount}개\n업데이트된 곡: ${result.updatedCount}개\n변경없음: ${result.unchangedCount}개\n오류: ${result.errorCount}개`);
        // 통계 새로고침
        window.location.reload();
      } else {
        alert('❌ 좋아요 카운트 재계산 실패: ' + (result.error || '알 수 없는 오류'));
      }
    } catch (error) {
      console.error('좋아요 카운트 재계산 오류:', error);
      alert('❌ 좋아요 카운트 재계산 중 오류가 발생했습니다.');
    } finally {
      setRecalculatingLikes(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-8 h-8 border-2 border-light-accent/30 dark:border-dark-accent/30 border-t-light-accent dark:border-t-dark-accent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm rounded-xl p-8 border border-red-200 dark:border-red-800">
        <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
          <ExclamationTriangleIcon className="w-6 h-6" />
          <span className="font-semibold">데이터를 불러올 수 없습니다</span>
        </div>
        <p className="mt-2 text-red-500 dark:text-red-300 text-sm">
          {error || '알 수 없는 오류가 발생했습니다'}
        </p>
      </div>
    );
  }

  const quickStats = [
    {
      title: "총 노래 수",
      value: stats.overview.totalSongs.toLocaleString(),
      icon: MusicalNoteIcon,
      change: `MR: ${stats.songs.withMR}곡`,
      changeType: "neutral" as const,
      color: "from-light-accent to-light-purple dark:from-dark-accent dark:to-dark-purple",
    },
    {
      title: "등록 사용자",
      value: stats.overview.totalUsers.toLocaleString(),
      icon: UsersIcon,
      change: `활성: ${stats.users.active}`,
      changeType: "neutral" as const,
      color: "from-light-secondary to-light-accent dark:from-dark-secondary dark:to-dark-accent",
    },
    {
      title: "라이브 클립",
      value: stats.overview.totalClips.toLocaleString(),
      icon: PlayIcon,
      change: `최근 7일: ${stats.overview.recentClipsWeek}개`,
      changeType: "neutral" as const,
      color: "from-blue-400 to-indigo-500 dark:from-blue-500 dark:to-indigo-600",
    },
    {
      title: "플레이리스트",
      value: stats.overview.totalPlaylists.toLocaleString(),
      icon: ListBulletIcon,
      change: `공개: ${stats.playlists.public}개`,
      changeType: "neutral" as const,
      color: "from-light-purple to-light-secondary dark:from-dark-purple dark:to-dark-secondary",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Admin Tools */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm rounded-xl p-6 border border-light-primary/20 dark:border-dark-primary/20"
      >
        <h3 className="text-lg font-semibold text-light-text dark:text-dark-text mb-4 flex items-center gap-2">
          <ChartBarIcon className="w-5 h-5" />
          관리 도구
        </h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={recalculateSongStats}
            disabled={recalculatingStats}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white rounded-lg flex items-center gap-2 transition-colors"
          >
            {recalculatingStats ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                처리 중...
              </>
            ) : (
              <>
                <ArrowTrendingUpIcon className="w-4 h-4" />
                곡 통계 재계산
              </>
            )}
          </button>
          
          <button
            onClick={recalculateLikeCounts}
            disabled={recalculatingLikes}
            className="px-4 py-2 bg-red-500 hover:bg-red-600 disabled:bg-red-400 disabled:cursor-not-allowed text-white rounded-lg flex items-center gap-2 transition-colors"
          >
            {recalculatingLikes ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                처리 중...
              </>
            ) : (
              <>
                <HeartIcon className="w-4 h-4" />
                좋아요 카운트 재계산
              </>
            )}
          </button>
        </div>
        <div className="space-y-1 mt-2">
          <p className="text-sm text-light-text/60 dark:text-dark-text/60">
            • 곡 통계: 기존 라이브 클립 데이터를 기반으로 곡별 부른 회수와 마지막 부른 날짜를 다시 계산합니다.
          </p>
          <p className="text-sm text-light-text/60 dark:text-dark-text/60">
            • 좋아요 카운트: 실제 좋아요 데이터를 집계하여 곡별 좋아요 수를 정확하게 업데이트합니다.
          </p>
        </div>
      </motion.div>

      {/* Quick Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 xl:gap-6"
      >
        {quickStats.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: index * 0.1 }}
            whileHover={{ scale: 1.02 }}
            className="bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm rounded-xl p-4 xl:p-6 
                       border border-light-primary/20 dark:border-dark-primary/20 
                       hover:border-light-accent/40 dark:hover:border-dark-accent/40 
                       transition-all duration-300"
          >
            <div className="flex items-center justify-between mb-4">
              <div
                className={`w-10 xl:w-12 h-10 xl:h-12 bg-gradient-to-r ${stat.color} rounded-lg flex items-center justify-center`}
              >
                <stat.icon className="w-5 xl:w-6 h-5 xl:h-6 text-white" />
              </div>
              <div
                className={`px-2 py-1 rounded-full text-xs font-medium
                ${
                  stat.changeType === "increase"
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : stat.changeType === "decrease"
                    ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    : "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400"
                }`}
              >
                {stat.change}
              </div>
            </div>
            <div className="text-xl xl:text-2xl font-bold text-light-text dark:text-dark-text mb-1">
              {stat.value}
            </div>
            <div className="text-xs xl:text-sm text-light-text/60 dark:text-dark-text/60">
              {stat.title}
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Most Sung Songs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm rounded-xl p-6 border border-light-primary/20 dark:border-dark-primary/20"
        >
          <h3 className="text-lg font-semibold text-light-text dark:text-dark-text mb-4 flex items-center gap-2">
            <HeartIcon className="w-5 h-5" />
            가장 많이 부른 곡 Top 10
          </h3>
          <div className="space-y-3">
            {stats.songs.topSung.slice(0, 10).map((song, index) => (
              <div key={`${song.title}-${song.artist}`} className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                    index === 0 ? 'bg-yellow-500' : 
                    index === 1 ? 'bg-gray-400' :
                    index === 2 ? 'bg-amber-600' : 'bg-gray-300'
                  }`}>
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-light-text dark:text-dark-text font-medium truncate">
                      {song.title}
                    </div>
                    <div className="text-light-text/60 dark:text-dark-text/60 text-xs truncate">
                      {song.artist}
                    </div>
                  </div>
                </div>
                <span className="text-light-text/70 dark:text-dark-text/70 text-sm ml-2">
                  {song.sungCount}회
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Popular Playlist Tags */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm rounded-xl p-6 border border-light-primary/20 dark:border-dark-primary/20"
        >
          <h3 className="text-lg font-semibold text-light-text dark:text-dark-text mb-4 flex items-center gap-2">
            <ListBulletIcon className="w-5 h-5" />
            인기 플레이리스트 태그 Top 10
          </h3>
          <div className="space-y-3">
            {stats.playlists.topTags.slice(0, 10).map((tag, index) => (
              <div key={tag.tag} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                    index < 3 ? 'bg-light-accent dark:bg-dark-accent' : 'bg-gray-400'
                  }`}>
                    {index + 1}
                  </div>
                  <span className="text-light-text dark:text-dark-text font-medium">
                    {tag.tag}
                  </span>
                </div>
                <span className="text-light-text/70 dark:text-dark-text/70 text-sm">
                  {tag.count}개
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Language Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm rounded-xl p-6 border border-light-primary/20 dark:border-dark-primary/20"
        >
          <h3 className="text-lg font-semibold text-light-text dark:text-dark-text mb-4 flex items-center gap-2">
            <ChartBarIcon className="w-5 h-5" />
            언어별 곡 분포
          </h3>
          <div className="space-y-3">
            {Object.entries(stats.songs.byLanguage)
              .sort((a, b) => b[1] - a[1])
              .map(([language, count]) => {
                const percentage = ((count / stats.songs.total) * 100).toFixed(1);
                return (
                  <div key={language} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-light-text dark:text-dark-text font-medium">
                        {language || '기타'}
                      </span>
                      <span className="text-light-text/70 dark:text-dark-text/70 text-sm">
                        {count}곡 ({percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-light-accent dark:bg-dark-accent h-2 rounded-full transition-all duration-300"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </motion.div>

        {/* System Status & Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm rounded-xl p-6 border border-light-primary/20 dark:border-dark-primary/20"
        >
          <h3 className="text-lg font-semibold text-light-text dark:text-dark-text mb-4 flex items-center gap-2">
            <ShieldCheckIcon className="w-5 h-5" />
            시스템 현황
          </h3>
          <div className="space-y-4">
            {/* Status Indicators */}
            <div className="grid grid-cols-1 gap-3 text-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-light-text/70 dark:text-dark-text/70">시스템 정상</span>
                </div>
                <CheckCircleIcon className="w-4 h-4 text-green-500" />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ClockIcon className="w-4 h-4 text-light-text/60 dark:text-dark-text/60" />
                  <span className="text-light-text/70 dark:text-dark-text/70">최근 일주일 클립</span>
                </div>
                <span className="text-light-accent dark:text-dark-accent font-semibold">
                  {stats.overview.recentClipsWeek}개
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <UsersIcon className="w-4 h-4 text-light-text/60 dark:text-dark-text/60" />
                  <span className="text-light-text/70 dark:text-dark-text/70">새 사용자 (30일)</span>
                </div>
                <span className="text-light-accent dark:text-dark-accent font-semibold">
                  {stats.users.recent}명
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MusicalNoteIcon className="w-4 h-4 text-light-text/60 dark:text-dark-text/60" />
                  <span className="text-light-text/70 dark:text-dark-text/70">MR 보유 곡</span>
                </div>
                <span className="text-light-text dark:text-dark-text font-semibold">
                  {stats.songs.withMR}곡
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}