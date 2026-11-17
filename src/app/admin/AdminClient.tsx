"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { canManageClips, canManageUsers, canManageSystem, canAccessAdminPanel, canManageSongs, PermissionSubject } from "@/lib/permissions";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChartBarIcon,
  UsersIcon,
  FilmIcon,
  ScissorsIcon,
  FlagIcon,
  MusicalNoteIcon,
  CircleStackIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";

import UserManagementTab from "./tabs/UserManagementTab";
import MaintenanceTab from "./tabs/MaintenanceTab";
import DashboardTab from "./tabs/DashboardTab";
import LiveClipManagementTab from "./tabs/live-clips/LiveClipManagementTab";
import ClipReportsTab from "./tabs/ClipReportsTab";
import SongManagementTab from "./tabs/songs/SongManagementTab";
import ClipWorkflowTab from "./tabs/clip-workflow/ClipWorkflowTab";

type TabType = "dashboard" | "songs" | "clips" | "clip-workflow" | "clip-reports" | "users" | "maintenance";

/** 대시보드는 모든 관리자, 나머지는 각 담당 권한으로 제한한다. */
type TabAccess = "admin" | "songs" | "clips" | "users" | "system";

const TAB_ACCESS_CHECKS: Record<TabAccess, (role: PermissionSubject) => boolean> = {
  admin: canAccessAdminPanel,
  songs: canManageSongs,
  clips: canManageClips,
  users: canManageUsers,
  system: canManageSystem,
};

type Tab = {
  id: TabType;
  name: string;
  icon: typeof ChartBarIcon;
  description: string;
  access: TabAccess;
  group: "overview" | "content" | "operations";
};

// 클립 생성은 '클립 만들기' 하나로 통합됐다(예전 타임라인 파싱·댓글 분석·치지직→유튜브 탭 제거).
const tabs: Tab[] = [
  { id: "dashboard", name: "대시보드", icon: ChartBarIcon, description: "운영 현황과 이어서 할 작업", access: "admin", group: "overview" },
  { id: "songs", name: "노래 관리", icon: MusicalNoteIcon, description: "노래책 곡 정보·MR·가사", access: "songs", group: "content" },
  { id: "clips", name: "라이브 클립", icon: FilmIcon, description: "클립 검증·시간 편집·재생 점검", access: "clips", group: "content" },
  { id: "clip-workflow", name: "클립 만들기", icon: ScissorsIcon, description: "치지직/유튜브 댓글 → 클립 생성", access: "clips", group: "content" },
  { id: "clip-reports", name: "클립 신고", icon: FlagIcon, description: "사용자 신고 검토·처리", access: "clips", group: "content" },
  { id: "users", name: "사용자 관리", icon: UsersIcon, description: "권한·활동 관리", access: "users", group: "operations" },
  { id: "maintenance", name: "데이터 유지보수", icon: CircleStackIcon, description: "백업·재계산·컬렉션 현황", access: "system", group: "operations" },
];

const GROUP_LABEL: Record<Tab["group"], string | null> = { overview: null, content: "콘텐츠", operations: "운영" };

const TAB_IDS = new Set<string>(tabs.map((tab) => tab.id));
const SIDEBAR_KEY = "adminSidebarCollapsed";

export default function AdminClient() {
  const { data: session, status } = useSession();
  const router = useRouter();
  // 탭은 주소(?tab=)에 둔다 — 탭마다 히스토리 한 칸이라 뒤로가기가 이전 탭으로 돌아가고,
  // 새로고침·공유해도 같은 탭이 열린다. (Next 15는 history.pushState를 useSearchParams와 동기화)
  const searchParams = useSearchParams();
  const urlTab = searchParams.get("tab");
  const activeTab: TabType = urlTab && TAB_IDS.has(urlTab) ? (urlTab as TabType) : "dashboard";
  const setActiveTab = (tab: TabType) => {
    if (tab === activeTab) return;
    window.history.pushState(null, "", tab === "dashboard" ? "/admin" : `/admin?tab=${tab}`);
    // 탭을 바꾸면 내용 맨 위부터(아래로 스크롤해 둔 채 바꾸면 빈 화면처럼 보였다)
    window.scrollTo({ top: 0 });
  };

  // 데스크톱 사이드바 접기 — 브라우저에 기억
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  useEffect(() => {
    try { setSidebarCollapsed(window.localStorage.getItem(SIDEBAR_KEY) === "1"); } catch { /* 저장소 차단 */ }
  }, []);
  const toggleSidebar = () => {
    setSidebarCollapsed((v) => {
      try { window.localStorage.setItem(SIDEBAR_KEY, v ? "0" : "1"); } catch { /* 저장소 차단 */ }
      return !v;
    });
  };

  // 모바일 탭 줄: 고른 탭이 화면 밖에 있으면 보이게 스크롤
  const stripRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = stripRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
    el?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [activeTab, status]);

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      router.push("/auth/signin");
      return;
    }
    if (!canAccessAdminPanel(session.user)) {
      router.push("/");
    }
  }, [session, status, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-light-background dark:bg-dark-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-light-accent/30 dark:border-dark-accent/30 border-t-light-accent dark:border-t-dark-accent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session || !canAccessAdminPanel(session.user)) {
    return null;
  }

  // 보유 권한에 따라 노출할 탭 필터링
  const role = session.user;
  const visibleTabs = tabs.filter((tab) => TAB_ACCESS_CHECKS[tab.access](role));

  // 현재 활성 탭이 권한 밖이면 첫 번째 가시 탭으로 이동
  const activeIsVisible = visibleTabs.some((tab) => tab.id === activeTab);
  const effectiveActiveTab = activeIsVisible ? activeTab : (visibleTabs[0]?.id ?? "dashboard");

  const renderTabContent = () => {
    switch (effectiveActiveTab) {
      case "dashboard":
        return <DashboardTab onNavigate={setActiveTab} allowedTabs={visibleTabs.map((tab) => tab.id)} />;
      case "songs":
        return <SongManagementTab />;
      case "clips":
        return <LiveClipManagementTab />;
      case "clip-reports":
        return <ClipReportsTab />;
      case "clip-workflow":
        return <ClipWorkflowTab />;
      case "users":
        return <UserManagementTab />;
      case "maintenance":
        return <MaintenanceTab />;
      default:
        return null;
    }
  };

  const itemClass = (active: boolean) =>
    active
      ? "bg-light-accent/10 text-light-accent dark:bg-dark-accent/15 dark:text-dark-accent"
      : "text-light-text/70 hover:bg-light-primary/10 hover:text-light-text dark:text-dark-text/70 dark:hover:bg-dark-primary/15 dark:hover:text-dark-text";

  return (
    <div className="min-h-screen bg-light-background dark:bg-dark-background">
      {/* 큰 '관리자 패널' 머리글은 모든 탭 위에서 한 화면의 1/4을 차지해 없앴다.
          모바일은 탭 줄, 데스크톱은 사이드바 머리가 지금 위치를 알려 준다. */}
      <div className="relative z-10 pt-12 sm:pt-16 lg:pt-20 pb-12 px-2 sm:px-4 lg:px-6 max-w-[98%] sm:max-w-[95%] 2xl:max-w-[90%] mx-auto">
        {/* 모바일·태블릿: 화면 위에 붙는 탭 줄 */}
        <nav
          aria-label="관리 메뉴"
          className="lg:hidden sticky top-12 sm:top-16 z-30 -mx-2 sm:-mx-4 mb-4 border-b border-light-primary/15 bg-light-background/90 backdrop-blur-md dark:border-dark-primary/15 dark:bg-dark-background/90"
        >
          <div
            ref={stripRef}
            className="flex gap-1 overflow-x-auto px-2 py-2 sm:px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden
                       [mask-image:linear-gradient(to_right,transparent,black_12px,black_calc(100%-24px),transparent)]"
          >
            {visibleTabs.map((tab) => {
              const Icon = tab.icon;
              const active = effectiveActiveTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-colors ${itemClass(active)}`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {tab.name}
                </button>
              );
            })}
          </div>
        </nav>

        <div className="flex gap-4 xl:gap-6">
          {/* 데스크톱 사이드바 — 내용을 스크롤해도 따라온다 */}
          <aside className={`hidden lg:block shrink-0 transition-[width] duration-200 ${sidebarCollapsed ? "w-16" : "w-56"}`}>
            <div className="sticky top-20 rounded-xl border border-light-primary/20 bg-white/40 p-2 backdrop-blur-sm dark:border-dark-primary/20 dark:bg-gray-900/40">
              <div className={`mb-1 flex items-center gap-2 px-2 py-2 ${sidebarCollapsed ? "justify-center" : ""}`}>
                {!sidebarCollapsed && (
                  <>
                    <ShieldCheckIcon className="h-5 w-5 shrink-0 text-light-accent dark:text-dark-accent" />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-light-text dark:text-dark-text">관리자</span>
                  </>
                )}
                <button
                  onClick={toggleSidebar}
                  className="rounded-lg p-1.5 text-light-text/50 transition-colors hover:bg-light-primary/10 hover:text-light-text dark:text-dark-text/50 dark:hover:bg-dark-primary/15 dark:hover:text-dark-text"
                  title={sidebarCollapsed ? "메뉴 펼치기" : "메뉴 접기"}
                  aria-label={sidebarCollapsed ? "메뉴 펼치기" : "메뉴 접기"}
                >
                  {sidebarCollapsed ? <ChevronDoubleRightIcon className="h-4 w-4" /> : <ChevronDoubleLeftIcon className="h-4 w-4" />}
                </button>
              </div>
              <nav aria-label="관리 메뉴" className="space-y-0.5">
                {visibleTabs.map((tab, i) => {
                  const Icon = tab.icon;
                  const active = effectiveActiveTab === tab.id;
                  const label = GROUP_LABEL[tab.group];
                  const groupStart = label && visibleTabs[i - 1]?.group !== tab.group;
                  return (
                    <div key={tab.id}>
                      {groupStart &&
                        (sidebarCollapsed ? (
                          <div className="mx-3 my-2 h-px bg-light-primary/20 dark:bg-dark-primary/20" />
                        ) : (
                          <div className="px-3 pb-1 pt-3 text-[11px] font-semibold tracking-wide text-light-text/45 dark:text-dark-text/45">{label}</div>
                        ))}
                      <button
                        onClick={() => setActiveTab(tab.id)}
                        aria-current={active ? "page" : undefined}
                        title={sidebarCollapsed ? tab.name : tab.description}
                        className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${itemClass(active)} ${sidebarCollapsed ? "justify-center" : ""}`}
                      >
                        <Icon className="h-5 w-5 shrink-0" />
                        {!sidebarCollapsed && <span className="truncate">{tab.name}</span>}
                      </button>
                    </div>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* Main Content */}
          <div className="min-w-0 flex-1">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={effectiveActiveTab}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
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
