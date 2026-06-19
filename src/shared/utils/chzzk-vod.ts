/**
 * 치지직 영구 보존 VOD(네이버 neonplayer) 재생 URL 해석.
 *
 * 중요: vodplay가 돌려주는 MP4 URL의 서명 토큰(`_lsu_sa_`)은 **vodplay를 호출한 IP**에
 * 묶인다. 서버(프로덕션=Vercel)에서 받아 클라이언트로 넘기면 IP가 달라 재생이 막힌다
 * (검은화면+무음). 그래서 vodplay 호출은 반드시 **재생하는 브라우저**에서 해야 한다.
 * (치지직 공식 플레이어와 동일한 방식. vodplay는 CORS 허용됨.)
 */

/** 네이버 VOD 재생 JSON(DASH)에서 최고 화질 progressive MP4 URL 추출 (순수) */
export function pickBestMp4Url(playback: Record<string, unknown>): string | null {
  let best: { width: number; url: string } | null = null;
  const periods = (playback?.period as Array<Record<string, unknown>>) ?? [];
  for (const period of periods) {
    const sets = (period?.adaptationSet as Array<Record<string, unknown>>) ?? [];
    for (const set of sets) {
      if (set?.mimeType !== "video/mp4") continue;
      const reps = (set?.representation as Array<Record<string, unknown>>) ?? [];
      for (const rep of reps) {
        const width = (rep?.width as number) ?? 0;
        const url = (rep?.baseURL as Array<{ value?: string }>)?.[0]?.value;
        if (url && (!best || width > best.width)) best = { width, url };
      }
    }
  }
  return best?.url ?? null;
}

/**
 * 영구 보존 VOD의 재생용 MP4 URL을 "이 호출자(브라우저) IP"에 묶인 토큰으로 받는다.
 * 반드시 클라이언트에서 호출할 것(서버에서 호출 시 토큰이 서버 IP에 묶임).
 */
export async function resolveVodMp4Url(videoId: string, inKey: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://apis.naver.com/neonplayer/vodplay/v2/playback/${encodeURIComponent(videoId)}?key=${encodeURIComponent(inKey)}`,
      { headers: { Accept: "application/json" } }, // 단순 요청(프리플라이트 회피)
    );
    if (!res.ok) return null;
    const playback = await res.json().catch(() => null);
    return playback ? pickBestMp4Url(playback) : null;
  } catch {
    return null;
  }
}
