"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  SparklesIcon,
  CheckCircleIcon,
  InformationCircleIcon,
  CalendarIcon,
  TrophyIcon,
} from "@heroicons/react/24/outline";
import { CheckCircleIcon as CheckCircleSolidIcon } from "@heroicons/react/24/solid";
import { getTitleRarityColor } from "@/lib/titleSystem";

interface UserTitle {
  id: string;
  name: string;
  description: string;
  earnedAt: Date;
  condition: string;
  rarity: "common" | "rare" | "epic" | "legendary";
}

interface TitleManagerProps {}

interface TitleChangeModal {
  isOpen: boolean;
  title: UserTitle | null;
  action: "select" | "remove";
}

export default function TitleManager({}: TitleManagerProps) {
  const { data: session, update } = useSession();
  const [userTitles, setUserTitles] = useState<UserTitle[]>([]);
  const [selectedTitle, setSelectedTitle] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [confirmModal, setConfirmModal] = useState<TitleChangeModal>({
    isOpen: false,
    title: null,
    action: "select",
  });

  // 사용자 타이틀 데이터 로드
  useEffect(() => {
    if (session?.user?.channelId) {
      loadUserTitles();
    }
  }, [session?.user?.channelId]);

  const loadUserTitles = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/user/titles");
      if (response.ok) {
        const data = await response.json();
        setUserTitles(data.titles || []);
        setSelectedTitle(data.selectedTitle || null);
      }
    } catch (error) {
      console.error("타이틀 로딩 실패:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // 타이틀 변경 확인 모달 열기
  const openConfirmModal = (
    titleId: string | null,
    action: "select" | "remove"
  ) => {
    const title = titleId
      ? userTitles.find((t) => t.id === titleId) || null
      : null;
    setConfirmModal({
      isOpen: true,
      title,
      action,
    });
  };

  // 타이틀 변경 실행
  const handleTitleChange = async () => {
    if (isUpdating) return;

    const titleId =
      confirmModal.action === "remove" ? null : confirmModal.title?.id || null;

    setIsUpdating(true);
    try {
      const response = await fetch("/api/user/titles/select", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ titleId }),
      });

      if (response.ok) {
        setSelectedTitle(titleId);
        // 세션 업데이트로 네비게이션 바에 반영
        await update();
        setConfirmModal({ isOpen: false, title: null, action: "select" });
      } else {
        console.error("타이틀 변경 실패");
      }
    } catch (error) {
      console.error("타이틀 변경 중 오류:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  // 희귀도별 정렬
  const sortedTitles = [...userTitles].sort((a, b) => {
    const rarityOrder = { legendary: 0, epic: 1, rare: 2, common: 3 };
    const aRarity = rarityOrder[a.rarity] ?? 999;
    const bRarity = rarityOrder[b.rarity] ?? 999;

    if (aRarity !== bRarity) {
      return aRarity - bRarity;
    }

    // 같은 희귀도면 획득 날짜 순 (최신순)
    return new Date(b.earnedAt).getTime() - new Date(a.earnedAt).getTime();
  });

  // 날짜 포맷팅
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // 희귀도별 아이콘
  const getRarityIcon = (rarity: string) => {
    switch (rarity) {
      case "legendary":
        return "👑";
      case "epic":
        return "💜";
      case "rare":
        return "💙";
      case "common":
        return "🤍";
      default:
        return "⭐";
    }
  };

  // 희귀도별 이름
  const getRarityName = (rarity: string) => {
    switch (rarity) {
      case "legendary":
        return "Legendary";
      case "epic":
        return "Epic";
      case "rare":
        return "Rare";
      case "common":
        return "Common";
      default:
        return "Unknown";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-light-accent dark:border-dark-accent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 섹션 */}
      <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm border border-gray-200/60 dark:border-gray-700/60 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-gradient-to-br from-light-accent to-light-purple dark:from-dark-accent dark:to-dark-purple rounded-lg">
            <TrophyIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              보유 타이틀
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              총 {userTitles.length}개의 타이틀을 보유하고 있습니다
            </p>
          </div>
        </div>

        {/* 현재 선택된 타이틀 */}
        <div className="bg-gradient-to-r from-light-accent/10 to-light-purple/10 dark:from-dark-accent/10 dark:to-dark-purple/10 rounded-lg p-4 border border-light-accent/20 dark:border-dark-accent/20">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-1">
                현재 선택된 타이틀
              </h3>
              {selectedTitle ? (
                <div className="flex items-center gap-2">
                  {(() => {
                    const title = userTitles.find(
                      (t) => t.id === selectedTitle
                    );
                    if (!title)
                      return (
                        <span className="text-gray-500 dark:text-gray-400">
                          알 수 없는 타이틀
                        </span>
                      );

                    return (
                      <>
                        <span className="text-lg">
                          {getRarityIcon(title.rarity)}
                        </span>
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-medium ${getTitleRarityColor(
                            title.rarity
                          )}`}
                        >
                          {title.name}
                        </span>
                      </>
                    );
                  })()}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400">
                  타이틀을 선택하지 않았습니다
                </p>
              )}
            </div>
            <button
              onClick={() => openConfirmModal(null, "remove")}
              disabled={isUpdating || !selectedTitle}
              className="px-4 py-2 text-sm bg-gray-500 hover:bg-gray-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg transition-colors duration-200"
            >
              타이틀 해제
            </button>
          </div>
        </div>
      </div>

      {/* 타이틀 목록 */}
      {userTitles.length === 0 ? (
        <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm border border-gray-200/60 dark:border-gray-700/60 rounded-xl p-12 text-center">
          <TrophyIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            아직 보유한 타이틀이 없습니다
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            사이트를 이용하면서 다양한 조건을 달성하여 타이틀을 획득해보세요!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {sortedTitles.map((title, index) => (
              <motion.div
                key={title.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className={`relative group cursor-pointer transition-all duration-300 hover:scale-105 ${
                  selectedTitle === title.id
                    ? "ring-2 ring-light-accent dark:ring-dark-accent"
                    : ""
                }`}
                onClick={() => openConfirmModal(title.id, "select")}
              >
                <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/60 dark:border-gray-700/60 rounded-xl p-5 h-full relative overflow-hidden group-hover:border-light-accent/30 dark:group-hover:border-dark-accent/30 transition-colors duration-300">
                  {/* 배경 장식 */}
                  <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-light-accent/5 to-light-purple/5 dark:from-dark-accent/5 dark:to-dark-purple/5 rounded-full blur-xl transform translate-x-8 -translate-y-8" />

                  {/* 선택됨 표시 */}
                  {selectedTitle === title.id && (
                    <div className="absolute top-3 right-3">
                      <CheckCircleSolidIcon className="w-6 h-6 text-light-accent dark:text-dark-accent" />
                    </div>
                  )}

                  {/* 희귀도와 이름 */}
                  <div className="flex items-start gap-3 mb-3">
                    <span className="text-2xl">
                      {getRarityIcon(title.rarity)}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900 dark:text-white text-lg">
                          {title.name}
                        </h3>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${getTitleRarityColor(
                            title.rarity
                          )}`}
                        >
                          {getRarityName(title.rarity)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                        {title.description}
                      </p>
                    </div>
                  </div>

                  {/* 획득 조건 */}
                  <div className="flex items-center gap-2 mb-3 text-xs text-gray-500 dark:text-gray-400">
                    <InformationCircleIcon className="w-4 h-4" />
                    <span>{title.condition}</span>
                  </div>

                  {/* 획득 날짜 */}
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <CalendarIcon className="w-4 h-4" />
                    <span>{formatDate(title.earnedAt)} 획득</span>
                  </div>

                  {/* 호버 효과 */}
                  <div className="absolute inset-0 bg-gradient-to-r from-light-accent/0 to-light-accent/5 dark:from-dark-accent/0 dark:to-dark-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* 타이틀 획득 안내 */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-700">
        <div className="flex items-start gap-3">
          <SparklesIcon className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
              타이틀 획득 방법
            </h3>
            <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
              <p>
                • 사이트 활동을 통해 자동으로 조건을 달성하면 타이틀이
                부여됩니다
              </p>
              <p>
                • 로그인, 좋아요, 플레이리스트 생성 등 다양한 활동으로 획득 가능
              </p>
              <p>• 특별한 기간에만 얻을 수 있는 한정 타이틀도 있습니다</p>
              <p>• 선택한 타이틀은 전체 사이트에서 표시됩니다</p>
            </div>
          </div>
        </div>
      </div>

      {/* 타이틀 변경 확인 모달 */}
      <AnimatePresence>
        {confirmModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* 배경 오버레이 */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() =>
                !isUpdating &&
                setConfirmModal({
                  isOpen: false,
                  title: null,
                  action: "select",
                })
              }
            />

            {/* 모달 콘텐츠 */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-6 max-w-md w-full mx-4"
            >
              {/* 배경 장식 */}
              <div className="absolute inset-0 bg-gradient-to-br from-light-accent/5 to-light-purple/5 dark:from-dark-accent/5 dark:to-dark-purple/5 rounded-2xl" />

              <div className="relative">
                {/* 헤더 */}
                <div className="text-center mb-6">
                  <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-light-accent to-light-purple dark:from-dark-accent dark:to-dark-purple rounded-full flex items-center justify-center">
                    <TrophyIcon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    {confirmModal.action === "remove"
                      ? "타이틀 해제"
                      : "타이틀 변경"}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    {confirmModal.action === "remove"
                      ? "현재 선택된 타이틀을 해제하시겠습니까?"
                      : "선택한 타이틀로 변경하시겠습니까?"}
                  </p>
                </div>

                {/* 타이틀 정보 */}
                {confirmModal.action === "select" && confirmModal.title && (
                  <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-600 rounded-xl p-4 mb-6">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">
                        {getRarityIcon(confirmModal.title.rarity)}
                      </span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-gray-900 dark:text-white">
                            {confirmModal.title.name}
                          </h4>
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${getTitleRarityColor(
                              confirmModal.title.rarity
                            )}`}
                          >
                            {getRarityName(confirmModal.title.rarity)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {confirmModal.title.description}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {confirmModal.action === "remove" && selectedTitle && (
                  <div className="bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 rounded-xl p-4 mb-6 border border-red-200 dark:border-red-700">
                    <div className="flex items-center gap-3">
                      {(() => {
                        const currentTitle = userTitles.find(
                          (t) => t.id === selectedTitle
                        );
                        if (!currentTitle) return null;

                        return (
                          <>
                            <span className="text-2xl">
                              {getRarityIcon(currentTitle.rarity)}
                            </span>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-semibold text-gray-900 dark:text-white">
                                  {currentTitle.name}
                                </h4>
                                <span
                                  className={`px-2 py-1 rounded-full text-xs font-medium ${getTitleRarityColor(
                                    currentTitle.rarity
                                  )}`}
                                >
                                  {getRarityName(currentTitle.rarity)}
                                </span>
                              </div>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                현재 선택된 타이틀이 해제됩니다
                              </p>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {/* 버튼 */}
                <div className="flex gap-3">
                  <button
                    onClick={() =>
                      !isUpdating &&
                      setConfirmModal({
                        isOpen: false,
                        title: null,
                        action: "select",
                      })
                    }
                    disabled={isUpdating}
                    className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleTitleChange}
                    disabled={isUpdating}
                    className={`flex-1 px-4 py-3 text-white rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                      confirmModal.action === "remove"
                        ? "bg-red-500 hover:bg-red-600"
                        : "bg-gradient-to-r from-light-accent to-light-purple dark:from-dark-accent dark:to-dark-purple hover:shadow-lg transform hover:scale-105"
                    }`}
                  >
                    {isUpdating ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        변경 중...
                      </div>
                    ) : confirmModal.action === "remove" ? (
                      "해제하기"
                    ) : (
                      "변경하기"
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
