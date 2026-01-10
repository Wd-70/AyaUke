"use client";

import { useState, useEffect } from "react";
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
  ChatBubbleBottomCenterTextIcon,
  Bars3Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";

// Import tabs from test-db
import TimelineParsingView from "../test-db/tabs/TimelineParsingView";
import CommentAnalysisTab from "../test-db/tabs/CommentAnalysisTab";
import SongManagementTab from "./tabs/SongManagementTab";
import BackupManagementTab from "./tabs/BackupManagementTab";
import UserManagementTab from "./tabs/UserManagementTab";
import DashboardTab from "./tabs/DashboardTab";
import LiveClipManagementTab from "./tabs/LiveClipManagementTab";
import ChzzkYoutubeConverterTab from "./tabs/ChzzkYoutubeConverterTab";

type TabType =
  | "dashboard"
  | "clips"
  | "songs"
  | "backup"
  | "timeline"
  | "comments"
  | "converter"
  | "users"
  | "system";

const tabs = [
  {
    id: "dashboard" as const,
    name: "대시보드",
    icon: ChartBarIcon,
    description: "시스템 개요 및 통계",
  },
  {
    id: "clips" as const,
    name: "라이브 클립",
    icon: PlayIcon,
    description: "라이브 클립 조회, 재생, 관리",
  },
  {
    id: "songs" as const,
    name: "노래 관리",
    icon: MusicalNoteIcon,
    description: "노래 데이터 조회, 편집, 삭제",
  },
  {
    id: "backup" as const,
    name: "백업 관리",
    icon: DocumentDuplicateIcon,
    description: "DB 백업, 복원, 통계",
  },
  {
    id: "timeline" as const,
    name: "타임라인 파싱",
    icon: AdjustmentsHorizontalIcon,
    description: "YouTube 댓글 수집 및 타임라인 분석",
  },
  {
    id: "comments" as const,
    name: "댓글 분석",
    icon: ChatBubbleBottomCenterTextIcon,
    description: "댓글 분석 도구",
  },
  {
    id: "converter" as const,
    name: "치지직→유튜브",
    icon: AdjustmentsHorizontalIcon,
    description: "타임라인 댓글 변환",
  },
  {
    id: "users" as const,
    name: "사용자 관리",
    icon: UsersIcon,
    description: "사용자 권한 및 활동 관리",
  },
  {
    id: "system" as const,
    name: "시스템 설정",
    icon: ServerIcon,
    description: "시스템 설정 및 모니터링",
  },
];

export default function AdminClient() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkIsMobile();
    window.addEventListener("resize", checkIsMobile);
    return () => window.removeEventListener("resize", checkIsMobile);
  }, []);

  useEffect(() => {
    if (status === "loading") return;

    if (!session) {
      router.push("/auth/signin");
      return;
    }

    if (!isSuperAdmin(session.user.role as UserRole)) {
      router.push("/");
      return;
    }
  }, [session, status, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-light-background dark:bg-dark-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-light-accent/30 dark:border-dark-accent/30 border-t-light-accent dark:border-t-dark-accent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session || !isSuperAdmin(session.user.role as UserRole)) {
    return null;
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case "dashboard":
        return <DashboardTab />;

      case "clips":
        return <LiveClipManagementTab />;

      case "songs":
        return <SongManagementTab />;

      case "backup":
        return <BackupManagementTab />;

      case "timeline":
        return <CommentAnalysisTab viewMode="timeline" />;

      case "comments":
        return <CommentAnalysisTab viewMode="comments" />;

      case "converter":
        return <ChzzkYoutubeConverterTab />;

      case "users":
        return <UserManagementTab />;

      case "system":
        return (
          <div className="bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm rounded-xl p-4 xl:p-8 border border-light-primary/20 dark:border-dark-primary/20">
            <h3 className="text-lg xl:text-xl font-semibold text-light-text dark:text-dark-text mb-4">
              시스템 설정
            </h3>
            <p className="text-light-text/60 dark:text-dark-text/60">
              시스템 설정 기능이 곧 추가될 예정입니다.
            </p>
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
        <div
          className="absolute top-20 left-20 w-96 h-96 bg-light-accent/5 dark:bg-dark-accent/5 
                        rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000"
        ></div>
        <div
          className="absolute top-40 right-20 w-96 h-96 bg-light-secondary/5 dark:bg-dark-secondary/5 
                        rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000"
        ></div>
        <div
          className="absolute -bottom-8 left-1/2 w-96 h-96 bg-light-purple/5 dark:bg-dark-purple/5 
                        rounded-full mix-blend-multiply filter blur-3xl animate-blob"
        ></div>
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
            <div
              className="w-16 h-16 bg-gradient-to-r from-light-accent to-light-purple dark:from-dark-accent dark:to-dark-purple 
                            rounded-2xl flex items-center justify-center shadow-lg"
            >
              <ShieldCheckIcon className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl sm:text-5xl font-bold font-display gradient-text">
                관리자 패널
              </h1>
              <p className="text-light-text/70 dark:text-dark-text/70 text-lg mt-2">
                안녕하세요, {session.user.displayName || session.user.name}님!
              </p>
            </div>
          </div>
        </motion.div>

        <div className="flex flex-col lg:flex-row gap-4 xl:gap-8">
          {/* Desktop Sidebar */}
          <div
            className={`hidden xl:block flex-shrink-0 transition-all duration-300 ${
              sidebarCollapsed ? "xl:w-16" : "xl:w-80"
            }`}
          >
            <div className="bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm rounded-xl border border-light-primary/20 dark:border-dark-primary/20 overflow-hidden">
              <div className="p-4 xl:p-6 border-b border-light-primary/20 dark:border-dark-primary/20 flex items-center justify-between">
                {!sidebarCollapsed && (
                  <h2 className="text-base xl:text-lg font-semibold text-light-text dark:text-dark-text">
                    관리 메뉴
                  </h2>
                )}
                <button
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800/50 text-light-text/70 dark:text-dark-text/70 hover:text-light-text dark:hover:text-dark-text transition-colors duration-200"
                  title={sidebarCollapsed ? "사이드바 확장" : "사이드바 축소"}
                >
                  {sidebarCollapsed ? (
                    <ChevronRightIcon className="w-5 h-5" />
                  ) : (
                    <ChevronLeftIcon className="w-5 h-5" />
                  )}
                </button>
              </div>
              <nav className="p-3 xl:p-4 space-y-1 xl:space-y-2">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  const TabElement = (tab as any).external ? 'a' : 'button';
                  const tabProps = (tab as any).external 
                    ? { href: (tab as any).externalLink, target: '_blank', rel: 'noopener noreferrer' }
                    : { onClick: () => setActiveTab(tab.id) };
                  
                  return (
                    <TabElement
                      key={tab.id}
                      {...tabProps}
                      title={sidebarCollapsed ? tab.name : undefined}
                      className={`w-full flex items-center px-3 xl:px-4 py-2 xl:py-3 rounded-lg transition-all duration-200 text-left ${
                        isActive
                          ? "bg-light-accent/10 dark:bg-dark-accent/10 text-light-accent dark:text-dark-accent border border-light-accent/20 dark:border-dark-accent/20 shadow-sm"
                          : "hover:bg-gray-100 dark:hover:bg-gray-800/50 text-light-text/70 dark:text-dark-text/70 hover:text-light-text dark:hover:text-dark-text"
                      } ${sidebarCollapsed ? "justify-center" : ""}`}
                    >
                      <Icon
                        className={`w-4 xl:w-5 h-4 xl:h-5 flex-shrink-0 ${
                          sidebarCollapsed ? "" : "mr-2 xl:mr-3"
                        }`}
                      />
                      {!sidebarCollapsed && (
                        <div className="min-w-0 overflow-hidden">
                          <div className="font-medium text-sm xl:text-base truncate">
                            {tab.name}
                          </div>
                          <div
                            className={`text-xs mt-0.5 line-clamp-1 ${
                              isActive
                                ? "text-light-accent/70 dark:text-dark-accent/70"
                                : "text-light-text/50 dark:text-dark-text/50"
                            }`}
                          >
                            {tab.description}
                          </div>
                        </div>
                      )}
                    </TabElement>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Medium Screen Sidebar - Icon Only */}
          <div className="hidden lg:block xl:hidden lg:w-16 flex-shrink-0">
            <div className="bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm rounded-xl border border-light-primary/20 dark:border-dark-primary/20 overflow-hidden">
              <nav className="p-2 space-y-1">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  const TabElement = (tab as any).external ? 'a' : 'button';
                  const tabProps = (tab as any).external 
                    ? { href: (tab as any).externalLink, target: '_blank', rel: 'noopener noreferrer' }
                    : { onClick: () => setActiveTab(tab.id) };
                    
                  return (
                    <TabElement
                      key={tab.id}
                      {...tabProps}
                      title={tab.name}
                      className={`w-full flex items-center justify-center p-3 rounded-lg transition-all duration-200 ${
                        isActive
                          ? "bg-light-accent/10 dark:bg-dark-accent/10 text-light-accent dark:text-dark-accent border border-light-accent/20 dark:border-dark-accent/20 shadow-sm"
                          : "hover:bg-gray-100 dark:hover:bg-gray-800/50 text-light-text/70 dark:text-dark-text/70 hover:text-light-text dark:hover:text-dark-text"
                      }`}
                    >
                      <Icon className="w-5 h-5 flex-shrink-0" />
                    </TabElement>
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
                const TabElement = (tab as any).external ? 'a' : 'button';
                const tabProps = (tab as any).external 
                  ? { href: (tab as any).externalLink, target: '_blank', rel: 'noopener noreferrer' }
                  : { onClick: () => setActiveTab(tab.id) };
                  
                return (
                  <TabElement
                    key={tab.id}
                    {...tabProps}
                    className={`flex-shrink-0 flex flex-col items-center px-2 sm:px-3 py-2 rounded-lg transition-all duration-200 min-w-[70px] sm:min-w-[80px] ${
                      isActive
                        ? "bg-light-accent/10 dark:bg-dark-accent/10 text-light-accent dark:text-dark-accent border border-light-accent/20 dark:border-dark-accent/20"
                        : "hover:bg-gray-100 dark:hover:bg-gray-800/50 text-light-text/70 dark:text-dark-text/70"
                    }`}
                  >
                    <Icon className="w-4 sm:w-5 h-4 sm:h-5 mb-1" />
                    <div className="text-xs font-medium text-center leading-tight">
                      {tab.name.replace(" ", "\n")}
                    </div>
                  </TabElement>
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
