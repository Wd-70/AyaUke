"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { SongData } from "@/types";
import {
  MusicalNoteIcon,
  XMarkIcon,
  PencilIcon,
} from "@heroicons/react/24/outline";
import SongEditForm from "./SongEditForm";
import { useSession } from "next-auth/react";

interface SongLyricsModalProps {
  song: SongData;
  isExpanded: boolean;
  onClose: () => void;
  onPlay?: (song: SongData) => void;
  isMobileScreen: boolean;
}

export default function SongLyricsModal({
  song,
  isExpanded,
  onClose,
  onPlay,
  isMobileScreen,
}: SongLyricsModalProps) {
  const { data: session } = useSession();
  const [isEditMode, setIsEditMode] = useState(false);


  // 관리자 권한 체크
  const isAdmin = session?.user?.isAdmin || false;

  // 현재 표시되는 제목과 아티스트 (alias 우선)
  const displayTitle = song.titleAlias || song.title;
  const displayArtist = song.artistAlias || song.artist;




  // 편집 모드 토글
  const toggleEditMode = () => {
    setIsEditMode(!isEditMode);
  };

  // 편집 저장 핸들러
  const handleSaveEdit = (updatedSong: SongData) => {
    Object.assign(song, updatedSong);
    setIsEditMode(false);
  };

  // 편집 취소 핸들러
  const handleCancelEdit = () => {
    setIsEditMode(false);
  };



  // 모달 닫기 핸들러
  const handleClose = () => {
    onClose();
  };

  // 스크롤 핸들러
  const handleDialogScroll = (e: React.WheelEvent) => {
    e.stopPropagation();
  };

  const handleScrollableAreaScroll = (e: React.WheelEvent) => {
    e.stopPropagation();
  };

  // 키 조절 포맷팅 함수
  const formatKeyAdjustment = (keyAdjustment: number | null | undefined) => {
    if (keyAdjustment === null || keyAdjustment === undefined) return null;
    if (keyAdjustment === 0) return "원본키";
    return keyAdjustment > 0 ? `+${keyAdjustment}키` : `${keyAdjustment}키`;
  };

  const languageColors = {
    Korean: "bg-blue-500",
    English: "bg-purple-500",
    Japanese: "bg-pink-500",
    Chinese: "bg-red-500",
  };

  if (!isExpanded) return null;

  return (
    <>
      {/* 확장 시 배경 오버레이 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
        onClick={handleClose}
      />

      {/* 확장된 모달 */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, x: "-50%", y: "-10%" }}
        animate={{ opacity: 1, scale: 1, x: "-50%", y: "0%" }}
        exit={{ opacity: 0, scale: 0.9, x: "-50%", y: "-10%" }}
        transition={{ duration: 0.3 }}
        className="fixed top-20 sm:top-20 left-1/2 z-40 
                   w-[95vw] max-w-[1600px] overflow-hidden
                   bg-white dark:bg-gray-900 backdrop-blur-sm 
                   rounded-xl border border-light-primary/20 dark:border-dark-primary/20 
                   shadow-2xl transform -translate-x-1/2 youtube-dialog-container
                   xl:overflow-y-auto xl:overscroll-behavior-contain"
        style={{
          top: isMobileScreen ? "4.5rem" : "5rem",
          height: isMobileScreen
            ? "calc(var(--vh, 1vh) * 100 - 5rem)"
            : "calc(var(--vh, 1vh) * 100 - 6rem)",
          overscrollBehavior: "contain",
        }}
        onWheel={handleDialogScroll}
      >
        {/* Background gradient overlay */}
        <div
          className="absolute inset-0 bg-gradient-to-br from-light-accent/5 to-light-purple/5 
                        dark:from-dark-accent/5 dark:to-dark-purple/5 rounded-xl"
        ></div>

        <div className="relative p-3 sm:p-4 xl:p-6 flex flex-col xl:flex-row h-full gap-3 sm:gap-4 xl:gap-8">
          {/* 왼쪽: 가사 전용 영역 (XL 이상에서만) */}
          <div className="hidden xl:flex xl:w-1/2 flex-col min-h-0">
            <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
              <MusicalNoteIcon className="w-6 h-6 text-light-accent dark:text-dark-accent" />
              <h4 className="text-xl font-semibold text-light-text dark:text-dark-text">
                가사
              </h4>
            </div>
            <div className="flex-1 p-3 sm:p-6 bg-light-primary/5 dark:bg-dark-primary/5 rounded-lg border border-light-primary/20 dark:border-dark-primary/20 flex flex-col min-h-0">
              {song.lyrics ? (
                <div
                  className="scrollable-content text-light-text/80 dark:text-dark-text/80 whitespace-pre-line leading-relaxed text-base md:text-lg overflow-y-auto flex-1 min-h-0"
                  style={{
                    overscrollBehavior: "contain",
                    willChange: "scroll-position",
                    transform: "translateZ(0)",
                  }}
                >
                  {song.lyrics}
                </div>
              ) : (
                <div className="text-center flex flex-col items-center justify-center text-light-text/50 dark:text-dark-text/50 flex-1">
                  <MusicalNoteIcon className="w-16 h-16 mb-4 opacity-30" />
                  <p className="text-lg mb-2">
                    아직 가사가 등록되지 않았습니다
                  </p>
                  <p className="text-base">곧 업데이트될 예정입니다</p>
                </div>
              )}
            </div>
          </div>

          {/* 오른쪽: 모든 다른 요소들 */}
          <div className={`flex-1 xl:w-1/2 flex flex-col min-h-0 relative ${isEditMode ? 'xl:pr-4' : ''}`}>
            {/* 메타데이터 섹션 - Grid 레이아웃으로 공간 활용 최적화 */}
            <div className="mb-3 sm:mb-4 xl:mb-6 relative">
              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 md:gap-4">
                {/* 왼쪽 영역: 제목, 아티스트, 태그들 */}
                <div className="min-w-0">
                  {/* 제목과 아티스트 */}
                  <div className="mb-2">
                    <h3 className="text-lg sm:text-xl xl:text-2xl font-bold text-light-text dark:text-dark-text mb-1 leading-tight">
                      {displayTitle}
                    </h3>
                    <p className="text-base sm:text-lg xl:text-xl text-light-text/70 dark:text-dark-text/70">
                      {displayArtist}
                    </p>
                  </div>

                  {/* 메타데이터와 태그들 */}
                  <div className="flex flex-wrap gap-2">
                    {/* 키 조절 표시 */}
                    {song.keyAdjustment !== null &&
                      song.keyAdjustment !== undefined && (
                        <span className="px-2 py-1 text-xs bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full">
                          {formatKeyAdjustment(song.keyAdjustment)}
                        </span>
                      )}

                    {/* 언어 표시 */}
                    {song.language && (
                      <span
                        className={`px-2 py-1 text-xs text-white rounded-full ${
                          languageColors[
                            song.language as keyof typeof languageColors
                          ] || "bg-gray-500"
                        }`}
                      >
                        {song.language}
                      </span>
                    )}

                    {/* 즐겨찾기 표시 */}
                    {song.isFavorite && (
                      <span className="px-2 py-1 text-xs bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 rounded-full">
                        ★ 즐겨찾기
                      </span>
                    )}

                    {/* 검색 태그들 */}
                    {song.searchTags &&
                      song.searchTags.map((tag, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 text-xs bg-light-secondary/20 dark:bg-dark-secondary/20 
                                 text-light-text/70 dark:text-dark-text/70 rounded-full"
                        >
                          #{tag}
                        </span>
                      ))}
                  </div>
                </div>

                {/* 오른쪽 영역: 버튼들 - 데스크톱에서만 별도 영역 */}
                <div className="hidden md:flex flex-col gap-2 items-end justify-start">
                  <div className="flex gap-2">
                    {/* 관리자 전용 편집 버튼 */}
                    {isAdmin && (
                      <button
                        onClick={toggleEditMode}
                        className={`p-2 rounded-full transition-colors duration-200 ${
                          isEditMode
                            ? "bg-light-accent/20 dark:bg-dark-accent/20 text-light-accent dark:text-dark-accent"
                            : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                        }`}
                        title={isEditMode ? "편집 중" : "편집"}
                      >
                        <PencilIcon className="w-5 h-5" />
                      </button>
                    )}

                    {/* 닫기 버튼 - 모든 사용자 */}
                    <button
                      onClick={handleClose}
                      className="p-2 rounded-full bg-red-500/20 hover:bg-red-500/30 
                               transition-colors duration-200"
                      title="닫기"
                    >
                      <XMarkIcon className="w-5 h-5 text-red-500" />
                    </button>
                  </div>
                </div>

                {/* 모바일에서 버튼들 - 제목 오른쪽에 배치 */}
                <div className="md:hidden absolute top-0 right-0 flex gap-2">
                  {/* 관리자 전용 편집 버튼 */}
                  {isAdmin && (
                    <button
                      onClick={toggleEditMode}
                      className={`p-2 rounded-full transition-colors duration-200 ${
                        isEditMode
                          ? "bg-light-accent/20 dark:bg-dark-accent/20 text-light-accent dark:text-dark-accent"
                          : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                      }`}
                      title={isEditMode ? "편집 중" : "편집"}
                    >
                      <PencilIcon className="w-4 h-4" />
                    </button>
                  )}

                  {/* 닫기 버튼 - 모든 사용자 */}
                  <button
                    onClick={handleClose}
                    className="p-2 rounded-full bg-red-500/20 hover:bg-red-500/30 
                             transition-colors duration-200"
                    title="닫기"
                  >
                    <XMarkIcon className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              </div>
            </div>

            {/* 큰 화면에서의 영상 섹션 - 플레이어 대상 영역 */}
            <div className="hidden xl:flex flex-col flex-1 gap-4 xl:gap-0 min-h-0">
              {isEditMode ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className="bg-light-primary/5 dark:bg-dark-primary/5 rounded-lg border border-light-primary/20 dark:border-dark-primary/20 flex flex-col xl:flex-1 xl:min-h-0 xl:h-auto flex-1 min-h-0"
                >
                  <SongEditForm
                    song={song}
                    isVisible={true}
                    onSave={handleSaveEdit}
                    onCancel={handleCancelEdit}
                  />
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  transition={{ duration: 0.3, delay: 0.1 }}
                  className="bg-light-primary/5 dark:bg-dark-primary/5 rounded-lg border border-light-primary/20 dark:border-dark-primary/20 flex flex-col flex-1 min-h-0"
                >
                  {/* 
                    📝 주의: MR 영상과 라이브 클립 화면은 SongCard.tsx에서 제어됩니다.
                    이 모달은 가사 표시 전용으로 사용되며, 실제 영상 재생은 
                    SongCard.tsx의 통합 플레이어 시스템을 통해 처리됩니다.
                  */}

                  {/* 
                    🎵 XL 화면 MR/라이브클립 영역
                    실제 영상 재생은 SongCard.tsx의 통합 플레이어가 이 영역에 오버레이됩니다.
                  */}

                </motion.div>
              )}
            </div>

            {/* 작은 화면에서의 탭/편집 섹션 */}
            <div className="xl:hidden bg-light-primary/5 dark:bg-dark-primary/5 rounded-lg border border-light-primary/20 dark:border-dark-primary/20 relative flex flex-col flex-1 min-h-0">
              {isEditMode ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className="flex flex-col xl:flex-1 xl:min-h-0 xl:h-auto flex-1 min-h-0"
                >
                  <SongEditForm
                    song={song}
                    isVisible={true}
                    onSave={handleSaveEdit}
                    onCancel={handleCancelEdit}
                  />
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3, delay: 0.1 }}
                  className="flex flex-col flex-1 min-h-0"
                >
                  {/* 
                    📱 모바일 화면 - 가사 표시 전용
                    MR과 라이브클립은 SongCard.tsx에서 별도 처리됩니다.
                  */}
                  <div className="flex items-center gap-2 mb-4 px-4 py-2">
                    <MusicalNoteIcon className="w-5 h-5 text-light-accent dark:text-dark-accent" />
                    <h3 className="text-lg font-semibold text-light-text dark:text-dark-text">가사</h3>
                  </div>

                  {/* 가사 섹션 */}
                  <div className="flex flex-col flex-1 min-h-0 p-3 sm:p-6">
                    {song.lyrics ? (
                      <div
                        className="scrollable-content text-light-text/80 dark:text-dark-text/80 whitespace-pre-line leading-relaxed text-base md:text-lg overflow-y-auto flex-1 min-h-0"
                        style={{
                          overscrollBehavior: "contain",
                          willChange: "scroll-position",
                          transform: "translateZ(0)",
                        }}
                        onWheel={handleScrollableAreaScroll}
                      >
                        {song.lyrics}
                      </div>
                    ) : (
                      <div className="text-center h-full flex flex-col items-center justify-center text-light-text/50 dark:text-dark-text/50">
                        <MusicalNoteIcon className="w-16 h-16 mb-4 opacity-30" />
                        <p className="text-lg mb-2">
                          아직 가사가 등록되지 않았습니다
                        </p>
                        <p className="text-base">곧 업데이트될 예정입니다</p>
                      </div>
                    )}
                  </div>

                </motion.div>
              )}
            </div>

            {/* 
              📝 Action buttons 영역
              MR 재생/검색 버튼들은 SongCard.tsx에서 처리됩니다.
              이 모달은 가사 표시 전용입니다.
            */}
          </div>
        </div>
      </motion.div>
    </>
  );
}
