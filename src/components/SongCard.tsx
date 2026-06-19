"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion } from "framer-motion";
import { SongData } from "@/types";
import {
  MusicalNoteIcon,
  PlayIcon,
  PauseIcon,
  XMarkIcon,
  VideoCameraIcon,
  MagnifyingGlassIcon,
  ArrowTopRightOnSquareIcon,
  ListBulletIcon,
  PencilIcon,
  ComputerDesktopIcon,
  DocumentDuplicateIcon,
} from "@heroicons/react/24/outline";
import { HeartIcon, MicrophoneIcon } from "@heroicons/react/24/solid";
import YouTube from "react-youtube";
import { useLike } from "@/hooks/useLikes";
import { useSongPlaylists } from "@/hooks/useGlobalPlaylists";
import PlaylistContextMenu from "./PlaylistContextMenu";
import LiveClipManager from "./LiveClipManager";
import LiveClipEditor from "./LiveClipEditor";
import SongEditForm from "./SongEditForm";
import SongDetailModal from "./SongDetailModal";
import OfficialCornerFold from "./OfficialCornerFold";
import { isOfficialSong } from "@/shared/utils/song-source";
import { useSession } from "next-auth/react";
import { useToast } from "./Toast";
import { useConfirm } from "./ConfirmDialog";

// YouTube 플레이어 타입 정의
interface YouTubePlayer {
  playVideo(): void;
  pauseVideo(): void;
  getPlayerState(): number;
}

interface SongCardProps {
  song: SongData;
  onPlay?: (song: SongData) => void;
  showNumber?: boolean;
  number?: number;
  onDialogStateChange?: (isOpen: boolean) => void;
}

export default function SongCard({
  song,
  showNumber = false,
  number,
  onDialogStateChange,
}: SongCardProps) {
  const { data: session } = useSession();
  const { liked, isLoading: likeLoading, toggleLike } = useLike(song.id);
  const { playlists: songPlaylists } = useSongPlaylists(song.id);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTab, setCurrentTab] = useState<"lyrics" | "mr" | "videos">(
    "lyrics"
  );
  const [youtubePlayer, setYoutubePlayer] = useState<YouTubePlayer | null>(
    null
  );
  const [isXLScreen, setIsXLScreen] = useState(false);
  const [playerPosition, setPlayerPosition] = useState({
    top: 0,
    left: 0,
    width: 0,
    height: 0,
  });
  const [liveClipPosition, setLiveClipPosition] = useState({
    top: 0,
    left: 0,
    width: 0,
    height: 0,
  });
  const [showPlaylistMenu, setShowPlaylistMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [isMobileScreen, setIsMobileScreen] = useState(false);

  // 편집 모드 상태
  const [isEditMode, setIsEditMode] = useState(false);
  // 라이브 클립 데이터 상태 (LiveClipManager와 LiveClipEditor 공유)
  const [songVideos, setSongVideos] = useState<any[]>([]);
  const [videosLoading, setVideosLoading] = useState(false);

  // 토스트 훅
  const { showSuccess, showError, showInfo } = useToast();
  const confirm = useConfirm();
  const [videosLoaded, setVideosLoaded] = useState(false); // 한 번이라도 로드 시도했는지 추적

  // 가사 전용 상태 (성능 최적화를 위해 분리)
  const [lyricsText, setLyricsText] = useState(song.lyrics || "");

  // 관리자 권한 체크
  const isAdmin = session?.user?.isAdmin || false;

  // OBS 상태 관리
  const [obsActive, setObsActive] = useState(false);
  const [obsLoading, setObsLoading] = useState(false);

  // Player position 계산 최적화
  const optimizedPlayerStyle = useMemo(() => {
    const shouldShow =
      (isXLScreen && (currentTab === "mr" || currentTab === "lyrics")) ||
      (!isXLScreen && currentTab === "mr");

    return {
      position: "fixed" as const,
      top: shouldShow ? playerPosition.top : -9999,
      left: shouldShow ? playerPosition.left : -9999,
      width: `${playerPosition.width || 0}px`,
      height: `${playerPosition.height || 0}px`,
      maxWidth: `${playerPosition.width || 0}px`,
      maxHeight: `${playerPosition.height || 0}px`,
      minWidth: 0,
      minHeight: 0,
      pointerEvents: "auto" as const,
      zIndex: 50,
      overflow: "hidden" as const,
      boxSizing: "border-box" as const,
    };
  }, [isXLScreen, currentTab, playerPosition]);

  // LiveClip position 계산 최적화
  const optimizedLiveClipStyle = useMemo(() => {
    const shouldShow = currentTab === "videos";

    return {
      position: "fixed" as const,
      top: shouldShow ? liveClipPosition.top : -9999,
      left: shouldShow ? liveClipPosition.left : -9999,
      width: `${liveClipPosition.width || 0}px`,
      height: `${liveClipPosition.height || 0}px`,
      maxWidth: `${liveClipPosition.width || 0}px`,
      maxHeight: `${liveClipPosition.height || 0}px`,
      minWidth: 0,
      minHeight: 0,
      pointerEvents: "auto" as const,
      zIndex: 50,
      overflow: "hidden" as const,
      boxSizing: "border-box" as const,
    };
  }, [isXLScreen, currentTab, liveClipPosition]);


  // 라이브 클립 데이터 로드
  const loadSongVideos = useCallback(async () => {
    setVideosLoading(true);
    try {
      const response = await fetch(`/api/songs/${song.id}/videos`);
      if (response.ok) {
        const data = await response.json();
        setSongVideos(data.videos || []);
        setVideosLoaded(true); // 성공적으로 로드했음을 표시
      } else {
        console.error("라이브 클립 로딩 실패");
        setVideosLoaded(true); // 실패해도 시도했음을 표시
      }
    } catch (error) {
      console.error("라이브 클립 로딩 오류:", error);
      setVideosLoaded(true); // 에러가 나도 시도했음을 표시
    } finally {
      setVideosLoading(false);
    }
  }, [song.id]); // song.id가 변경될 때만 함수 재생성

  // 곡이 바뀔 때 라이브 클립 상태 초기화
  useEffect(() => {
    setSongVideos([]);
    setVideosLoaded(false);
    setVideosLoading(false);
  }, [song.id]);

  // 라이브 클립 데이터 로드 (videos 탭을 처음 열 때만)
  useEffect(() => {
    if (
      isExpanded &&
      currentTab === "videos" &&
      !videosLoaded &&
      !videosLoading
    ) {
      loadSongVideos();
    }
  }, [isExpanded, currentTab, videosLoaded, videosLoading, loadSongVideos]);

  // debounced 가사 업데이트 핸들러 (성능 최적화)
  const handleLyricsChange = useCallback((newLyrics: string) => {
    // 즉시 UI 업데이트 (사용자 입력 반응성 유지)
    setLyricsText(newLyrics);
  }, []);

  // song이 변경될 때 lyricsText 초기화
  useEffect(() => {
    setLyricsText(song.lyrics || "");
  }, [song.lyrics]);


  // XL 화면에서는 MR 탭을 기본으로 설정
  useEffect(() => {
    const updateDefaultTab = () => {
      const isXL = window.innerWidth >= 1280;
      if (isExpanded && isXL && currentTab === "lyrics") {
        // XL 화면에서 가사 탭이 선택되어 있으면 MR 탭으로 변경
        setCurrentTab("mr");
      }
    };

    // 다이얼로그가 열릴 때 실행
    if (isExpanded) {
      updateDefaultTab();
      // 화면 크기 변경 감지
      window.addEventListener("resize", updateDefaultTab);
    }

    return () => {
      window.removeEventListener("resize", updateDefaultTab);
    };
  }, [isExpanded, currentTab]);

  // 편집 모드 토글
  const toggleEditMode = () => {
    setIsEditMode(!isEditMode);
  };

  // 다이얼로그 닫기 공통 함수
  const handleCloseDialog = useCallback(() => {
    setIsExpanded(false);
    setIsEditMode(false);
    setCurrentTab("lyrics");
    
    // 모든 플레이어 상태 초기화
    setYoutubePlayer(null);
    setIsPlaying(false);
    
    // OBS가 ON 상태인 경우에만 다이얼로그 닫을 때 OFF
    if (obsActive && session?.user?.userId) {
      // 즉시 UI 상태 업데이트
      setObsActive(false);
      // API 요청은 백그라운드에서 처리 (응답 대기 안함)
      fetch("/api/obs/delete", { method: "DELETE" }).catch((error) => {
        console.error("OBS 상태 정리 오류:", error);
      });
      console.log("다이얼로그 닫힘으로 인한 OBS 상태 OFF");
    }
  }, [obsActive, session?.user?.userId]);

  // ESC 키 핸들러
  const handleEscapeKey = useCallback(async () => {
    if (isEditMode) {
      // 수정 모드에서 ESC: 일반 모드로
      setIsEditMode(false);
    } else {
      // 일반 모드에서 ESC: 다이얼로그 닫기
      handleCloseDialog();
    }
  }, [isEditMode, handleCloseDialog]);

  // ESC 키 이벤트 리스너 등록
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleEscapeKey();
      }
    };

    if (isExpanded) {
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isExpanded, handleEscapeKey]);

  // SongEditForm용 저장 핸들러
  const handleSaveEdit = (updatedSong: SongData) => {
    // 곡 데이터 업데이트
    Object.assign(song, updatedSong);
    setIsEditMode(false);
  };

  // 편집 취소
  const cancelEdit = () => {
    setIsEditMode(false);
  };

  // OBS 토글 함수
  const toggleOBS = async () => {
    if (!session?.user?.userId) {
      showError("로그인 필요", "OBS 기능을 사용하려면 로그인이 필요합니다.");
      return;
    }

    if (obsLoading) {
      console.log("OBS 요청 이미 진행 중...");
      return; // 중복 실행 방지
    }

    setObsLoading(true);
    try {
      if (obsActive) {
        // OBS OFF - 상태 삭제
        const response = await fetch("/api/obs/delete", {
          method: "DELETE",
        });

        if (response.ok) {
          setObsActive(false);
          console.log("OBS 상태 OFF");
        } else {
          // 개발 환경에서는 서버 재시작으로 상태가 사라질 수 있음
          console.log("OBS OFF 응답 (개발환경에서는 정상)");
          setObsActive(false);
        }
      } else {
        // OBS ON - 상태 생성
        const currentSong = {
          title: song.titleAlias || song.title,
          artist: song.artistAlias || song.artist,
        };

        const response = await fetch("/api/obs/create", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ currentSong }),
        });

        const result = await response.json();

        if (result.success) {
          setObsActive(true);
          console.log(`OBS 상태 ON: ${result.obsUrl}`);
        } else if (response.status === 409) {
          // 기존 OBS가 활성화되어 있지만 UI상 ON 상태로 표시 (수동으로 끌 수 있도록)
          setObsActive(true);
          showError("OBS 이미 활성화됨", "다른 곡의 OBS가 활성화되어 있습니다. 먼저 끄고 다시 시도하세요.");
        } else {
          showError("OBS 오류", result.error || "OBS 켜기에 실패했습니다.");
        }
      }
    } catch (error) {
      console.error("OBS 토글 오류:", error);
      showError("OBS 오류", "OBS 설정 중 오류가 발생했습니다.");
    } finally {
      setObsLoading(false);
    }
  };

  // OBS 링크 복사 함수
  const copyOBSLink = async () => {
    if (!session?.user?.userId) {
      showError(
        "로그인 필요",
        "OBS 링크 복사 기능을 사용하려면 로그인이 필요합니다."
      );
      return;
    }

    const obsUrl = `${window.location.origin}/obs/overlay/${session.user.userId}`;

    try {
      await navigator.clipboard.writeText(obsUrl);
      showSuccess("복사 완료", "OBS 링크가 클립보드에 복사되었습니다!");
    } catch (error) {
      console.error("클립보드 복사 오류:", error);
      // 대체 방법으로 텍스트 선택
      const textArea = document.createElement("textarea");
      textArea.value = obsUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      showSuccess("복사 완료", "OBS 링크가 클립보드에 복사되었습니다!");
    }
  };

  // 태그 변경 핸들러

  const languageColors = {
    Korean: "bg-blue-500",
    English: "bg-purple-500",
    Japanese: "bg-pink-500",
  };

  // 키 조절 포맷팅 함수
  const formatKeyAdjustment = (keyAdjustment: number | null | undefined) => {
    if (keyAdjustment === null || keyAdjustment === undefined) return null;
    if (keyAdjustment === 0) return "원본키";
    return keyAdjustment > 0 ? `+${keyAdjustment}키` : `${keyAdjustment}키`;
  };

  // 표시할 제목과 아티스트 결정
  const displayTitle = song.titleAlias || song.title;
  const displayArtist = song.artistAlias || song.artist;

  // 이미지 없는 카드용: 제목 시드 기반 브랜드 계열 그라데이션 (곡마다 고유, 결정적)
  const noImageGradient = useMemo(() => {
    const palettes = [
      "from-light-accent/15 to-light-purple/10 dark:from-dark-accent/20 dark:to-dark-purple/15",
      "from-light-purple/15 to-light-secondary/10 dark:from-dark-purple/20 dark:to-dark-secondary/15",
      "from-light-secondary/15 to-light-accent/10 dark:from-dark-secondary/20 dark:to-dark-accent/15",
      "from-light-primary/15 to-light-accent/10 dark:from-dark-primary/25 dark:to-dark-accent/15",
    ];
    const seed = `${song.title}${song.artist}`;
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    return palettes[h % palettes.length];
  }, [song.title, song.artist]);

  // YouTube URL에서 비디오 ID 추출
  const getYouTubeVideoId = (url: string) => {
    const regex =
      /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
  };

  // MR 링크에서 YouTube URL 찾기
  const getYouTubeMRLink = () => {
    // mrLinks 사용
    const mrLinks = song.mrLinks;
    if (!mrLinks || mrLinks.length === 0) return null;
    const selectedMR = mrLinks[song.selectedMRIndex || 0];
    if (!selectedMR) return null;

    // URL에 시간 파라미터 추가
    let urlWithTime = selectedMR.url;
    if (selectedMR.skipSeconds && selectedMR.skipSeconds > 0) {
      // 기존 URL에 t 파라미터가 있는지 확인
      const hasTimeParam =
        urlWithTime.includes("&t=") || urlWithTime.includes("?t=");
      if (!hasTimeParam) {
        const separator = urlWithTime.includes("?") ? "&" : "?";
        urlWithTime = `${urlWithTime}${separator}t=${selectedMR.skipSeconds}`;
      }
    }

    const videoId = getYouTubeVideoId(urlWithTime);
    return videoId
      ? {
          videoId,
          skipSeconds: selectedMR.skipSeconds || 0,
          fullUrl: urlWithTime,
        }
      : null;
  };

  const youtubeMR = getYouTubeMRLink();

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (youtubeMR) {
      // MR 링크가 있으면 새 창에서 열기
      window.open(youtubeMR.fullUrl, "_blank");
    } else {
      // MR 링크가 없으면 검색 기능 실행
      handleMRSearch(e);
    }
  };

  const handleModalPlay = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (youtubeMR) {
      // MR 링크가 있을 때만 재생 기능 실행
      if (
        youtubePlayer &&
        typeof youtubePlayer.playVideo === "function" &&
        typeof youtubePlayer.pauseVideo === "function"
      ) {
        // 플레이어가 준비되었을 때
        try {
          if (isPlaying) {
            youtubePlayer.pauseVideo();
            setIsPlaying(false);
          } else {
            youtubePlayer.playVideo();
            setIsPlaying(true);
          }
        } catch (error) {
          console.warn("YouTube player control error:", error);
          // 에러 발생 시 MR 탭으로 전환
          setCurrentTab("mr");
        }
      } else {
        // 플레이어가 아직 준비되지 않았을 때 - MR 탭으로 전환
        console.log("YouTube player not ready, switching to MR tab");
        setCurrentTab("mr");
      }
    } else {
      // MR 링크가 없을 때는 검색 기능 실행
      handleMRSearch(e);
    }
  };

  const handleMRSearch = (e: React.MouseEvent) => {
    e.stopPropagation();
    // 직접 YouTube 검색 수행 (더 안정적)
    const searchQuery = encodeURIComponent(
      `${displayTitle} ${displayArtist} karaoke MR`
    );
    window.open(
      `https://www.youtube.com/results?search_query=${searchQuery}`,
      "_blank"
    );
  };

  const handleOpenInNewTab = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (youtubeMR) {
      window.open(youtubeMR.fullUrl, "_blank");
    }
  };

  const onYouTubeReady = (event: { target: YouTubePlayer | null }) => {
    // 컴포넌트가 unmount된 경우 처리 중단
    if (!event?.target) {
      console.log("YouTube player target is null, component may be unmounted");
      return;
    }

    console.log("YouTube player ready:", event.target);
    setYoutubePlayer(event.target);

    // 플레이어가 준비되면 자동 재생 방지
    try {
      if (event.target && typeof event.target.pauseVideo === "function") {
        // 더 긴 지연으로 플레이어 완전 초기화 대기
        setTimeout(() => {
          try {
            // 다시 한번 null 체크 (컴포넌트가 unmount될 수 있음)
            if (!event?.target) return;

            // 플레이어 상태를 확인한 후 일시정지 시도
            if (typeof event.target.getPlayerState === "function") {
              const playerState = event.target.getPlayerState();
              if (playerState !== undefined && playerState !== -1) {
                event.target.pauseVideo();
                setIsPlaying(false);
              }
            } else {
              // getPlayerState가 없으면 그냥 일시정지 시도
              event.target.pauseVideo();
              setIsPlaying(false);
            }
          } catch (err) {
            // 에러가 발생해도 조용히 처리 (플레이어가 아직 완전히 로드되지 않은 경우)
            console.log(
              "Failed to pause video on ready (normal during initialization)"
            );
          }
        }, 500); // 지연 시간을 늘림
      }
    } catch (error) {
      console.warn("YouTube player ready error:", error);
    }
  };

  const onYouTubeStateChange = (event: { data: number }) => {
    // 컴포넌트가 unmount된 경우 처리 중단
    if (!event || typeof event.data !== 'number') {
      console.log("YouTube state change event is invalid, component may be unmounted");
      return;
    }

    try {
      // YouTube 플레이어 상태와 동기화
      // -1: 시작되지 않음, 0: 종료, 1: 재생 중, 2: 일시정지, 3: 버퍼링, 5: 동영상 신호
      const playerState = event.data;
      const isCurrentlyPlaying = playerState === 1;
      setIsPlaying(isCurrentlyPlaying);
    } catch (error) {
      console.warn("YouTube state change error:", error);
    }
  };

  const switchTab = (tab: "lyrics" | "mr" | "videos") => {
    setCurrentTab(tab);
  };

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await toggleLike();
  };

  const handlePlaylistClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // 로그인하지 않은 경우 플레이리스트 메뉴 표시하지 않음
    if (!songPlaylists || songPlaylists.length === 0) {
      console.log("🔒 로그인이 필요한 기능입니다");
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuPosition({
      x: rect.left,
      y: rect.bottom + 8,
    });
    setShowPlaylistMenu(true);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuPosition({
      x: e.clientX,
      y: e.clientY,
    });
    setShowPlaylistMenu(true);
  };

  // 실제 뷰포트 높이 계산 및 body 스크롤 비활성화
  useEffect(() => {
    const setViewportHeight = () => {
      // 실제 뷰포트 높이 계산 (모바일 브라우저 주소창/메뉴바 고려)
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty("--vh", `${vh}px`);

      // 모바일 화면 여부 체크
      setIsMobileScreen(window.innerWidth < 640);
    };

    if (isExpanded) {
      // 뷰포트 높이 설정
      setViewportHeight();

      // 리사이즈 이벤트 리스너 추가 (모바일에서 주소창이 사라질 때 감지)
      window.addEventListener("resize", setViewportHeight);
      window.addEventListener("orientationchange", setViewportHeight);

      // body 스크롤 완전 비활성화
      document.body.style.overflow = "hidden";
      document.body.style.paddingRight = "0px"; // 스크롤바 공간 보정
      document.body.style.touchAction = "none"; // 터치 스크롤 방지
      document.documentElement.style.overflow = "hidden"; // html 요소도 차단
    } else {
      // 이벤트 리스너 제거
      window.removeEventListener("resize", setViewportHeight);
      window.removeEventListener("orientationchange", setViewportHeight);

      // body 스크롤 복원
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
      document.body.style.touchAction = "";
      document.documentElement.style.overflow = "";
      // 모달이 닫힐 때 YouTube 플레이어 초기화
      setYoutubePlayer(null);
      setIsPlaying(false);
      setCurrentTab("lyrics");
    }

    // 컴포넌트 언마운트 시 정리
    return () => {
      window.removeEventListener("resize", setViewportHeight);
      window.removeEventListener("orientationchange", setViewportHeight);
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
      document.body.style.touchAction = "";
      document.documentElement.style.overflow = "";
      setYoutubePlayer(null);
      setIsPlaying(false);
    };
  }, [isExpanded]);

  // 다이얼로그 상태 변경 시 부모 컴포넌트에 알림
  useEffect(() => {
    if (onDialogStateChange) {
      onDialogStateChange(isExpanded);
    }
  }, [isExpanded, onDialogStateChange]);

  // 다이얼로그 전체에서 스크롤 이벤트 완전 차단
  const handleDialogScroll = (e: React.WheelEvent) => {
    e.stopPropagation();

    // passive 이벤트 리스너 경고 방지 - 이벤트가 cancellable일 때만 preventDefault 호출
    if (e.cancelable) {
      e.preventDefault();
    }

    // 추가 보안: 네이티브 이벤트도 차단
    if (e.nativeEvent) {
      e.nativeEvent.stopImmediatePropagation();
    }
  };

  // 스크롤 가능한 영역에서만 스크롤 허용
  const handleScrollableAreaScroll = (e: React.WheelEvent) => {
    e.stopPropagation();
    // 여기서는 preventDefault를 호출하지 않아 자연스러운 스크롤 허용
  };

  // MR 플레이어 & LiveClip 위치 계산 및 표시 조건
  useEffect(() => {
    if (!isExpanded || isEditMode) return;

    const updatePositions = () => {
      const xlScreen = window.innerWidth >= 1280;
      setIsXLScreen((prev) => (prev !== xlScreen ? xlScreen : prev));

      // MR 플레이어 위치 계산
      if (youtubeMR) {
        let playerTargetContainer = null;

        if (xlScreen && (currentTab === "mr" || currentTab === "lyrics")) {
          playerTargetContainer = document.getElementById("xl-player-target");
        } else if (!xlScreen && currentTab === "mr") {
          playerTargetContainer = document.getElementById(
            "mobile-player-target"
          );
        }

        if (playerTargetContainer) {
          const targetRect = playerTargetContainer.getBoundingClientRect();
          const computedStyle = window.getComputedStyle(playerTargetContainer);

          // 패딩과 보더를 제외한 실제 내부 크기 계산
          const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0;
          const paddingRight = parseFloat(computedStyle.paddingRight) || 0;
          const paddingTop = parseFloat(computedStyle.paddingTop) || 0;
          const paddingBottom = parseFloat(computedStyle.paddingBottom) || 0;

          const borderLeft = parseFloat(computedStyle.borderLeftWidth) || 0;
          const borderRight = parseFloat(computedStyle.borderRightWidth) || 0;
          const borderTop = parseFloat(computedStyle.borderTopWidth) || 0;
          const borderBottom = parseFloat(computedStyle.borderBottomWidth) || 0;

          const actualWidth = Math.max(
            0,
            targetRect.width -
              paddingLeft -
              paddingRight -
              borderLeft -
              borderRight
          );
          const actualHeight = Math.max(
            0,
            targetRect.height -
              paddingTop -
              paddingBottom -
              borderTop -
              borderBottom
          );

          const newPosition = {
            top: targetRect.top + paddingTop + borderTop,
            left: targetRect.left + paddingLeft + borderLeft,
            width: actualWidth,
            height: actualHeight,
          };

          setPlayerPosition((prev) => {
            if (
              prev.top !== newPosition.top ||
              prev.left !== newPosition.left ||
              prev.width !== newPosition.width ||
              prev.height !== newPosition.height
            ) {
              return newPosition;
            }
            return prev;
          });
        }
      }

      // LiveClip 위치 계산
      if (currentTab === "videos") {
        let liveClipTargetContainer = null;

        if (xlScreen) {
          liveClipTargetContainer =
            document.getElementById("xl-liveclip-target");
        } else {
          liveClipTargetContainer = document.getElementById(
            "mobile-liveclip-target"
          );
        }

        if (liveClipTargetContainer) {
          const targetRect = liveClipTargetContainer.getBoundingClientRect();
          const computedStyle = window.getComputedStyle(
            liveClipTargetContainer
          );

          // 패딩과 보더를 제외한 실제 내부 크기 계산
          const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0;
          const paddingRight = parseFloat(computedStyle.paddingRight) || 0;
          const paddingTop = parseFloat(computedStyle.paddingTop) || 0;
          const paddingBottom = parseFloat(computedStyle.paddingBottom) || 0;

          const borderLeft = parseFloat(computedStyle.borderLeftWidth) || 0;
          const borderRight = parseFloat(computedStyle.borderRightWidth) || 0;
          const borderTop = parseFloat(computedStyle.borderTopWidth) || 0;
          const borderBottom = parseFloat(computedStyle.borderBottomWidth) || 0;

          const actualWidth = Math.max(
            0,
            targetRect.width -
              paddingLeft -
              paddingRight -
              borderLeft -
              borderRight
          );
          const actualHeight = Math.max(
            0,
            targetRect.height -
              paddingTop -
              paddingBottom -
              borderTop -
              borderBottom
          );

          const newLiveClipPosition = {
            top: targetRect.top + paddingTop + borderTop,
            left: targetRect.left + paddingLeft + borderLeft,
            width: actualWidth,
            height: actualHeight,
          };

          setLiveClipPosition((prev) => {
            if (
              prev.top !== newLiveClipPosition.top ||
              prev.left !== newLiveClipPosition.left ||
              prev.width !== newLiveClipPosition.width ||
              prev.height !== newLiveClipPosition.height
            ) {
              return newLiveClipPosition;
            }
            return prev;
          });
        }
      }
    };

    // 초기 위치 계산
    updatePositions();

    // 리사이즈 및 스크롤 이벤트 리스너 등록
    const handleResize = () => {
      // 리사이즈 시 약간의 지연으로 성능 최적화
      setTimeout(updatePositions, 50);
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", updatePositions, { passive: true });

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", updatePositions);
    };
  }, [isExpanded, currentTab, isEditMode, youtubeMR]);

  const handleCardClick = async () => {
    // 곡 데이터를 콘솔에 출력
    console.group(`🎵 ${song.title} - ${song.artist}`);
    console.log("📋 기본 정보:", {
      title: song.title,
      artist: song.artist,
      language: song.language,
      id: song.id,
    });

    if (song.titleAlias || song.artistAlias) {
      console.log("🏷️ 별칭 정보:", {
        titleAlias: song.titleAlias,
        artistAlias: song.artistAlias,
      });
    }

    if (song.sungCount !== undefined || song.lastSungDate) {
      console.log("📊 활동 정보:", {
        sungCount: song.sungCount,
        lastSungDate: song.lastSungDate,
        keyAdjustment: song.keyAdjustment ?? null,
      });
    }

    if (song.mrLinks?.length) {
      console.log("🎤 MR 정보:", {
        mrLinks: song.mrLinks,
        selectedMRIndex: song.selectedMRIndex,
      });
    }

    if (songPlaylists?.length || song.searchTags?.length) {
      console.log("🏷️ 태그/플레이리스트:", {
        tags: song.tags,
        searchTags: song.searchTags,
        playlists: songPlaylists,
      });
    }

    if (song.lyrics) {
      console.log(
        "📝 가사:",
        song.lyrics.substring(0, 100) + (song.lyrics.length > 100 ? "..." : "")
      );
    }

    if (song.personalNotes) {
      console.log("📝 개인 메모:", song.personalNotes);
    }

    console.log("🔍 전체 객체:", song);
    console.groupEnd();

    // 다이얼로그 토글 - 닫을 때는 공통 함수 사용
    if (isExpanded) {
      handleCloseDialog();
    } else {
      setIsExpanded(true);
    }
  };


  // SongCard 컴포넌트 메인 렌더링
  return (
    <>
      {/* 일반 카드 */}
      {!isExpanded && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ y: -5 }}
          transition={{ duration: 0.3 }}
          onClick={handleCardClick}
          onContextMenu={handleContextMenu}
          className="group relative rounded-xl border border-light-primary/20 dark:border-dark-primary/20
                     hover:border-light-accent/40 dark:hover:border-dark-accent/40
                     hover:shadow-xl hover:shadow-light-accent/5 dark:hover:shadow-dark-accent/10
                     transition-all duration-300 overflow-hidden cursor-pointer h-52"
        >
          {/* 공식 등록곡 — 좌상단 접힌 코너 (텍스트 없이 절제된 표식) */}
          {isOfficialSong(song) && <OfficialCornerFold size={22} />}
          {song.imageUrl ? (
            /* 앨범 이미지가 있을 때 */
            <>
              {/* 앨범 이미지 배경 */}
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-110"
                style={{ backgroundImage: `url(${song.imageUrl})` }}
              />

              {/* 라이트/다크모드별 오버레이 */}
              <div
                className="absolute inset-0 bg-white/30 dark:bg-black/20 
                              group-hover:bg-white/25 dark:group-hover:bg-black/15 
                              transition-colors duration-300"
              />

              {/* 하단 그라데이션 */}
              <div
                className="absolute inset-0 bg-gradient-to-t 
                              from-white/60 via-white/15 to-transparent
                              dark:from-black/50 dark:via-black/10 dark:to-transparent"
              />

              <div className="relative p-6 bg-white/20 dark:bg-gray-900/20 backdrop-blur-[1px] h-full">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <h3
                        className="text-lg font-semibold text-light-text dark:text-dark-text 
                                     line-clamp-1 group-hover:text-light-accent dark:group-hover:text-dark-accent 
                                     transition-colors duration-300 flex-1"
                      >
                        {showNumber && number && (
                          <span className="text-light-accent dark:text-dark-accent font-bold mr-2">
                            {number}.
                          </span>
                        )}
                        {displayTitle}
                      </h3>
                      {formatKeyAdjustment(song.keyAdjustment) && (
                        <span
                          className="px-2 py-1 text-xs font-medium rounded-md 
                                       bg-light-primary/10 dark:bg-dark-primary/25
                                       text-light-text/55 dark:text-dark-text/55 flex-shrink-0"
                        >
                          {formatKeyAdjustment(song.keyAdjustment)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-light-text/70 dark:text-dark-text/70 mb-3 line-clamp-1">
                      {displayArtist}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={handleLike}
                      disabled={likeLoading}
                      className="flex items-center justify-center gap-1 px-2 py-1 rounded-full
                                 bg-white/10 dark:bg-gray-800/50 backdrop-blur-sm
                                 hover:bg-light-primary/20 dark:hover:bg-dark-primary/20 
                                 transition-all duration-200 disabled:opacity-50
                                 border border-white/20 dark:border-gray-700/50"
                      title={liked ? "좋아요 취소" : "좋아요"}
                    >
                      <HeartIcon
                        className={`w-4 h-4 transition-all duration-200 
                                   ${
                                     likeLoading
                                       ? "text-red-400 fill-current opacity-60 animate-pulse scale-110"
                                       : liked
                                       ? "text-red-500 fill-current"
                                       : "text-light-text/60 dark:text-dark-text/60 hover:text-red-400"
                                   }`}
                      />
                      {song.likeCount !== undefined && (
                        <span
                          className={`text-xs font-medium transition-all duration-200 min-w-[1rem] text-center ${
                            liked
                              ? "text-red-500"
                              : "text-light-text/70 dark:text-dark-text/70"
                          }`}
                        >
                          {song.likeCount}
                        </span>
                      )}
                    </button>

                    {/* 부른 횟수 표시 */}
                    {song.sungCount !== undefined && song.sungCount > 0 && (
                      <div
                        className="flex items-center justify-center gap-1 px-2 py-1 rounded-full
                                    bg-amber-100/70 dark:bg-amber-500/15
                                    border border-amber-200/50 dark:border-amber-400/20"
                      >
                        <MicrophoneIcon className="w-3 h-3 text-amber-600 dark:text-amber-300" />
                        <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                          {song.sungCount}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Language tag and playlist badges */}
                <div className="flex flex-wrap gap-2 mb-2">
                  {song.language && (
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium text-white 
                                     ${
                                       languageColors[
                                         song.language as keyof typeof languageColors
                                       ] || "bg-gray-500"
                                     }`}
                    >
                      {song.language}
                    </span>
                  )}
                  {songPlaylists.slice(0, 2).map((playlist) => (
                    <span
                      key={playlist._id}
                      className="px-2 py-1 rounded-full text-xs font-medium
                               bg-purple-100 dark:bg-purple-900 
                               text-purple-800 dark:text-purple-200"
                    >
                      🎵 {playlist.name}
                    </span>
                  ))}
                  {songPlaylists.length > 2 && (
                    <span
                      className="px-2 py-1 rounded-full text-xs font-medium
                                   bg-gray-100 dark:bg-gray-800 
                                   text-gray-600 dark:text-gray-400"
                    >
                      +{songPlaylists.length - 2}
                    </span>
                  )}
                </div>

                {/* MR 버튼 - 링크 유무에 따라 다르게 표시 */}
                <div className="mt-auto pt-1 pb-2">
                  <button
                    onClick={handlePlay}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg
                             text-light-accent dark:text-dark-accent
                             bg-light-accent/10 dark:bg-dark-accent/15
                             border border-light-accent/25 dark:border-dark-accent/30
                             hover:bg-gradient-to-r hover:from-light-accent hover:to-light-purple
                             dark:hover:from-dark-accent dark:hover:to-dark-purple
                             hover:text-white hover:border-transparent hover:shadow-md
                             transition-all duration-200"
                  >
                    {youtubeMR ? (
                      <>
                        <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                        <span>MR 열기</span>
                      </>
                    ) : (
                      <>
                        <MagnifyingGlassIcon className="w-4 h-4" />
                        <span>MR 검색</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Hover effect border */}
              <div
                className="absolute inset-0 rounded-xl border-2 border-transparent 
                              group-hover:border-light-accent/20 dark:group-hover:border-dark-accent/20 
                              transition-colors duration-300 pointer-events-none"
              ></div>
            </>
          ) : (
            /* 이미지가 없을 때 - 곡별 고유 그라데이션 + 음표 워터마크 */
            <>
              {/* 곡 시드 기반 소프트 그라데이션 배경 (이미지 카드와의 격차 완화) */}
              <div className={`absolute inset-0 bg-gradient-to-br ${noImageGradient}`}></div>
              {/* 음표 워터마크 — 우하단에 은은하게 */}
              <MusicalNoteIcon
                className="absolute -bottom-4 -right-3 w-28 h-28 text-light-accent/10 dark:text-dark-accent/10
                           rotate-12 pointer-events-none transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6"
              />
              {/* 호버 시 살짝 더 진해지는 오버레이 */}
              <div
                className="absolute inset-0 bg-gradient-to-br from-light-accent/5 to-light-purple/5
                              dark:from-dark-accent/5 dark:to-dark-purple/5 opacity-0
                              group-hover:opacity-100 transition-opacity duration-300"
              ></div>

              <div className="relative p-6 bg-white/45 dark:bg-gray-900/45 backdrop-blur-sm h-full">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <h3
                        className="text-lg font-semibold text-light-text dark:text-dark-text 
                                     line-clamp-1 group-hover:text-light-accent dark:group-hover:text-dark-accent 
                                     transition-colors duration-300 flex-1"
                      >
                        {showNumber && number && (
                          <span className="text-light-accent dark:text-dark-accent font-bold mr-2">
                            {number}.
                          </span>
                        )}
                        {displayTitle}
                      </h3>
                      {formatKeyAdjustment(song.keyAdjustment) && (
                        <span
                          className="px-2 py-1 text-xs font-medium rounded-md 
                                       bg-light-primary/10 dark:bg-dark-primary/25
                                       text-light-text/55 dark:text-dark-text/55 flex-shrink-0"
                        >
                          {formatKeyAdjustment(song.keyAdjustment)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-light-text/70 dark:text-dark-text/70 mb-3 line-clamp-1">
                      {displayArtist}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={handleLike}
                      disabled={likeLoading}
                      className="flex items-center justify-center gap-1 px-2 py-1 rounded-full
                                 bg-white/10 dark:bg-gray-800/50 backdrop-blur-sm
                                 hover:bg-light-primary/20 dark:hover:bg-dark-primary/20 
                                 transition-all duration-200 disabled:opacity-50
                                 border border-white/20 dark:border-gray-700/50"
                      title={liked ? "좋아요 취소" : "좋아요"}
                    >
                      <HeartIcon
                        className={`w-4 h-4 transition-all duration-200 
                                   ${
                                     likeLoading
                                       ? "text-red-400 fill-current opacity-60 animate-pulse scale-110"
                                       : liked
                                       ? "text-red-500 fill-current"
                                       : "text-light-text/60 dark:text-dark-text/60 hover:text-red-400"
                                   }`}
                      />
                      {song.likeCount !== undefined && (
                        <span
                          className={`text-xs font-medium transition-all duration-200 min-w-[1rem] text-center ${
                            liked
                              ? "text-red-500"
                              : "text-light-text/70 dark:text-dark-text/70"
                          }`}
                        >
                          {song.likeCount}
                        </span>
                      )}
                    </button>

                    {/* 부른 횟수 표시 */}
                    {song.sungCount !== undefined && song.sungCount > 0 && (
                      <div
                        className="flex items-center justify-center gap-1 px-2 py-1 rounded-full
                                    bg-amber-100/70 dark:bg-amber-500/15
                                    border border-amber-200/50 dark:border-amber-400/20"
                      >
                        <MicrophoneIcon className="w-3 h-3 text-amber-600 dark:text-amber-300" />
                        <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                          {song.sungCount}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Language tag and playlist badges */}
                <div className="flex flex-wrap gap-2 mb-2">
                  {song.language && (
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium text-white 
                                     ${
                                       languageColors[
                                         song.language as keyof typeof languageColors
                                       ] || "bg-gray-500"
                                     }`}
                    >
                      {song.language}
                    </span>
                  )}
                  {songPlaylists.slice(0, 2).map((playlist) => (
                    <span
                      key={playlist._id}
                      className="px-2 py-1 rounded-full text-xs font-medium
                               bg-purple-100 dark:bg-purple-900 
                               text-purple-800 dark:text-purple-200"
                    >
                      🎵 {playlist.name}
                    </span>
                  ))}
                  {songPlaylists.length > 2 && (
                    <span
                      className="px-2 py-1 rounded-full text-xs font-medium
                                   bg-gray-100 dark:bg-gray-800 
                                   text-gray-600 dark:text-gray-400"
                    >
                      +{songPlaylists.length - 2}
                    </span>
                  )}
                </div>

                {/* MR 버튼 - 링크 유무에 따라 다르게 표시 */}
                <div className="mt-auto pt-1 pb-2">
                  <button
                    onClick={handlePlay}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg
                             text-light-accent dark:text-dark-accent
                             bg-light-accent/10 dark:bg-dark-accent/15
                             border border-light-accent/25 dark:border-dark-accent/30
                             hover:bg-gradient-to-r hover:from-light-accent hover:to-light-purple
                             dark:hover:from-dark-accent dark:hover:to-dark-purple
                             hover:text-white hover:border-transparent hover:shadow-md
                             transition-all duration-200"
                  >
                    {youtubeMR ? (
                      <>
                        <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                        <span>MR 열기</span>
                      </>
                    ) : (
                      <>
                        <MagnifyingGlassIcon className="w-4 h-4" />
                        <span>MR 검색</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Hover effect border */}
              <div
                className="absolute inset-0 rounded-xl border-2 border-transparent 
                              group-hover:border-light-accent/20 dark:group-hover:border-dark-accent/20 
                              transition-colors duration-300 pointer-events-none"
              ></div>
            </>
          )}
        </motion.div>
      )}


      {/* 플레이리스트 컨텍스트 메뉴 */}
      <PlaylistContextMenu
        songId={song.id}
        isOpen={showPlaylistMenu}
        position={menuPosition}
        onClose={() => setShowPlaylistMenu(false)}
      />

      {/* 새로운 SongDetailModal */}
      <SongDetailModal
        song={song}
        isExpanded={isExpanded}
        onClose={() => setIsExpanded(false)}
        isMobileScreen={typeof window !== 'undefined' ? window.innerWidth < 768 : false}
        songVideos={songVideos}
        setSongVideos={setSongVideos}
        videosLoading={videosLoading}
        loadSongVideos={loadSongVideos}
      />
    </>
  );
}
