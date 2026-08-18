import Hls from 'hls.js';
import { loadChzzkStream } from './chzzk-stream-cache';

/**
 * 치지직(네이티브 video) 미디어 준비·프리버퍼 모듈.
 *
 * 치지직 클립의 미디어 생명주기(스트림 해석 → <video> 생성 → HLS/MP4 부착 → startTime seek
 * → 버퍼)를 한곳에 캡슐화한다. 라이브 재생(ClipPlayer)과 다음곡 프리버퍼가 **같은 준비 경로**
 * (prepareChzzkMedia)를 공유하고, 준비된 요소를 그대로 넘겨받아 재생하므로 전환이 매끄럽다.
 * (유튜브는 iframe이라 이 방식이 불가능 — 치지직 전용)
 */

export interface PreparedChzzkMedia {
  video: HTMLVideoElement;
  hls: Hls | null; // HLS면 인스턴스(넘겨받은 쪽이 소유·정리)
  videoTitle?: string;
}

/** startTime 이후 이만큼(초) 버퍼되면 "재생 준비됨"으로 간주 */
const PREBUFFER_LEAD_SEC = 6;
const LOAD_TIMEOUT_MS = 15_000;
const BUFFER_TIMEOUT_MS = 8_000;

function waitEvent(target: HTMLVideoElement, ev: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const to = setTimeout(() => {
      target.removeEventListener(ev, onEv);
      reject(new Error(`${ev} 타임아웃`));
    }, timeoutMs);
    const onEv = () => {
      clearTimeout(to);
      target.removeEventListener(ev, onEv);
      resolve();
    };
    target.addEventListener(ev, onEv, { once: true });
  });
}

function isBuffered(video: HTMLVideoElement, from: number, lead: number): boolean {
  const b = video.buffered;
  for (let i = 0; i < b.length; i++) {
    if (b.start(i) <= from + 0.5 && b.end(i) >= from + lead) return true;
  }
  return false;
}

/** startTime 주변이 lead초 이상 버퍼될 때까지 대기 (타임아웃 시 그냥 진행) */
function waitBuffered(video: HTMLVideoElement, from: number, lead: number, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    if (isBuffered(video, from, lead)) return resolve();
    const finish = () => {
      clearTimeout(to);
      video.removeEventListener('progress', onProgress);
      video.removeEventListener('canplaythrough', onProgress);
      resolve();
    };
    const onProgress = () => {
      if (isBuffered(video, from, lead)) finish();
    };
    const to = setTimeout(finish, timeoutMs);
    video.addEventListener('progress', onProgress);
    video.addEventListener('canplaythrough', onProgress);
  });
}

/**
 * 치지직 클립 재생 준비: <video> 생성 → 소스 부착 → startTime seek → 어느 정도 버퍼.
 * 반환된 요소는 컨테이너에 append 후 play()만 하면 startTime부터 바로 이어진다.
 */
export async function prepareChzzkMedia(
  videoNo: string,
  startTime: number,
  opts?: { muted?: boolean; waitBuffer?: boolean },
): Promise<PreparedChzzkMedia> {
  const stream = await loadChzzkStream(videoNo);

  const video = document.createElement('video');
  video.playsInline = true;
  video.preload = 'auto';
  video.muted = opts?.muted ?? false;

  const mp4 = stream.streamType === 'mp4' ? stream.streamUrl : stream.mp4Url ?? null;
  let hls: Hls | null = null;

  if (stream.streamType === 'vod' && !mp4) throw new Error('재생할 수 있는 영상이 아닙니다.');

  if (mp4) {
    video.src = mp4;
    await waitEvent(video, 'loadedmetadata', LOAD_TIMEOUT_MS);
  } else if (Hls.isSupported()) {
    const inst = new Hls({ enableWorker: true, lowLatencyMode: false });
    hls = inst;
    inst.loadSource(stream.streamUrl);
    inst.attachMedia(video);
    await new Promise<void>((resolve, reject) => {
      const onParsed = () => {
        cleanup();
        resolve();
      };
      const onErr = (_e: unknown, data: { fatal?: boolean }) => {
        if (data.fatal) {
          cleanup();
          reject(new Error('HLS 오류'));
        }
      };
      const to = setTimeout(() => {
        cleanup();
        reject(new Error('HLS 타임아웃'));
      }, LOAD_TIMEOUT_MS);
      function cleanup() {
        clearTimeout(to);
        inst.off(Hls.Events.MANIFEST_PARSED, onParsed);
        inst.off(Hls.Events.ERROR, onErr);
      }
      inst.on(Hls.Events.MANIFEST_PARSED, onParsed);
      inst.on(Hls.Events.ERROR, onErr);
    });
    // 파싱 이후: 재생 중 치명적 오류 자동 복구 (네트워크/미디어)
    inst.on(Hls.Events.ERROR, (_e, data) => {
      if (!data.fatal) return;
      if (data.type === Hls.ErrorTypes.NETWORK_ERROR) inst.startLoad();
      else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) inst.recoverMediaError();
    });
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = stream.streamUrl;
    await waitEvent(video, 'loadedmetadata', LOAD_TIMEOUT_MS);
  } else {
    throw new Error('이 브라우저는 HLS 재생을 지원하지 않습니다.');
  }

  try {
    video.currentTime = startTime;
    // 프리버퍼일 때만 버퍼를 미리 채워 두고, 라이브(즉시 재생)는 기다리지 않는다
    // — 현재 곡의 첫 재생 지연을 막기 위함(재생하며 이어서 버퍼).
    if (opts?.waitBuffer) {
      await waitBuffered(video, startTime, PREBUFFER_LEAD_SEC, BUFFER_TIMEOUT_MS);
    }
  } catch {
    /* 버퍼 대기 실패는 무시 */
  }

  return { video, hls, videoTitle: stream.videoTitle };
}

/** 준비된 미디어 정리 (HLS 파기 + video 소스 해제 + DOM 제거) */
export function destroyPreparedMedia(m: { video: HTMLVideoElement; hls: Hls | null } | null): void {
  if (!m) return;
  try {
    m.hls?.destroy();
  } catch {
    /* 무시 */
  }
  try {
    m.video.pause();
    m.video.removeAttribute('src');
    m.video.load();
    m.video.remove();
  } catch {
    /* 무시 */
  }
}

// ── 다음곡 프리버퍼 슬롯 (한 개만 유지) ─────────────────────────────
let slotKey: string | null = null;
let slotPromise: Promise<PreparedChzzkMedia> | null = null;

const keyOf = (videoNo: string, startTime: number) => `${videoNo}@${Math.floor(startTime)}`;

/** 다음 곡을 숨은 <video>로 미리 버퍼링(무음). 이미 같은 슬롯이면 무시. */
export function prebufferChzzk(videoNo: string, startTime: number): void {
  const key = keyOf(videoNo, startTime);
  if (slotKey === key) return;
  discardPrebuffered();
  slotKey = key;
  slotPromise = prepareChzzkMedia(videoNo, startTime, { muted: true, waitBuffer: true });
  // 실패 시 슬롯 비우기 (같은 키일 때만)
  slotPromise.catch(() => {
    if (slotKey === key) {
      slotKey = null;
      slotPromise = null;
    }
  });
}

/** 프리버퍼된 미디어를 넘겨받는다(슬롯 비움). 없으면 null. */
export function takePrebufferedChzzk(videoNo: string, startTime: number): Promise<PreparedChzzkMedia> | null {
  if (slotKey !== keyOf(videoNo, startTime) || !slotPromise) return null;
  const p = slotPromise;
  slotKey = null;
  slotPromise = null;
  return p;
}

/** 대기 중인 프리버퍼 슬롯을 폐기(재생 종료/큐 닫힘 시). */
export function discardPrebuffered(): void {
  if (!slotPromise) return;
  const p = slotPromise;
  slotKey = null;
  slotPromise = null;
  p.then((m) => destroyPreparedMedia(m)).catch(() => {});
}
