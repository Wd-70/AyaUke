import { resolveVodRenditions, type Mp4Rendition } from '@/shared/utils/chzzk-vod';

/**
 * 치지직 다시보기 스트림 정보의 짧은 수명 클라이언트 캐시.
 *
 * 스트림 조회는 `/api/clips/chzzk-hls`(+ vod면 resolveVodMp4Url)로 라운드트립이 있어
 * 다음 곡 전환이 느리다. 종료 임박 시 prefetch로 미리 받아 캐시에 넣어두면,
 * 실제 플레이어가 마운트될 때 이 캐시를 재사용해 조회를 건너뛴다.
 * 스트림 URL은 만료될 수 있으므로 TTL을 짧게 둔다(90초).
 */
export interface ChzzkStream {
  streamUrl: string;
  streamType: 'hls' | 'mp4' | 'vod';
  videoTitle?: string;
  vodVideoId?: string;
  vodInKey?: string;
  /** vod 타입일 때 해석된 진행형 MP4 URL (최고 화질, 호출 IP에 묶임) */
  mp4Url?: string | null;
  /** vod 타입일 때 화질별 렌디션 (화질 선택용, 높이 내림차순) */
  renditions?: Mp4Rendition[];
}

const TTL_MS = 90_000;
const MAX_ENTRIES = 20; // 재생 이력만큼 무한 증가 방지 (LRU + 만료 정리)
const cache = new Map<string, { data: ChzzkStream; ts: number }>();
const inflight = new Map<string, Promise<ChzzkStream>>();

/** 만료 항목 제거 + LRU로 상한 유지 (Map은 삽입순 → 앞쪽이 오래된 것) */
function evict() {
  const now = Date.now();
  for (const [k, v] of cache) {
    if (now - v.ts >= TTL_MS) cache.delete(k);
  }
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

async function fetchStream(videoNo: string): Promise<ChzzkStream> {
  const res = await fetch(`/api/clips/chzzk-hls?videoNo=${videoNo}`);
  const result = await res.json();
  if (!res.ok || !result.success) {
    throw new Error(result.error?.message || '영상 정보를 불러올 수 없습니다.');
  }
  const data = result.data as ChzzkStream;
  // vod는 브라우저가 직접 화질별 MP4 렌디션을 해석해 함께 캐시 (전환 지연 축소 + 화질 선택)
  if (data.streamType === 'vod' && data.vodVideoId && data.vodInKey) {
    try {
      const renditions = await resolveVodRenditions(data.vodVideoId, data.vodInKey);
      data.renditions = renditions;
      data.mp4Url = renditions[0]?.url ?? null; // 최고 화질 기본
    } catch {
      data.renditions = [];
      data.mp4Url = null;
    }
  }
  return data;
}

/** 캐시 우선으로 스트림 정보를 가져온다. 동시 호출은 하나의 요청으로 합친다. */
export async function loadChzzkStream(videoNo: string): Promise<ChzzkStream> {
  const hit = cache.get(videoNo);
  if (hit && Date.now() - hit.ts < TTL_MS) return hit.data;

  const running = inflight.get(videoNo);
  if (running) return running;

  const p = fetchStream(videoNo)
    .then((data) => {
      cache.set(videoNo, { data, ts: Date.now() });
      evict();
      inflight.delete(videoNo);
      return data;
    })
    .catch((err) => {
      inflight.delete(videoNo);
      throw err;
    });
  inflight.set(videoNo, p);
  return p;
}

/** 다음 곡 프리로드용 — 실패는 무시하고 캐시만 채운다. */
export function prefetchChzzkStream(videoNo: string): void {
  loadChzzkStream(videoNo).catch(() => {});
}
