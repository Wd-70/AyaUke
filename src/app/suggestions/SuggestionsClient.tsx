'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSession } from 'next-auth/react';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import SuggestionsHeader from '@/components/suggestions/SuggestionsHeader';
import SuggestionsFilters from '@/components/suggestions/SuggestionsFilters';
import SuggestionsGrid from '@/components/suggestions/SuggestionsGrid';
import AddSongButton from '@/components/suggestions/AddSongButton';
import { SongRequest, SongRequestSortOption, SongRequestFilters, SongRequestStats } from '@/types';
import { MusicalNoteIcon } from '@heroicons/react/24/outline';

export default function SuggestionsClient() {
  const { data: session } = useSession();
  const [requests, setRequests] = useState<SongRequest[]>([]);
  const [stats, setStats] = useState<SongRequestStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 필터링 및 정렬 상태
  const [sortOption, setSortOption] = useState<SongRequestSortOption>('latest');
  const [filters, setFilters] = useState<SongRequestFilters>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);

  // 데이터 로딩
  const loadRequests = async (reset: boolean = false) => {
    try {
      setIsLoading(true);
      const page = reset ? 1 : currentPage;
      
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        sort: sortOption,
        ...(filters.search && { search: filters.search }),
        ...(filters.genre && { genre: filters.genre }),
        ...(filters.status && { status: filters.status }),
        ...(filters.promotedToSongbook !== undefined && { 
          promoted: filters.promotedToSongbook.toString() 
        })
      });

      const response = await fetch(`/api/suggestions?${params}`);
      if (!response.ok) {
        throw new Error('데이터를 불러오는데 실패했습니다.');
      }

      const data = await response.json();
      
      if (reset || page === 1) {
        setRequests(data.requests);
      } else {
        setRequests(prev => [...prev, ...data.requests]);
      }
      
      setHasNextPage(data.pagination.hasNextPage);
      if (reset) setCurrentPage(1);
      
    } catch (error) {
      console.error('노래 추천 로딩 오류:', error);
      setError('노래 추천을 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 통계 데이터 로딩
  const loadStats = async () => {
    try {
      const response = await fetch('/api/suggestions/stats');
      if (response.ok) {
        const statsData = await response.json();
        setStats(statsData);
      }
    } catch (error) {
      console.error('통계 로딩 오류:', error);
    }
  };

  // 초기 데이터 로딩
  useEffect(() => {
    loadRequests(true);
    loadStats();
  }, []);

  // 필터/정렬 변경 시 데이터 재로딩
  useEffect(() => {
    loadRequests(true);
  }, [sortOption, filters]);

  // 더 많은 데이터 로딩
  const loadMore = () => {
    if (!isLoading && hasNextPage) {
      setCurrentPage(prev => prev + 1);
      loadRequests(false);
    }
  };

  // 추천 토글 핸들러
  const handleRecommendToggle = async (requestId: string) => {
    if (!session) {
      alert('로그인이 필요합니다.');
      return;
    }

    try {
      const response = await fetch(`/api/suggestions/${requestId}/recommend`, {
        method: 'POST'
      });

      if (response.ok) {
        const data = await response.json();
        setRequests(prev => 
          prev.map(req => 
            req.id === requestId 
              ? { 
                  ...req, 
                  recommendationCount: data.recommendationCount,
                  isRecommendedByUser: data.isRecommended
                }
              : req
          )
        );
      }
    } catch (error) {
      console.error('추천 처리 오류:', error);
    }
  };

  // 새 곡 추가 후 목록 새로고침
  const handleSongAdded = () => {
    loadRequests(true);
    loadStats();
  };

  if (error && !requests.length) {
    return (
      <div className="min-h-screen bg-light-background dark:bg-dark-background">
        <Navigation currentPath="/suggestions" />
        <div className="pt-16 flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="w-24 h-24 mx-auto mb-8 bg-light-primary/20 dark:bg-dark-primary/20 
                           rounded-full flex items-center justify-center">
              <MusicalNoteIcon className="w-12 h-12 text-light-text/40 dark:text-dark-text/40" />
            </div>
            <h2 className="text-2xl font-bold text-light-text dark:text-dark-text mb-4">
              오류가 발생했습니다
            </h2>
            <p className="text-light-text/70 dark:text-dark-text/70 mb-4">
              {error}
            </p>
            <button
              onClick={() => loadRequests(true)}
              className="px-6 py-3 bg-gradient-to-r from-light-accent to-light-purple 
                       dark:from-dark-accent dark:to-dark-purple text-white 
                       rounded-lg hover:shadow-lg transition-all duration-200"
            >
              다시 시도
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-light-background dark:bg-dark-background">
      <Navigation currentPath="/suggestions" />
      
      {/* 배경 애니메이션 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-96 h-96 bg-light-accent/5 dark:bg-dark-accent/5 
                        rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000"></div>
        <div className="absolute top-40 right-20 w-96 h-96 bg-light-secondary/5 dark:bg-dark-secondary/5 
                        rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000"></div>
        <div className="absolute -bottom-8 left-1/2 w-96 h-96 bg-light-purple/5 dark:bg-dark-purple/5 
                        rounded-full mix-blend-multiply filter blur-3xl animate-blob"></div>
      </div>

      <main className="relative z-10 pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* 헤더 섹션 */}
        <SuggestionsHeader stats={stats} />

        {/* 필터 및 정렬 */}
        <SuggestionsFilters
          sortOption={sortOption}
          setSortOption={setSortOption}
          filters={filters}
          setFilters={setFilters}
        />

        {/* 새 곡 추가 버튼 */}
        <div className="mb-8">
          <AddSongButton onSongAdded={handleSongAdded} />
        </div>

        {/* 곡 목록 */}
        <SuggestionsGrid
          requests={requests}
          isLoading={isLoading}
          hasNextPage={hasNextPage}
          onLoadMore={loadMore}
          onRecommendToggle={handleRecommendToggle}
        />
      </main>

      <Footer />
    </div>
  );
}