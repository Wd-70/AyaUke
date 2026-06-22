/**
 * 클립 시간 포맷/파싱 — 리스트·플레이어·공유 페이지 공통.
 * (이전엔 LiveClipManager·ClipPlayer·LiveClipEditor에 제각기 중복 정의되어
 *  표기가 어긋났다. 단일 출처로 통합한다.)
 */

/** 초 → "m:ss" / "h:mm:ss" (정수 초, 플레이어 진행/길이 표시용) */
export function formatClipTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`;
}

/** 초 → "m:ss.d" / "h:mm:ss.d" (0.1초 단위, 클립 길이·구간 정밀 표시용) */
export function formatPreciseTime(seconds: number): string {
  const total = Math.max(0, seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = Math.floor(total % 60);
  const decimal = Math.floor((total % 1) * 10);
  const base =
    h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
      : `${m}:${String(sec).padStart(2, '0')}`;
  return `${base}.${decimal}`;
}

/** "mm:ss.d" / "h:mm:ss.d" / 정수초 문자열 → 초. 파싱 실패 시 0 */
export function parseTimeToSeconds(timeStr: string): number {
  if (!timeStr) return 0;

  // 숫자만 → 초
  if (/^\d+$/.test(timeStr)) return parseInt(timeStr, 10) || 0;

  const match = timeStr.match(/^(?:(\d+):)?(\d+):(\d+)(?:\.(\d))?$/);
  if (match) {
    const hours = parseInt(match[1] || '0', 10) || 0;
    const minutes = parseInt(match[2] || '0', 10) || 0;
    const seconds = parseInt(match[3] || '0', 10) || 0;
    const decimal = parseInt(match[4] || '0', 10) || 0;
    return hours * 3600 + minutes * 60 + seconds + decimal / 10;
  }
  return 0;
}
