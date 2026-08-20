"use client";

/**
 * 구간 전용 클립 플레이어.
 * 영상의 startTime~endTime 구간이 "전체 영상"인 것처럼 보이게 한다:
 * 진행바는 0 ~ (end−start), 시킹은 구간 내로 클램프, end 도달 시 정지.
 * 유튜브(IFrame API)와 치지직(HLS)을 동일한 컨트롤 UI로 재생한다.
 */

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import Hls from "hls.js";
import {
  PlayIcon,
  PauseIcon,
  ArrowPathIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  MusicalNoteIcon,
} from "@heroicons/react/24/solid";
import { CalendarDaysIcon, UserIcon } from "@heroicons/react/24/outline";
import type { VideoPlatform } from "@/shared/utils/video-url";
import { loadChzzkStream } from "./chzzk-stream-cache";
import { markClipCounted } from "./play-track-storage";
import type { Mp4Rendition } from "@/shared/utils/chzzk-vod";
import { loadStoredVolume, saveStoredVolume } from "./volume-storage";
import { useClipTitle } from "@/hooks/useClipTitle";
import { formatClipTime } from "@/shared/utils/clip-time";

interface ClipPlayerProps {
  platform: VideoPlatform;
  /** youtube: 11자 비디오 ID / chzzk: String(videoNo) */
  videoId: string;
  startTime: number;
  /** 없으면 영상 끝까지 */
  endTime?: number | null;
  autoplay?: boolean;
  /** 구간 재생이 끝났을 때 (연속 재생 등에 사용) */
  onEnded?: () => void;
  /** 검수용 확장 컨트롤: ±1s/±10s 이동, 끝-3s/끝-6s 바로가기 (관리자 화면용) */
  extendedControls?: boolean;
  className?: string;
  /**
   * 재생 전(포스터) 화면에 표시할 정보. 유튜브는 자체 썸네일·제목이 뜨므로
   * 검은 화면만 나오는 치지직(HLS) 클립에서만 사용한다.
   * 제목(다시보기 원본 제목)은 스트림 API 응답에서 자동으로 가져온다.
   */
  posterDate?: string;
  posterAddedBy?: string;
  /** 클립 썸네일(유튜브 자동추출 / 치지직 thumbnailImageUrl) — facade 배경 */
  posterThumbnail?: string;
  /** 클립 설명/메모 — facade에 제목처럼 표시 */
  posterDescription?: string;
  /** 설정 시, 최초 활성화(재생) 때 재생 수를 1 증가시킨다 (clipId = SongVideo._id) */
  trackPlayClipId?: string;
  /** 재생/일시정지 상태 변화 통지 (미니플레이어 컨트롤 동기화용) */
  onPlayingChange?: (playing: boolean) => void;
  /** 다음/이전 트랙 (제공 시 MediaSession 잠금화면 컨트롤에 연결) */
  onNext?: () => void;
  onPrev?: () => void;
  /**
   * MediaSession 메타데이터(잠금화면·알림·미디어키). 제공 시 이 클립이 활성화되면
   * OS 미디어 세션에 곡 정보를 싣고 재생/정지/이전/다음 액션을 연결한다.
   * 백그라운드 재생 컨트롤의 핵심 — 치지직(video)은 화면을 꺼도 오디오가 이어진다.
   */
  mediaMeta?: { title: string; artist?: string; album?: string; artwork?: string };
  /** 구간 종료가 임박(기본 12초 전)했을 때 1회 호출 — 다음 곡 프리로드/워밍용 */
  onNearEnd?: () => void;
  /** 자체 컨트롤 바·중앙버튼 숨김 (접힌 미니플레이어처럼 아주 작게 표시할 때) */
  hideChrome?: boolean;
}

/** onNearEnd를 발화할 잔여시간 임계값(초) */
const NEAR_END_SEC = 12;

/** HLS 화질 레벨 표시용 최소 정보 */
interface QualityLevel {
  height: number;
  bitrate: number;
}

/** 비트레이트가 가장 낮은(=데이터 최소) 레벨의 인덱스 (라디오 모드용) */
function lowestLevelIndex(levels: QualityLevel[]): number {
  let idx = 0;
  let min = Infinity;
  levels.forEach((l, i) => {
    if (l.bitrate < min) {
      min = l.bitrate;
      idx = i;
    }
  });
  return idx;
}

/** 저장된 화질 선호(height)에 가장 가까운 레벨 인덱스 (없으면 -1=자동) */
function nearestLevelIndex(levels: QualityLevel[], height: number): number {
  let best = -1;
  let bestDiff = Infinity;
  levels.forEach((l, i) => {
    const d = Math.abs(l.height - height);
    if (d < bestDiff) {
      bestDiff = d;
      best = i;
    }
  });
  return best;
}

// 화질/라디오 선호는 localStorage에 전역 저장 (음량과 동일 패턴)
const QUALITY_KEY = "clipPlayer.quality"; // 'auto' | height(number 문자열)
const RADIO_KEY = "clipPlayer.radio"; // '1' | '0'
function loadQualityPref(): "auto" | number {
  try {
    const v = localStorage.getItem(QUALITY_KEY);
    return v && v !== "auto" ? Number(v) : "auto";
  } catch {
    return "auto";
  }
}
function saveQualityPref(v: "auto" | number) {
  try {
    localStorage.setItem(QUALITY_KEY, v === "auto" ? "auto" : String(v));
  } catch {
    /* 무시 */
  }
}
function loadRadioPref(): boolean {
  try {
    return localStorage.getItem(RADIO_KEY) === "1";
  } catch {
    return false;
  }
}
function saveRadioPref(v: boolean) {
  try {
    localStorage.setItem(RADIO_KEY, v ? "1" : "0");
  } catch {
    /* 무시 */
  }
}

/** 미니플레이어 등 외부에서 재생을 제어하기 위한 명령형 핸들 */
export interface ClipPlayerHandle {
  play: () => void;
  pause: () => void;
  toggle: () => void;
  isPlaying: () => boolean;
}

/** 내부 플레이어 추상화: 두 플랫폼을 같은 인터페이스로 다룬다 */
interface PlayerAdapter {
  play: () => void;
  pause: () => void;
  seekTo: (seconds: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  setVolume: (v: number) => void; // 0~1
  setMuted: (muted: boolean) => void;
}

// window.YT / onYouTubeIframeAPIReady 전역 선언은 LiveClipEditor.tsx에 이미 존재

export function loadYouTubeApi(): Promise<void> {
  return new Promise((resolve) => {
    if (window.YT?.Player) return resolve();

    const existing = document.querySelector('script[src*="youtube.com/iframe_api"]');
    if (!existing) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    }

    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    // 이미 로드 완료된 경우 폴링으로 보강
    const poll = setInterval(() => {
      if (window.YT?.Player) {
        clearInterval(poll);
        resolve();
      }
    }, 100);
  });
}

const ClipPlayer = forwardRef<ClipPlayerHandle, ClipPlayerProps>(function ClipPlayer({
  platform,
  videoId,
  startTime,
  endTime,
  autoplay = false,
  onEnded,
  extendedControls = false,
  className = "",
  posterDate,
  posterAddedBy,
  posterThumbnail,
  posterDescription,
  trackPlayClipId,
  onPlayingChange,
  onNext,
  onPrev,
  mediaMeta,
  onNearEnd,
  hideChrome = false,
}: ClipPlayerProps, ref) {
  // endTime이 없거나 startTime 이하(잘못된 구간)면 "끝까지"로 취급한다.
  // (이 값이 0/음수가 되면 clipDuration이 0이 되어 진행바가 멈추거나, VOD 전체를
  //  분모로 잡아 게이지가 거의 안 움직이는 문제가 생긴다)
  const validEndTime =
    endTime != null && endTime > startTime ? endTime : null;

  const containerRef = useRef<HTMLDivElement>(null);
  const ytMountRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const adapterRef = useRef<PlayerAdapter | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const rafRef = useRef<number>(0);

  // 클릭(또는 autoplay) 전까지 스트림을 만들지 않는다(facade). 다이얼로그를 열어도
  // 영상 버퍼링 0 → 가볍고 즉각, 모바일 데이터 낭비 없음. 클릭 시 그때 플레이어 생성.
  const [activated, setActivated] = useState(autoplay);
  // facade에 보여줄 실제 영상 제목을 가볍게 lazy-load(스트림 없이). 받기 전엔 메모로 폴백.
  const lazyTitle = useClipTitle(platform, videoId, !activated);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  // 한 번이라도 재생되면 포스터(재생 전 화면)를 더 띄우지 않는다
  const [started, setStarted] = useState(false);
  // 치지직 다시보기 원본 제목 (스트림 API에서 받아 포스터에 표시)
  const [vodTitle, setVodTitle] = useState<string | null>(null);
  const [muted, setMuted] = useState(() => loadStoredVolume().muted);
  const [volume, setVolume] = useState(() => loadStoredVolume().volume);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // ── 화질(치지직 HLS) / 라디오 모드 ──
  // 화질 레벨(통합): HLS는 hls.levels, MP4(vod)는 화질별 렌디션을 같은 형태로 다룬다.
  const [hlsLevels, setHlsLevels] = useState<QualityLevel[]>([]);
  const [hlsLevel, setHlsLevel] = useState<number>(-1); // -1 = 자동(HLS) / MP4는 실제 인덱스
  const [qualityMode, setQualityMode] = useState<"hls" | "mp4" | "none">("none");
  const [showQuality, setShowQuality] = useState(false);
  const [radioMode, setRadioMode] = useState(false); // 하이드레이션 안전: 마운트 후 로드
  // 선호값을 스트림 로드 핸들러(effect 내)에서 최신값으로 읽기 위한 ref
  const qualityPrefRef = useRef<"auto" | number>("auto");
  const radioModeRef = useRef(false);
  radioModeRef.current = radioMode;
  const qualityModeRef = useRef<"hls" | "mp4" | "none">("none");
  qualityModeRef.current = qualityMode;
  const mp4RenditionsRef = useRef<Mp4Rendition[]>([]); // MP4 화질별 URL (hlsLevels와 인덱스 정렬)
  const [clipPosition, setClipPosition] = useState(0); // 구간 상대 시간
  const [clipDuration, setClipDuration] = useState(
    validEndTime != null ? Math.max(0, validEndTime - startTime) : 0,
  );
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // rAF 콜백에서 최신 상태를 읽기 위한 ref들
  const playingRef = useRef(false);
  const endedRef = useRef(false);
  // 진행바 부드럽게: getCurrentTime이 띄엄띄엄(예: 유튜브 IFrame은 ~1Hz로만) 갱신돼도
  // 마지막 신선한 샘플 시각을 기준으로 벽시계로 보간한다. {media:-1}이면 재동기화 필요.
  const syncRef = useRef({ media: -1, wall: 0 });
  const onEndedRef = useRef(onEnded);
  const onNearEndRef = useRef(onNearEnd);
  const nearEndFiredRef = useRef(false);
  // 재생 의도: 사용자가 재생을 원하는 상태인가. 백그라운드에서 브라우저가 강제로 일시정지시킨
  // 경우(사용자 의도 아님)를 사용자의 명시적 일시정지와 구분해 재생을 복원하기 위한 플래그.
  const playIntentRef = useRef(false);
  const lastResumeRef = useRef(0);
  playingRef.current = playing;
  onEndedRef.current = onEnded;
  onNearEndRef.current = onNearEnd;
  // 플레이어 초기화 시 저장된 음량을 적용하기 위한 최신 값 참조
  const volumeRef = useRef({ volume, muted });
  volumeRef.current = { volume, muted };

  const clipEnd = useCallback(
    () => (validEndTime != null ? validEndTime : startTime + clipDuration || Infinity),
    [validEndTime, startTime, clipDuration],
  );

  // 재생 수 집계 — "의미 있는 청취"에 도달했을 때 1회 (fire-and-forget).
  // 즉시 스킵은 세지 않고, 브라우저별 6시간 쿨다운으로 반복 재생 중복을 막는다.
  // 실제 발화는 진행 추적 tick 안에서 위치가 임계값을 넘을 때 이뤄진다.
  const playCountFiredRef = useRef(false);
  const trackClipRef = useRef(trackPlayClipId);
  trackClipRef.current = trackPlayClipId;

  // 화질/라디오 선호 로드 (하이드레이션 불일치 방지 위해 마운트 후)
  useEffect(() => {
    qualityPrefRef.current = loadQualityPref();
    setRadioMode(loadRadioPref());
  }, []);

  // 화질 인덱스 적용 (-1=자동). HLS는 hls.currentLevel, MP4는 화질별 URL로 src 교체(위치 유지).
  const applyQualityIndex = useCallback((idx: number) => {
    if (qualityModeRef.current === "hls") {
      const hls = hlsRef.current;
      if (hls) hls.currentLevel = idx; // -1 = 자동(ABR)
      setHlsLevel(idx);
      return;
    }
    if (qualityModeRef.current === "mp4") {
      const rends = mp4RenditionsRef.current;
      const realIdx = idx < 0 ? 0 : Math.min(idx, rends.length - 1); // MP4엔 자동 없음 → 최고화질
      const rend = rends[realIdx];
      const v = videoRef.current;
      if (rend && v && !v.src.startsWith(rend.url.split("?")[0])) {
        // 현재 위치·재생상태 보존하며 화질 URL 교체
        const t = v.currentTime;
        const wasPlaying = !v.paused && !v.ended;
        v.src = rend.url;
        const onMeta = () => {
          v.currentTime = t;
          if (wasPlaying) void v.play();
        };
        v.addEventListener("loadedmetadata", onMeta, { once: true });
      }
      setHlsLevel(realIdx);
    }
  }, []);

  // 레벨 준비 시 선호(라디오>저장화질>자동)를 적용
  const applyPreferredLevel = useCallback(
    (levels: QualityLevel[]) => {
      if (levels.length === 0) return;
      let idx: number;
      if (radioModeRef.current) idx = lowestLevelIndex(levels);
      else if (qualityPrefRef.current !== "auto") idx = nearestLevelIndex(levels, qualityPrefRef.current);
      else idx = -1;
      applyQualityIndex(idx);
    },
    [applyQualityIndex],
  );

  // 사용자가 화질 선택 (index 또는 'auto')
  const changeQuality = useCallback(
    (choice: number | "auto") => {
      const idx = choice === "auto" ? -1 : choice;
      applyQualityIndex(idx);
      const pref = choice === "auto" ? "auto" : hlsLevels[choice]?.height ?? "auto";
      qualityPrefRef.current = pref;
      saveQualityPref(pref);
      setShowQuality(false);
    },
    [hlsLevels, applyQualityIndex],
  );

  // 라디오 모드 토글 — 영상 UI 숨김 + 최저 화질로 데이터/디코드 최소화(HLS·MP4 공통)
  const toggleRadio = useCallback(() => {
    const next = !radioModeRef.current;
    setRadioMode(next);
    saveRadioPref(next);
    if (hlsLevels.length > 0) {
      const idx = next
        ? lowestLevelIndex(hlsLevels)
        : qualityPrefRef.current !== "auto"
          ? nearestLevelIndex(hlsLevels, qualityPrefRef.current)
          : -1;
      applyQualityIndex(idx);
    }
  }, [hlsLevels, applyQualityIndex]);

  // ── 플레이어 초기화 ──────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setError(null);
    setEnded(false);
    setStarted(false);
    setVodTitle(null);
    setClipPosition(0);
    setHlsLevels([]);
    setShowQuality(false);
    setQualityMode("none");
    mp4RenditionsRef.current = [];
    // startTime/endTime이 (편집 등으로) 바뀌면 구간 길이도 재계산한다.
    // endTime이 없으면 0으로 두고 onReady/onLoaded에서 영상 길이 기준으로 채운다.
    // (이 줄이 없으면 같은 클립을 편집해 시간만 바꿀 때 진행바·시간표시가 옛값으로 남음)
    setClipDuration(validEndTime != null ? Math.max(0, validEndTime - startTime) : 0);

    // facade: 활성화(클릭/autoplay) 전엔 플레이어를 만들지 않는다.
    if (!activated) return;

    if (platform === "youtube") {
      let player: any = null;
      let host: HTMLDivElement | null = null;
      loadYouTubeApi().then(() => {
        if (cancelled || !ytMountRef.current) return;

        // YouTube API는 전달된 노드를 <iframe>으로 "교체"한다. React가 만든 노드를
        // 직접 넘기면 React의 DOM 추적과 어긋나, 언마운트 시 React가 그 노드를
        // 제거하려다 'removeChild ... not a child' 에러가 난다.
        // → React가 소유하는 ytMountRef 컨테이너 안에, React가 모르는 별도 노드를
        //   직접 만들어 YouTube에 넘긴다. (컨테이너만 React가, 내부는 YouTube가 소유)
        host = document.createElement("div");
        host.style.width = "100%";
        host.style.height = "100%";
        ytMountRef.current.appendChild(host);

        player = new window.YT.Player(host, {
          videoId,
          playerVars: {
            controls: 0, // 네이티브 컨트롤 숨김 — 커스텀 컨트롤만 사용
            disablekb: 1,
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            start: Math.floor(startTime),
            ...(validEndTime != null ? { end: Math.ceil(validEndTime) } : {}),
            autoplay: 1, // 이 effect는 activated일 때만 도므로 항상 재생
          },
          events: {
            onReady: (e: any) => {
              if (cancelled) return;
              adapterRef.current = {
                play: () => e.target.playVideo(),
                pause: () => e.target.pauseVideo(),
                seekTo: (s) => e.target.seekTo(s, true),
                getCurrentTime: () => e.target.getCurrentTime?.() ?? 0,
                getDuration: () => e.target.getDuration?.() ?? 0,
                setVolume: (v) => e.target.setVolume(v * 100),
                setMuted: (m) => (m ? e.target.mute() : e.target.unMute()),
              };
              if (validEndTime == null) {
                const total = e.target.getDuration?.() ?? 0;
                if (total > 0) setClipDuration(Math.max(0, total - startTime));
              }
              // 저장된 음량 설정 적용 (영상 전환 시에도 유지)
              adapterRef.current.setVolume(volumeRef.current.volume);
              adapterRef.current.setMuted(volumeRef.current.muted);
              setReady(true);
            },
            onStateChange: (e: any) => {
              if (cancelled) return;
              const YT = window.YT;
              if (e.data === YT.PlayerState.PLAYING) {
                setPlaying(true);
                setEnded(false);
                setStarted(true);
              } else if (e.data === YT.PlayerState.PAUSED) {
                setPlaying(false);
              } else if (e.data === YT.PlayerState.ENDED) {
                setPlaying(false);
                setEnded(true);
                if (!endedRef.current) {
                  endedRef.current = true;
                  onEndedRef.current?.();
                }
              }
            },
            onError: () => {
              if (!cancelled) setError("영상을 재생할 수 없습니다.");
            },
          },
        });
      });

      return () => {
        cancelled = true;
        adapterRef.current = null;
        try {
          player?.destroy?.();
        } catch {
          /* iframe 이미 제거된 경우 무시 */
        }
        // 혹시 남은 노드는 직접 정리 (React 가상DOM 밖이라 안전)
        try {
          host?.remove();
        } catch {
          /* 이미 제거됨 */
        }
      };
    }

    // ── chzzk: HLS ──
    const videoNo = videoId;
    const video = videoRef.current;
    if (!video) return;

    const setupAdapter = () => {
      adapterRef.current = {
        play: () => void video.play(),
        pause: () => video.pause(),
        seekTo: (s) => {
          video.currentTime = s;
        },
        getCurrentTime: () => video.currentTime,
        getDuration: () => video.duration || 0,
        setVolume: (v) => {
          video.volume = v;
        },
        setMuted: (m) => {
          video.muted = m;
        },
      };
    };

    const onLoaded = () => {
      if (cancelled) return;
      setupAdapter();
      video.currentTime = startTime;
      if (validEndTime == null && video.duration) {
        setClipDuration(Math.max(0, video.duration - startTime));
      }
      // 저장된 음량 설정 적용 (영상 전환 시에도 유지)
      video.volume = volumeRef.current.volume;
      video.muted = volumeRef.current.muted;
      setReady(true);
      void video.play(); // activated일 때만 도는 effect → 항상 재생
    };

    // 캐시 우선 로더 사용 — 다음 곡 prefetch가 채운 스트림 정보를 재사용해 전환 지연을 줄인다.
    loadChzzkStream(videoNo)
      .then(({ streamUrl, streamType, videoTitle, mp4Url: resolvedMp4, renditions }) => {
        if (cancelled) return;
        if (videoTitle) setVodTitle(videoTitle);

        // 영구 보존 VOD: vodplay 토큰이 호출 IP에 묶이므로 브라우저가 직접 MP4 URL을 받는다.
        // (loadChzzkStream이 vod의 화질별 렌디션을 미리 해석해둔다)
        const mp4Url: string | null = streamType === 'mp4' ? streamUrl : resolvedMp4 ?? null;
        if (streamType === 'vod' && !mp4Url) {
          setError("재생할 수 있는 영상이 아닙니다.");
          return;
        }

        // progressive MP4 — 네이티브 재생 (Range 시킹 지원). vod면 화질별 렌디션 노출.
        if (mp4Url) {
          const rends = renditions ?? [];
          let srcUrl = mp4Url;
          if (rends.length > 1) {
            mp4RenditionsRef.current = rends;
            const levels = rends.map((r) => ({ height: r.height, bitrate: r.bandwidth }));
            setHlsLevels(levels);
            setQualityMode("mp4");
            qualityModeRef.current = "mp4";
            // 선호 화질로 시작 URL 결정 (라디오>저장화질>최고). 처음부터 해당 화질로 로드해 재교체 회피.
            let idx = 0;
            if (radioModeRef.current) idx = lowestLevelIndex(levels);
            else if (qualityPrefRef.current !== "auto") idx = nearestLevelIndex(levels, qualityPrefRef.current);
            setHlsLevel(idx);
            srcUrl = rends[idx].url;
          }
          video.src = srcUrl;
          video.addEventListener("loadedmetadata", onLoaded, { once: true });
          return;
        }

        if (Hls.isSupported()) {
          const hls = new Hls({ enableWorker: true, lowLatencyMode: false });
          hls.loadSource(streamUrl);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            onLoaded();
            // 화질 레벨 노출 + 선호(라디오/저장화질/자동) 적용
            const levels = hls.levels.map((l) => ({ height: l.height, bitrate: l.bitrate }));
            setHlsLevels(levels);
            setQualityMode("hls");
            qualityModeRef.current = "hls";
            applyPreferredLevel(levels);
          });
          hls.on(Hls.Events.ERROR, (_e, data) => {
            if (!data.fatal) return;
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
            else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
            else setError("재생 중 오류가 발생했습니다.");
          });
          hlsRef.current = hls;
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = streamUrl;
          video.addEventListener("loadedmetadata", onLoaded, { once: true });
        } else {
          setError("이 브라우저는 HLS 재생을 지원하지 않습니다.");
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "영상을 로드할 수 없습니다.");
      });

    const onPlay = () => {
      setPlaying(true);
      setEnded(false);
      setStarted(true);
      playIntentRef.current = true; // 재생 중 = 재생 의도 있음
    };
    const onPause = () => {
      setPlaying(false);
      // 백그라운드(화면 꺼짐/앱 최소화)에서 브라우저가 강제로 일시정지시킨 경우 재생 복원.
      // 사용자가 명시적으로 정지한 경우엔 playIntentRef가 false라 복원하지 않는다.
      // 폭주 방지로 최소 1초 간격으로만 재시도.
      if (
        playIntentRef.current &&
        typeof document !== "undefined" &&
        document.hidden &&
        !video.ended &&
        Date.now() - lastResumeRef.current > 1000
      ) {
        lastResumeRef.current = Date.now();
        void video.play().catch(() => {});
      }
    };
    const onVideoEnded = () => {
      setPlaying(false);
      setEnded(true);
      if (!endedRef.current) {
        endedRef.current = true;
        onEndedRef.current?.();
      }
    };
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onVideoEnded);

    return () => {
      cancelled = true;
      adapterRef.current = null;
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onVideoEnded);
      hlsRef.current?.destroy();
      hlsRef.current = null;
      mp4RenditionsRef.current = [];
      // 미디어 리소스/디코더를 즉시 해제 (곡 전환 시 이전 버퍼가 남아 새 곡과 경쟁하지 않도록)
      try {
        video.pause();
        video.removeAttribute("src");
        video.load();
      } catch {
        /* 이미 제거됨 */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platform, videoId, startTime, endTime, activated]);

  // ── 구간 경계 강제 + 진행 추적 ──────────────────────────────────
  // rAF로 포그라운드에선 60fps 부드럽게 그리되, rAF는 탭이 백그라운드면 완전히
  // 멈추므로(오디오는 계속 재생 → 게이지만 수십 초 얼어붙음) 1Hz setInterval로 보강한다.
  useEffect(() => {
    if (!ready) return;
    nearEndFiredRef.current = false; // 새 구간(클립)마다 프리로드 트리거 재무장
    playCountFiredRef.current = false; // 새 구간마다 재생 수 집계 재무장

    const runTick = () => {
      const adapter = adapterRef.current;
      if (adapter) {
        const abs = adapter.getCurrentTime(); // 시간 소스의 실제값(띄엄띄엄일 수 있음)
        const end = clipEnd();
        const now =
          typeof performance !== "undefined" ? performance.now() : Date.now();

        // 경계 강제는 재생 중에만 — 일시정지/대기(cued) 상태에서 seekTo하면
        // YouTube가 의도치 않게 재생을 시작할 수 있다
        if (playingRef.current) {
          if (abs < startTime - 1) {
            // 구간 앞으로 벗어남 (외부 시킹 등) → 시작점 복귀
            adapter.seekTo(startTime);
            syncRef.current = { media: -1, wall: 0 };
          } else if (end !== Infinity && abs >= end) {
            // 구간 종료로 인한 정지 → 다음 곡으로 넘어갈 것이므로 이 클립을 복원하지 않음
            playIntentRef.current = false;
            adapter.pause();
            adapter.seekTo(end);
            setClipPosition(Math.max(0, end - startTime));
            setEnded(true);
            syncRef.current = { media: -1, wall: 0 };
            if (!endedRef.current) {
              endedRef.current = true;
              onEndedRef.current?.();
            }
          } else {
            endedRef.current = false;
            // 실제값이 바뀌면 재동기화, 안 바뀌면(소스가 아직 같은 값을 줌) 벽시계로 보간.
            // 보간이 실제를 너무 앞서거나 end를 넘지 않도록 클램프한다.
            let absDisplay = abs;
            const sync = syncRef.current;
            if (abs !== sync.media) {
              syncRef.current = { media: abs, wall: now };
            } else {
              absDisplay = abs + (now - sync.wall) / 1000;
            }
            const capped = end !== Infinity ? Math.min(absDisplay, end) : absDisplay;
            const pos = Math.max(0, capped - startTime);
            setClipPosition(pos);
            // 재생 수 집계 — 의미 있는 청취(≥ min(30s, 구간의 40%))에 도달 시 1회.
            // 쿨다운은 markClipCounted가 판단(브라우저별 6시간). 즉시 스킵은 미집계.
            if (!playCountFiredRef.current && trackClipRef.current) {
              const len = end !== Infinity ? end - startTime : Infinity;
              const threshold = Math.min(30, len === Infinity ? 30 : len * 0.4);
              if (pos >= threshold) {
                playCountFiredRef.current = true;
                const id = trackClipRef.current;
                if (markClipCounted(id)) {
                  fetch(`/api/clips/${id}/play`, { method: 'POST' }).catch(() => {});
                }
              }
            }
            // 종료 임박 → 다음 곡 프리로드 트리거 (1회)
            if (end !== Infinity && !nearEndFiredRef.current && end - abs <= NEAR_END_SEC) {
              nearEndFiredRef.current = true;
              onNearEndRef.current?.();
            }
          }
        } else if (abs >= startTime) {
          syncRef.current = { media: -1, wall: 0 };
          setClipPosition(Math.max(0, Math.min(abs, end) - startTime));
        }
      }
    };

    // 포그라운드: rAF로 매 프레임 갱신(부드러움)
    const raf = () => {
      runTick();
      rafRef.current = requestAnimationFrame(raf);
    };
    rafRef.current = requestAnimationFrame(raf);
    // 백그라운드: rAF가 멈춰도 최소 1초마다 갱신(오디오 재생 중인 탭은 ~1Hz로 유지됨)
    const interval = setInterval(runTick, 1000);

    return () => {
      cancelAnimationFrame(rafRef.current);
      clearInterval(interval);
    };
  }, [ready, startTime, clipEnd]);

  // ── 전체화면 상태 추적 ──────────────────────────────────────────
  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  // ── 컨트롤 자동 숨김 ────────────────────────────────────────────
  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setControlsVisible(false), 2500);
  }, []);

  useEffect(() => {
    showControls();
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [showControls]);

  // ── 사용자 조작 ──────────────────────────────────────────────────
  const togglePlay = () => {
    const adapter = adapterRef.current;
    if (!adapter) return;
    if (ended) {
      adapter.seekTo(startTime);
      setEnded(false);
      endedRef.current = false;
      adapter.play();
    } else if (playing) {
      playIntentRef.current = false; // 사용자 명시적 정지 → 백그라운드 복원 안 함
      adapter.pause();
    } else {
      playIntentRef.current = true;
      adapter.play();
    }
  };

  // 외부(미니플레이어/플레이어 페이지)에서 재생 제어할 수 있도록 명령형 핸들 노출.
  // 아직 활성화(facade) 전이면 play() 시 스트림을 만들어 재생을 시작한다.
  useImperativeHandle(ref, () => ({
    play: () => {
      if (!activated) { setActivated(true); return; }
      playIntentRef.current = true;
      adapterRef.current?.play();
    },
    pause: () => {
      playIntentRef.current = false; // 외부 명시적 정지 → 백그라운드 복원 안 함
      adapterRef.current?.pause();
    },
    toggle: () => {
      if (!activated) { setActivated(true); return; }
      togglePlay();
    },
    isPlaying: () => playingRef.current,
  }));

  // 재생상태 변화 통지
  const onPlayingChangeRef = useRef(onPlayingChange);
  onPlayingChangeRef.current = onPlayingChange;
  useEffect(() => {
    onPlayingChangeRef.current?.(playing);
  }, [playing]);

  // ── MediaSession: 잠금화면/알림/미디어키 + 백그라운드 컨트롤 ──────
  // 메타데이터·액션 핸들러를 등록한다. 치지직(video)은 화면을 꺼도 오디오가 이어지고,
  // 유튜브(iframe)는 포그라운드 컨트롤까지만 동작(플랫폼 제약).
  const navHandlersRef = useRef({ onNext, onPrev });
  navHandlersRef.current = { onNext, onPrev };
  // 잠금화면 시킹 핸들러가 최신 seek 함수를 참조하도록 (아래에서 정의 후 매 렌더 주입)
  const seekApiRef = useRef<{ toPos: (rel: number) => void; rel: (d: number) => void }>({
    toPos: () => {},
    rel: () => {},
  });
  useEffect(() => {
    if (!activated || !mediaMeta) return;
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;

    try {
      ms.metadata = new MediaMetadata({
        title: mediaMeta.title,
        artist: mediaMeta.artist || "",
        album: mediaMeta.album || "아야 AyaUke",
        ...(mediaMeta.artwork
          ? { artwork: [{ src: mediaMeta.artwork, sizes: "512x512", type: "image/jpeg" }] }
          : {}),
      });
    } catch {
      /* 일부 브라우저는 MediaMetadata 미지원 */
    }

    const setAction = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      try {
        ms.setActionHandler(action, handler);
      } catch {
        /* 미지원 액션 무시 */
      }
    };
    setAction("play", () => { playIntentRef.current = true; adapterRef.current?.play(); });
    setAction("pause", () => { playIntentRef.current = false; adapterRef.current?.pause(); });
    setAction("previoustrack", navHandlersRef.current.onPrev ? () => navHandlersRef.current.onPrev?.() : null);
    setAction("nexttrack", navHandlersRef.current.onNext ? () => navHandlersRef.current.onNext?.() : null);
    // 잠금화면 시킹 — positionState를 구간 기준으로 싣기 때문에 seekTime도 구간 상대값이다.
    setAction("seekto", (d) => { if (typeof d.seekTime === "number") seekApiRef.current.toPos(d.seekTime); });
    setAction("seekbackward", (d) => seekApiRef.current.rel(-(d.seekOffset || 10)));
    setAction("seekforward", (d) => seekApiRef.current.rel(d.seekOffset || 10));

    return () => {
      (["play", "pause", "previoustrack", "nexttrack", "seekto", "seekbackward", "seekforward"] as MediaSessionAction[]).forEach((a) =>
        setAction(a, null),
      );
    };
  }, [activated, mediaMeta, onNext, onPrev]);

  // 잠금화면/알림의 진행바를 "다시보기 전체"가 아닌 "클립 구간" 기준으로 표시.
  // setPositionState에 구간 길이/상대 위치를 실어 브라우저 기본(엘리먼트 전체시간)을 덮어쓴다.
  // ~1초 단위로만 갱신(정수 초가 바뀔 때)해 과도한 호출을 피한다.
  const posSec = Math.floor(clipPosition);
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    if (!activated || !mediaMeta) return;
    const ms = navigator.mediaSession;
    if (typeof ms.setPositionState !== "function") return;
    try {
      if (clipDuration > 0 && isFinite(clipDuration)) {
        ms.setPositionState({
          duration: clipDuration,
          position: Math.min(Math.max(0, clipPosition), clipDuration),
          playbackRate: 1,
        });
      } else {
        ms.setPositionState(); // 길이 미상 → 초기화
      }
    } catch {
      /* 무시 */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posSec, clipDuration, activated, mediaMeta, playing]);

  // 재생상태를 OS 미디어 세션에 반영 (잠금화면 재생/정지 표시)
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    if (!activated || !mediaMeta) return;
    try {
      navigator.mediaSession.playbackState = playing ? "playing" : "paused";
    } catch {
      /* 무시 */
    }
  }, [playing, activated, mediaMeta]);

  // 포그라운드 복귀 시 재생 복원 — 백그라운드에서 브라우저가 강제로 멈춘 경우, 앱으로 돌아오면
  // 사용자가 상태바에서 재생을 누르지 않아도 자동 재개(재생 의도가 남아있을 때만).
  useEffect(() => {
    if (platform !== "chzzk") return;
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      if (!playIntentRef.current) return;
      const v = videoRef.current;
      if (v && v.paused && !v.ended) void v.play().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [platform]);

  /** 구간 내 상대 위치로 시킹 (클램프 + ended 해제 공통 처리) */
  const seekToClipPosition = (rel: number) => {
    const adapter = adapterRef.current;
    if (!adapter) return;
    const clamped = Math.min(Math.max(0, rel), clipDuration || 0);
    adapter.seekTo(startTime + clamped);
    setClipPosition(clamped);
    setEnded(false);
    endedRef.current = false;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    seekToClipPosition(Number(e.target.value));
  };

  /** 현재 위치에서 delta초 이동 */
  const seekRelative = (delta: number) => seekToClipPosition(clipPosition + delta);
  // 잠금화면 시킹 액션이 최신 seek 함수를 쓰도록 매 렌더 주입
  seekApiRef.current = { toPos: seekToClipPosition, rel: seekRelative };

  /** 구간 끝에서 offset초 앞 지점으로 이동 (마지막 부분 확인용) */
  const seekFromEnd = (offset: number) => {
    if (clipDuration > 0) seekToClipPosition(clipDuration - offset);
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    adapterRef.current?.setMuted(next);
    saveStoredVolume({ volume, muted: next });
  };

  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    setVolume(v);
    adapterRef.current?.setVolume(v);
    let nextMuted = muted;
    if (v > 0 && muted) {
      nextMuted = false;
      setMuted(false);
      adapterRef.current?.setMuted(false);
    }
    saveStoredVolume({ volume: v, muted: nextMuted });
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void containerRef.current.requestFullscreen();
    }
  };

  // ── 렌더 ─────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className={`relative aspect-video bg-gray-900/60 rounded-xl overflow-hidden flex items-center justify-center border border-light-primary/20 dark:border-dark-primary/20 ${className}`}>
        <div className="text-center px-6">
          <p className="text-white/70 font-medium">클립을 재생할 수 없습니다</p>
          <p className="text-white/40 text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  const progressPercent = clipDuration > 0 ? (clipPosition / clipDuration) * 100 : 0;

  const seekChipClass =
    "px-1.5 py-0.5 rounded text-[11px] font-mono bg-white/15 hover:bg-white/30 " +
    "disabled:opacity-40 disabled:cursor-not-allowed transition-colors";

  return (
    <div
      ref={containerRef}
      className={`relative aspect-video bg-black rounded-xl overflow-hidden group ${className}`}
      onMouseMove={showControls}
      onTouchStart={showControls}
    >
      {/* 영상 영역 — 네이티브 UI 없이 렌더.
          ytMountRef는 React가 소유하는 빈 컨테이너. 내부 host 노드(YouTube가 iframe으로
          교체)는 React 가상DOM 밖이라 자식으로 추적되지 않는다 → 언마운트 충돌 없음. */}
      {platform === "youtube" ? (
        <div
          ref={ytMountRef}
          className="absolute inset-0 [&>div]:w-full [&>div]:h-full [&>iframe]:w-full [&>iframe]:h-full"
        />
      ) : (
        <video ref={videoRef} className="absolute inset-0 w-full h-full" playsInline />
      )}

      {/* facade: 활성화 전 — 포스터(유튜브 썸네일 / 치지직 정보) + 재생버튼.
          클릭해야 스트림을 로드한다(다이얼로그는 가볍게 열림, 데이터 낭비 없음). */}
      {!activated && (
        <button
          type="button"
          aria-label="재생"
          onClick={() => setActivated(true)}
          className="absolute inset-0 w-full h-full cursor-pointer group/facade"
        >
          {/* 썸네일 배경: 메타데이터 thumbnailUrl(양 플랫폼) 우선, 없으면 유튜브 ytimg 폴백 */}
          {(posterThumbnail || platform === "youtube") && (
            <img
              src={posterThumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
              decoding="async"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/20 to-black/65" />
          {/* 정보: (치지직)배지·날짜·업로더 + 제목(lazy-load, 받기 전엔 메모) — 양 플랫폼 공통 */}
          {(posterDate || posterAddedBy || posterDescription || lazyTitle) && (
            <div className="absolute top-0 left-0 right-0 px-3 pt-2.5 sm:px-4 sm:pt-3 text-left">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                {platform === "chzzk" && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#00FFA3]/20 border border-[#00FFA3]/40 text-[#00FFA3] text-[11px] font-semibold tracking-wide">
                    치지직 다시보기
                  </span>
                )}
                {posterDate && (
                  <span className="inline-flex items-center gap-1 text-white/80 text-xs">
                    <CalendarDaysIcon className="w-3.5 h-3.5" />
                    {posterDate}
                  </span>
                )}
                {posterAddedBy && (
                  <span className="inline-flex items-center gap-1 text-white/60 text-xs">
                    <UserIcon className="w-3.5 h-3.5" />
                    {posterAddedBy}
                  </span>
                )}
              </div>
              {(lazyTitle || posterDescription) && (
                <h4 className="text-white font-semibold text-sm sm:text-base leading-snug line-clamp-2 drop-shadow-md">
                  {lazyTitle || posterDescription}
                </h4>
              )}
            </div>
          )}
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="w-16 h-16 rounded-full bg-gradient-to-br from-light-accent to-light-purple dark:from-dark-accent dark:to-dark-purple flex items-center justify-center shadow-lg shadow-black/40 transition-transform duration-200 group-hover/facade:scale-110">
              <PlayIcon className="w-8 h-8 text-white translate-x-0.5" />
            </span>
          </span>
        </button>
      )}

      {/* 클릭으로 재생/일시정지 (활성화 후, 컨트롤 바 제외 영역) */}
      {activated && (
        <button
          type="button"
          aria-label={playing ? "일시정지" : "재생"}
          onClick={togglePlay}
          className="absolute inset-0 w-full h-full cursor-pointer"
        />
      )}

      {/* 라디오 모드 오버레이 (치지직) — 영상을 가리고 음성 중심 표시. 클릭은 통과. */}
      {activated && radioMode && platform === "chzzk" && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {posterThumbnail && (
            <img
              src={posterThumbnail}
              alt=""
              className="absolute inset-0 w-full h-full object-cover scale-110 opacity-30 blur-xl"
              decoding="async"
            />
          )}
          <div className="absolute inset-0 bg-black/70" />
          {!hideChrome && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-white/80">
              <MusicalNoteIcon className="w-9 h-9" />
              <span className="text-xs font-medium tracking-wide">라디오 모드 · 음성 중심</span>
            </div>
          )}
        </div>
      )}

      {/* 재생 전 포스터 (치지직 전용 — 유튜브는 자체 썸네일·제목이 표시됨).
          스트림 로드 중 검은 화면 대신 썸네일을 유지해 facade와 연속성을 준다. */}
      {activated && platform === "chzzk" && !started && (vodTitle || posterDate) && (
        <div className="absolute inset-0 pointer-events-none">
          {posterThumbnail && (
            <img
              src={posterThumbnail}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              decoding="async"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/30 to-black/75" />
          <div className="absolute top-0 left-0 right-0 px-3 pt-2.5 pb-4 sm:px-4 sm:pt-3">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#00FFA3]/20 border border-[#00FFA3]/40 text-[#00FFA3] text-[11px] font-semibold tracking-wide">
                치지직 다시보기
              </span>
              {posterDate && (
                <span className="inline-flex items-center gap-1 text-white/75 text-xs">
                  <CalendarDaysIcon className="w-3.5 h-3.5" />
                  {posterDate}
                </span>
              )}
              {posterAddedBy && (
                <span className="inline-flex items-center gap-1 text-white/55 text-xs">
                  <UserIcon className="w-3.5 h-3.5" />
                  {posterAddedBy}
                </span>
              )}
            </div>
            {vodTitle && (
              <h4 className="text-white font-semibold text-sm sm:text-base md:text-lg leading-snug line-clamp-2 drop-shadow-md">
                {vodTitle}
              </h4>
            )}
          </div>
        </div>
      )}

      {/* 로딩 오버레이 (활성화 후 스트림 로드 중) */}
      {activated && !ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 pointer-events-none">
          <div className="w-10 h-10 border-2 border-white/20 border-t-light-accent dark:border-t-dark-accent rounded-full animate-spin" />
        </div>
      )}

      {/* 중앙 재생/다시보기 버튼 (정지 상태) */}
      {!hideChrome && ready && (!playing || ended) && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-light-accent to-light-purple dark:from-dark-accent dark:to-dark-purple flex items-center justify-center shadow-lg shadow-black/40">
            {ended ? (
              <ArrowPathIcon className="w-8 h-8 text-white" />
            ) : (
              <PlayIcon className="w-8 h-8 text-white translate-x-0.5" />
            )}
          </div>
        </div>
      )}

      {/* 커스텀 컨트롤 바 (활성화 후에만 노출. hideChrome이면 접힌 미니바용으로 숨김) */}
      <div
        className={`absolute bottom-0 left-0 right-0 px-3 pb-2 pt-8 bg-gradient-to-t from-black/80 to-transparent transition-opacity duration-300 ${
          hideChrome || !activated
            ? "opacity-0 pointer-events-none"
            : controlsVisible || !playing
            ? "opacity-100"
            : "opacity-0"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 구간 상대 진행바 */}
        <div className="relative h-4 flex items-center mb-1 group/bar">
          <div className="absolute inset-x-0 h-1 rounded-full bg-white/25 group-hover/bar:h-1.5 transition-all" />
          <div
            className="absolute left-0 h-1 rounded-full bg-gradient-to-r from-light-accent to-light-purple dark:from-dark-accent dark:to-dark-purple group-hover/bar:h-1.5"
            style={{ width: `${progressPercent}%` }}
          />
          <input
            type="range"
            min={0}
            max={clipDuration || 0}
            step={0.1}
            value={clipPosition}
            onChange={handleSeek}
            aria-label="재생 위치"
            className="absolute inset-x-0 w-full h-4 opacity-0 cursor-pointer"
            disabled={!ready || clipDuration === 0}
          />
        </div>

        <div className="flex items-center gap-3 text-white">
          <button type="button" onClick={togglePlay} aria-label={playing ? "일시정지" : "재생"} className="hover:text-light-accent dark:hover:text-dark-accent transition-colors">
            {ended ? (
              <ArrowPathIcon className="w-5 h-5" />
            ) : playing ? (
              <PauseIcon className="w-5 h-5" />
            ) : (
              <PlayIcon className="w-5 h-5" />
            )}
          </button>

          {/* 검수용 이동 컨트롤 */}
          {extendedControls && (
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => seekRelative(-10)} disabled={!ready} className={seekChipClass} title="10초 뒤로">
                -10s
              </button>
              <button type="button" onClick={() => seekRelative(-1)} disabled={!ready} className={seekChipClass} title="1초 뒤로">
                -1s
              </button>
              <button type="button" onClick={() => seekRelative(1)} disabled={!ready} className={seekChipClass} title="1초 앞으로">
                +1s
              </button>
              <button type="button" onClick={() => seekRelative(10)} disabled={!ready} className={seekChipClass} title="10초 앞으로">
                +10s
              </button>
            </div>
          )}

          {/* 구간 상대 시간: 클립이 전체 영상인 것처럼 표시 */}
          <span className="text-xs font-mono tabular-nums">
            {formatClipTime(clipPosition)} / {formatClipTime(clipDuration)}
          </span>

          <div className="flex-1" />

          {/* 끝부분 확인 바로가기 */}
          {extendedControls && clipDuration > 0 && (
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => seekFromEnd(6)} disabled={!ready} className={`${seekChipClass} !text-purple-200`} title="구간 끝 6초 전으로 이동 (끝부분 확인)">
                끝-6s
              </button>
              <button type="button" onClick={() => seekFromEnd(3)} disabled={!ready} className={`${seekChipClass} !text-purple-200`} title="구간 끝 3초 전으로 이동 (끝부분 확인)">
                끝-3s
              </button>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <button type="button" onClick={toggleMute} aria-label={muted ? "음소거 해제" : "음소거"} className="hover:text-light-accent dark:hover:text-dark-accent transition-colors">
              {muted || volume === 0 ? (
                <SpeakerXMarkIcon className="w-5 h-5" />
              ) : (
                <SpeakerWaveIcon className="w-5 h-5" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={handleVolume}
              aria-label="음량"
              className="w-16 h-1 accent-light-accent dark:accent-dark-accent cursor-pointer hidden sm:block"
            />
          </div>

          {/* 화질 (치지직 HLS 전용) */}
          {platform === "chzzk" && hlsLevels.length > 1 && !radioMode && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowQuality((v) => !v)}
                aria-label="화질 선택"
                title="화질"
                className="px-1.5 py-0.5 rounded text-xs font-semibold tabular-nums hover:text-light-accent dark:hover:text-dark-accent transition-colors"
              >
                {hlsLevel === -1 ? "자동" : `${hlsLevels[hlsLevel]?.height}p`}
              </button>
              {showQuality && (
                <div className="absolute bottom-full right-0 mb-2 min-w-[92px] max-h-48 overflow-y-auto rounded-lg bg-black/90 py-1 shadow-lg">
                  {/* '자동'(ABR)은 HLS에서만 의미 있음. MP4는 화질별 URL 교체라 자동 없음 */}
                  {qualityMode === "hls" && (
                    <button
                      onClick={() => changeQuality("auto")}
                      className={`block w-full px-3 py-1.5 text-left text-xs hover:bg-white/10 ${hlsLevel === -1 ? "text-light-accent dark:text-dark-accent font-semibold" : "text-white/80"}`}
                    >
                      자동
                    </button>
                  )}
                  {hlsLevels.map((l, i) => (
                    <button
                      key={i}
                      onClick={() => changeQuality(i)}
                      className={`block w-full px-3 py-1.5 text-left text-xs hover:bg-white/10 ${hlsLevel === i ? "text-light-accent dark:text-dark-accent font-semibold" : "text-white/80"}`}
                    >
                      {l.height}p
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 라디오 모드 토글 (치지직 전용 — 영상 숨김 + 최저 화질로 데이터 절약) */}
          {platform === "chzzk" && (
            <button
              type="button"
              onClick={toggleRadio}
              aria-pressed={radioMode}
              aria-label={radioMode ? "라디오 모드 끄기" : "라디오 모드 켜기"}
              title={radioMode ? "라디오 모드 끄기 (영상 표시)" : "라디오 모드 (영상 숨김·데이터 절약)"}
              className={`transition-colors ${radioMode ? "text-light-accent dark:text-dark-accent" : "hover:text-light-accent dark:hover:text-dark-accent"}`}
            >
              <MusicalNoteIcon className="w-5 h-5" />
            </button>
          )}

          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "전체화면 종료" : "전체화면"}
            className="hover:text-light-accent dark:hover:text-dark-accent transition-colors"
          >
            {isFullscreen ? (
              <ArrowsPointingInIcon className="w-5 h-5" />
            ) : (
              <ArrowsPointingOutIcon className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
});

export default ClipPlayer;
