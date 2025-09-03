'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { ClockIcon, DocumentTextIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import Navigation from '@/components/Navigation';
import TimelineAdjusterClient from '@/components/TimelineAdjusterClient';
import TimestampParserTab from '../../test-db/tabs/TimestampParserTab';

type TabType = 'adjuster' | 'parser';

export default function TimelineToolsClient() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabType>('adjuster');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // URL 파라미터에서 탭 설정 읽기
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'parser' || tabParam === 'adjuster') {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  const tabs = [
    {
      id: 'adjuster' as TabType,
      name: '타임라인 조정',
      icon: ClockIcon,
      description: '치지직/유튜브 시간 차이 보정'
    },
    {
      id: 'parser' as TabType,
      name: '타임스탬프 파서',
      icon: DocumentTextIcon,
      description: '타임스탬프 텍스트 분석'
    }
  ];

  return (
    <div className="min-h-screen">
      <Navigation currentPath="/tools/timeline" />
      <div className="flex h-screen pt-16">
        {/* 왼쪽 고정 사이드바 */}
        <div className={`fixed left-0 top-16 h-[calc(100vh-4rem)] z-30 transition-all duration-300 ${
          sidebarCollapsed ? 'w-16' : 'w-64'
        }`}>
          <div className="h-full bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-r 
                          border-light-primary/20 dark:border-dark-primary/20 shadow-lg">
            
            {/* 헤더 */}
            <div className="p-4 border-b border-light-primary/20 dark:border-dark-primary/20 relative">
              {/* 토글 버튼 - 우상단 */}
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="absolute top-2 right-2 p-2 rounded-lg 
                           hover:bg-light-primary/10 dark:hover:bg-dark-primary/10 
                           text-gray-600 dark:text-gray-400 transition-colors duration-200"
                title={sidebarCollapsed ? "사이드바 확장" : "사이드바 축소"}
              >
                {sidebarCollapsed ? (
                  <ChevronRightIcon className="w-4 h-4" />
                ) : (
                  <ChevronLeftIcon className="w-4 h-4" />
                )}
              </button>

              {!sidebarCollapsed && (
                <div className="pr-10">
                  <h2 className="text-lg font-bold bg-gradient-to-r from-light-accent to-light-purple 
                                 dark:from-dark-primary dark:to-dark-secondary bg-clip-text text-transparent">
                    타임라인 도구
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    라이브 스트리밍 유틸리티
                  </p>
                </div>
              )}
            </div>

            {/* 탭 네비게이션 */}
            <nav className="p-3 space-y-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center p-3 rounded-lg transition-all duration-200 text-left border ${
                      isActive
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg border-blue-500/50' 
                        : 'text-gray-600 dark:text-gray-400 hover:bg-light-primary/10 dark:hover:bg-dark-primary/10 border-transparent hover:border-light-primary/20 dark:hover:border-dark-primary/20'
                    } ${sidebarCollapsed ? 'justify-center' : ''}`}
                    title={sidebarCollapsed ? tab.name : undefined}
                  >
                    <Icon className={`w-5 h-5 flex-shrink-0 ${sidebarCollapsed ? '' : 'mr-3'} ${
                      isActive ? 'text-white' : ''
                    }`} />
                    
                    {!sidebarCollapsed && (
                      <div className="min-w-0">
                        <div className={`font-semibold text-sm truncate ${
                          isActive ? 'text-white' : 'text-gray-900 dark:text-white'
                        }`}>
                          {tab.name}
                        </div>
                        <div className={`text-xs mt-0.5 truncate ${
                          isActive ? 'text-white/90' : 'text-gray-500 dark:text-gray-400'
                        }`}>
                          {tab.description}
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* 메인 컨텐츠 영역 */}
        <div className={`flex-1 transition-all duration-300 ${
          sidebarCollapsed ? 'ml-16' : 'ml-64'
        }`}>
          <div className="h-full overflow-y-auto">
            <div className="p-6">
              <div className={activeTab === 'adjuster' ? 'block' : 'hidden'}>
                <TimelineAdjusterClient />
              </div>
              
              <div className={`${activeTab === 'parser' ? 'block' : 'hidden'} bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm rounded-xl border border-light-primary/20 dark:border-dark-primary/20 p-6`}>
                <TimestampParserTab />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}