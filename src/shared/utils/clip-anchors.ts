/**
 * 구간별 앵커(piecewise offset) 계산 — 순수 함수.
 *
 * 치지직 타임라인 시각을 유튜브 영상 시각으로 변환할 때, 유튜브 영상의
 * 편집 컷 때문에 단일 오프셋이 안 통한다. 그래서 타임라인 곳곳에 "앵커"
 * (치지직 시각 ↔ 유튜브 시각 짝)를 두고, 각 앵커는 그 지점 이후(다음 앵커
 * 전까지)의 오프셋을 정의한다.
 */

export interface Anchor {
  /** 치지직 영상 기준 시각(초) */
  chzzkTime: number;
  /** 그 지점의 실제 유튜브 영상 시각(초) */
  ytTime: number;
}

/** chzzkTime 오름차순 정렬된 앵커 배열 반환 (입력 불변) */
function sortAnchors(anchors: Anchor[]): Anchor[] {
  return [...anchors].sort((a, b) => a.chzzkTime - b.chzzkTime);
}

/**
 * 특정 chzzk 시각에 적용되는 앵커 = chzzkTime 이하 중 가장 마지막 앵커.
 * 없으면 null (아직 첫 앵커 미설정).
 */
export function anchorFor(chzzkTime: number, anchors: Anchor[]): Anchor | null {
  const sorted = sortAnchors(anchors);
  let result: Anchor | null = null;
  for (const a of sorted) {
    if (a.chzzkTime <= chzzkTime) result = a;
    else break;
  }
  // 첫 앵커보다 앞선 타임라인도 첫 앵커의 오프셋을 적용한다(앞 구간엔 컷이 없다고 가정)
  if (!result && sorted.length > 0) return sorted[0];
  return result;
}

/** chzzk 시각 → 유튜브 시각. 앵커가 하나도 없으면 null */
export function toYtTime(chzzkTime: number, anchors: Anchor[]): number | null {
  const a = anchorFor(chzzkTime, anchors);
  if (!a) return null;
  return chzzkTime + (a.ytTime - a.chzzkTime);
}

/**
 * 앵커 추가/갱신. 같은 chzzkTime이 있으면 ytTime을 덮어쓴다.
 * 이 지점 이후 타임라인만 새 오프셋을 따르고, 이전 앵커들은 그대로 유지된다.
 */
export function upsertAnchor(anchors: Anchor[], chzzkTime: number, ytTime: number): Anchor[] {
  const next = anchors.filter((a) => a.chzzkTime !== chzzkTime);
  next.push({ chzzkTime, ytTime });
  return sortAnchors(next);
}

/** 앵커 제거 (해당 chzzkTime 지점) */
export function removeAnchor(anchors: Anchor[], chzzkTime: number): Anchor[] {
  return sortAnchors(anchors.filter((a) => a.chzzkTime !== chzzkTime));
}

/** 해당 chzzk 시각에 앵커가 직접 설정돼 있는가 */
export function isAnchored(chzzkTime: number, anchors: Anchor[]): boolean {
  return anchors.some((a) => a.chzzkTime === chzzkTime);
}
