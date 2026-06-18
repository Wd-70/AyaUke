/**
 * 방송 날짜 유틸 (순수 함수).
 *
 * 치지직 다시보기 publishDate(방송 종료 시각)와 유튜브 제목의 [YY.MM.DD]
 * (방송 시작일)는 자정 넘긴 방종 때문에 1일씩 어긋나는 경우가 많다.
 * 유튜브 클립 생성 도구가 두 날짜를 KST 기준으로 비교/보정하는 데 쓴다.
 */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** Date(또는 ISO 문자열)를 KST 기준 'YYYY-MM-DD'로 변환 */
export function toKstDateString(input: Date | string): string {
  const d = typeof input === 'string' ? new Date(input) : input;
  const kst = new Date(d.getTime() + KST_OFFSET_MS);
  return kst.toISOString().slice(0, 10);
}

/** 'YYYY-MM-DD'에서 N일을 더한(또는 뺀) 날짜 문자열 */
export function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * 유튜브 제목에서 [YY.MM.DD] 또는 [YYYY.MM.DD]를 찾아 'YYYY-MM-DD'로 반환.
 * (LiveClipManager의 extractDateFromTitle과 동일 규칙)
 */
export function parseTitleDate(title: string): string | null {
  if (!title) return null;
  const m = title.match(/\[(\d{2,4})\.(\d{1,2})\.(\d{1,2})\]/);
  if (!m) return null;
  let y = parseInt(m[1], 10);
  if (y < 100) y += 2000;
  const mo = String(parseInt(m[2], 10)).padStart(2, '0');
  const d = String(parseInt(m[3], 10)).padStart(2, '0');
  return `${y}-${mo}-${d}`;
}
