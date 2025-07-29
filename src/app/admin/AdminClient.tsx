'use client';

import { useState, useEffect } from 'react';
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { isSuperAdmin, UserRole } from "@/lib/permissions";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ChartBarIcon,
  UsersIcon,
  Cog6ToothIcon,
  PlayIcon,
  MusicalNoteIcon,
  BookOpenIcon,
  ShieldCheckIcon,
  ClockIcon,
  HeartIcon,
  ListBulletIcon,
  ServerIcon,
  ArrowTrendingUpIcon,
  EyeIcon,
  DocumentDuplicateIcon,
  MagnifyingGlassIcon,
  AdjustmentsHorizontalIcon,
  ChatBubbleBottomCenterTextIcon
} from '@heroicons/react/24/outline';

// Import tabs from test-db
import TimestampParserTab from '../test-db/tabs/TimestampParserTab';
import TimelineAdjusterTab from '../test-db/tabs/TimelineAdjusterTab';
import CommentAnalysisTab from '../test-db/tabs/CommentAnalysisTab';
import SongManagementTab from './tabs/SongManagementTab';
import BackupManagementTab from './tabs/BackupManagementTab';

type TabType = 'dashboard' | 'songs' | 'backup' | 'timestamp' | 'timeline' | 'comments' | 'users' | 'system';

const tabs = [
  {
    id: 'dashboard' as const,
    name: '대시보드',
    icon: ChartBarIcon,
    description: '시스템 개요 및 통계'
  },
  {
    id: 'songs' as const,
    name: '노래 관리',
    icon: MusicalNoteIcon,
    description: '노래 데이터 조회, 편집, 삭제'
  },
  {
    id: 'backup' as const,
    name: '백업 관리',
    icon: DocumentDuplicateIcon,
    description: 'DB 백업, 복원, 통계'
  },
  {
    id: 'timestamp' as const,
    name: '타임스탬프 파서',
    icon: ClockIcon,
    description: '댓글 타임스탬프로 라이브 클립 일괄 등록'
  },
  {
    id: 'timeline' as const,
    name: '타임라인 파싱',
    icon: AdjustmentsHorizontalIcon,
    description: 'YouTube 댓글 수집 및 타임라인 분석'
  },
  {
    id: 'comments' as const,
    name: '댓글 분석',
    icon: ChatBubbleBottomCenterTextIcon,
    description: '댓글 분석 도구 (미사용)'
  },
  {
    id: 'users' as const,
    name: '사용자 관리',
    icon: UsersIcon,
    description: '사용자 권한 및 활동 관리'
  },
  {
    id: 'system' as const,
    name: '시스템 설정',
    icon: ServerIcon,
    description: '시스템 설정 및 모니터링'
  }
];

interface AdminClientProps {
  initialStats: {
    totalSongs: number;
    totalUsers: number;
    totalPlaylists: number;
    recentActivity: number;
  };
}

export default function AdminClient({ initialStats }: AdminClientProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [stats, setStats] = useState(initialStats);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  useEffect(() => {
    if (status === 'loading') return;

    if (!session) {
      router.push('/auth/signin');
      return;
    }

    if (!isSuperAdmin(session.user.role as UserRole)) {
      router.push('/');
      return;
    }
  }, [session, status, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-light-background dark:bg-dark-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-light-accent/30 dark:border-dark-accent/30 border-t-light-accent dark:border-t-dark-accent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session || !isSuperAdmin(session.user.role as UserRole)) {
    return null;
  }

  const quickStats = [
    {
      title: "총 노래 수",
      value: stats.totalSongs.toLocaleString(),
      icon: MusicalNoteIcon,
      change: "+12",
      changeType: "increase" as const,
      color: "from-light-accent to-light-purple dark:from-dark-accent dark:to-dark-purple"
    },
    {
      title: "등록 사용자",
      value: stats.totalUsers.toLocaleString(),
      icon: UsersIcon,
      change: "+5",
      changeType: "increase" as const,
      color: "from-light-secondary to-light-accent dark:from-dark-secondary dark:to-dark-accent"
    },
    {
      title: "플레이리스트",
      value: stats.totalPlaylists.toLocaleString(),
      icon: ListBulletIcon,
      change: "+8",
      changeType: "increase" as const,
      color: "from-light-purple to-light-secondary dark:from-dark-purple dark:to-dark-secondary"
    },
    {
      title: "오늘 활동",
      value: stats.recentActivity.toLocaleString(),
      icon: ArrowTrendingUpIcon,
      change: "+3",
      changeType: "increase" as const,
      color: "from-emerald-400 to-teal-500 dark:from-emerald-500 dark:to-teal-600"
    }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="space-y-8">
            {/* Quick Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
            >
              {quickStats.map((stat, index) => (
                <motion.div
                  key={stat.title}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  whileHover={{ scale: 1.02 }}
                  className="bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm rounded-xl p-6 
                             border border-light-primary/20 dark:border-dark-primary/20 
                             hover:border-light-accent/40 dark:hover:border-dark-accent/40 
                             transition-all duration-300"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-12 h-12 bg-gradient-to-r ${stat.color} rounded-lg flex items-center justify-center`}>
                      <stat.icon className="w-6 h-6 text-white" />
                    </div>
                    <div className={`px-2 py-1 rounded-full text-xs font-medium
                      ${stat.changeType === 'increase' 
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                      {stat.change}
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-light-text dark:text-dark-text mb-1">
                    {stat.value}
                  </div>
                  <div className="text-sm text-light-text/60 dark:text-dark-text/60">
                    {stat.title}
                  </div>
                </motion.div>
              ))}
            </motion.div>

            {/* System Status */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm rounded-xl p-6 border border-light-primary/20 dark:border-dark-primary/20"
            >
              <h3 className="text-lg font-semibold text-light-text dark:text-dark-text mb-4">시스템 상태</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-light-text/70 dark:text-dark-text/70">시스템 정상</span>
                </div>
                <div className="flex items-center gap-3">
                  <ClockIcon className="w-4 h-4 text-light-text/60 dark:text-dark-text/60" />
                  <span className="text-light-text/70 dark:text-dark-text/70">마지막 동기화: 5분 전</span>
                </div>
                <div className="flex items-center gap-3">
                  <EyeIcon className="w-4 h-4 text-light-text/60 dark:text-dark-text/60" />
                  <span className="text-light-text/70 dark:text-dark-text/70">권한: 최고 관리자</span>
                </div>
              </div>
            </motion.div>
          </div>
        );

      case 'songs':
        return <SongManagementTab />;
      
      case 'backup':
        return <BackupManagementTab />;
      
      case 'timestamp':
        return <TimestampParserTab />;
      
      case 'timeline':
        return <CommentAnalysisTab viewMode="timeline" />;
      
      case 'comments':
        return <CommentAnalysisTab viewMode="comments" />;
      
      case 'users':
        return (
          <div className="bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm rounded-xl p-8 border border-light-primary/20 dark:border-dark-primary/20">
            <h3 className="text-xl font-semibold text-light-text dark:text-dark-text mb-4">사용자 관리</h3>
            <p className="text-light-text/60 dark:text-dark-text/60">사용자 관리 기능이 곧 추가될 예정입니다.</p>
          </div>
        );
      
      case 'system':
        return (
          <div className="bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm rounded-xl p-8 border border-light-primary/20 dark:border-dark-primary/20">
            <h3 className="text-xl font-semibold text-light-text dark:text-dark-text mb-4">시스템 설정</h3>
            <p className="text-light-text/60 dark:text-dark-text/60">시스템 설정 기능이 곧 추가될 예정입니다.</p>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-light-background dark:bg-dark-background">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-96 h-96 bg-light-accent/5 dark:bg-dark-accent/5 
                        rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000"></div>
        <div className="absolute top-40 right-20 w-96 h-96 bg-light-secondary/5 dark:bg-dark-secondary/5 
                        rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000"></div>
        <div className="absolute -bottom-8 left-1/2 w-96 h-96 bg-light-purple/5 dark:bg-dark-purple/5 
                        rounded-full mix-blend-multiply filter blur-3xl animate-blob"></div>
      </div>

      <div className="relative z-10 pt-24 pb-12 px-2 sm:px-4 lg:px-8 max-w-[98%] sm:max-w-[95%] 2xl:max-w-[90%] mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8"
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-gradient-to-r from-light-accent to-light-purple dark:from-dark-accent dark:to-dark-purple 
                            rounded-2xl flex items-center justify-center shadow-lg">
              <ShieldCheckIcon className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl sm:text-5xl font-bold font-display gradient-text">
                관리자 패널
              </h1>
              <p className="text-light-text/70 dark:text-dark-text/70 text-lg mt-2">
                안녕하세요, {session.user.channelName || session.user.name}님!
              </p>
            </div>
          </div>
        </motion.div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Desktop Sidebar */}
          <div className="hidden lg:block lg:w-80 flex-shrink-0">
            <div className="bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm rounded-xl border border-light-primary/20 dark:border-dark-primary/20 overflow-hidden">
              <div className="p-6 border-b border-light-primary/20 dark:border-dark-primary/20">
                <h2 className="text-lg font-semibold text-light-text dark:text-dark-text">관리 메뉴</h2>
              </div>
              <nav className="p-4 space-y-2">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center px-4 py-3 rounded-lg transition-all duration-200 text-left ${
                        isActive 
                          ? 'bg-light-accent/10 dark:bg-dark-accent/10 text-light-accent dark:text-dark-accent border border-light-accent/20 dark:border-dark-accent/20 shadow-sm' 
                          : 'hover:bg-gray-100 dark:hover:bg-gray-800/50 text-light-text/70 dark:text-dark-text/70 hover:text-light-text dark:hover:text-dark-text'
                      }`}
                    >
                      <Icon className="w-5 h-5 mr-3 flex-shrink-0" />
                      <div>
                        <div className="font-medium">{tab.name}</div>
                        <div className={`text-xs mt-0.5 ${isActive ? 'text-light-accent/70 dark:text-dark-accent/70' : 'text-light-text/50 dark:text-dark-text/50'}`}>
                          {tab.description}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Mobile Tab Navigation */}
          <div className="lg:hidden">
            <nav className="flex overflow-x-auto space-x-1 pb-4">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-shrink-0 flex flex-col items-center px-3 py-2 rounded-lg transition-all duration-200 min-w-[80px] ${
                      isActive 
                        ? 'bg-light-accent/10 dark:bg-dark-accent/10 text-light-accent dark:text-dark-accent border border-light-accent/20 dark:border-dark-accent/20' 
                        : 'hover:bg-gray-100 dark:hover:bg-gray-800/50 text-light-text/70 dark:text-dark-text/70'
                    }`}
                  >
                    <Icon className="w-5 h-5 mb-1" />
                    <div className="text-xs font-medium text-center">{tab.name}</div>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                {renderTabContent()}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}