/**
 * 치지직 영구 보존 VOD(네이버 neonplayer) 재생 URL 해석.
 *
 * 중요: vodplay가 돌려주는 MP4 URL의 서명 토큰(`_lsu_sa_`)은 **vodplay를 호출한 IP**에
 * 묶인다. 서버(프로덕션=Vercel)에서 받아 클라이언트로 넘기면 IP가 달라 재생이 막힌다
 * (검은화면+무음). 그래서 vodplay 호출은 반드시 **재생하는 브라우저**에서 해야 한다.
 * (치지직 공식 플레이어와 동일한 방식. vodplay는 CORS 허용됨.)
 */

/** 화질별 progressive MP4 렌디션 */
export interface Mp4Rendition {
  height: number;
  width: number;
  bandwidth: number;
  url: string;
}

/**
 * 네이버 VOD 재생 JSON(DASH)에서 화질별 progressive MP4 렌디션을 모두 추출 (순수).
 * 높이(화질) 내림차순 정렬. 세그먼트 전용(청크 TS) representation은 제외한다.
 */
export function pickMp4Renditions(playback: Record<string, unknown>): Mp4Rendition[] {
  const out: Mp4Rendition[] = [];
  const periods = (playback?.period as Array<Record<string, unknown>>) ?? [];
  for (const period of periods) {
    const sets = (period?.adaptationSet as Array<Record<string, unknown>>) ?? [];
    for (const set of sets) {
      if (set?.mimeType !== "video/mp4") continue;
      const reps = (set?.representation as Array<Record<string, unknown>>) ?? [];
      for (const rep of reps) {
        // 통짜 progressive만 (segmentTemplate/List/Base 있으면 청크 스트림)
        if (rep?.segmentTemplate || rep?.segmentList || rep?.segmentBase) continue;
        const url = (rep?.baseURL as Array<{ value?: string }>)?.[0]?.value;
        if (!url) continue;
        out.push({
          height: (rep?.height as number) ?? 0,
          width: (rep?.width as number) ?? 0,
          bandwidth: (rep?.bandwidth as number) ?? 0,
          url,
        });
      }
    }
  }
  return out.sort((a, b) => b.height - a.height || b.bandwidth - a.bandwidth);
}

/** 네이버 VOD 재생 JSON(DASH)에서 최고 화질 progressive MP4 URL 추출 (순수) */
export function pickBestMp4Url(playback: Record<string, unknown>): string | null {
  return pickMp4Renditions(playback)[0]?.url ?? null;
}

async function fetchVodPlayback(videoId: string, inKey: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(
      `https://apis.naver.com/neonplayer/vodplay/v2/playback/${encodeURIComponent(videoId)}?key=${encodeURIComponent(inKey)}`,
      { headers: { Accept: "application/json" } }, // 단순 요청(프리플라이트 회피)
    );
    if (!res.ok) return null;
    return (await res.json().catch(() => null)) as Record<string, unknown> | null;
  } catch {
    return null;
  }
}

/**
 * 영구 보존 VOD의 화질별 재생 MP4 렌디션을 "이 호출자(브라우저) IP"에 묶인 토큰으로 받는다.
 * 반드시 클라이언트에서 호출할 것(서버에서 호출 시 토큰이 서버 IP에 묶임).
 */
export async function resolveVodRenditions(videoId: string, inKey: string): Promise<Mp4Rendition[]> {
  const playback = await fetchVodPlayback(videoId, inKey);
  return playback ? pickMp4Renditions(playback) : [];
}

/**
 * 영구 보존 VOD의 재생용 MP4 URL(최고 화질)을 받는다. (하위호환)
 * 반드시 클라이언트에서 호출할 것.
 */
export async function resolveVodMp4Url(videoId: string, inKey: string): Promise<string | null> {
  const playback = await fetchVodPlayback(videoId, inKey);
  return playback ? pickBestMp4Url(playback) : null;
}
