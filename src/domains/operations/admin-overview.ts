export interface RecentAdminRecord {
  id: string;
  title: string;
  subtitle: string;
  at: string | null;
  href?: string;
}
export interface AdminOverview {
  generatedAt: string;
  canManageUsers: boolean;
  totals: {
    songs: number;
    mr: number;
    duration: number;
    users: number;
    clips: number;
    playable: number;
    verified: number;
    songLikes: number;
    clipLikes: number;
    songPlaylists: number;
    clipPlaylists: number;
  };
  period: {
    users: number;
    clips: number;
    songLikes: number;
    clipLikes: number;
    playlists: number;
  };
  work: {
    unavailable: number;
    reports: number;
    proposals: number;
    timelines: null | {
      unmatched: number;
      matchedUnverified: number;
      aiUnverified: number;
    };
    videos: {
      id: string;
      title: string;
      total: number;
      verified: number;
      unmatched: number;
      at: string | null;
    }[];
  };
  recent: {
    clips: RecentAdminRecord[];
    users: RecentAdminRecord[];
    playlists: RecentAdminRecord[];
    likes: RecentAdminRecord[];
  };
}
/** Inclusive KST dates. Totals and latest records are deliberately not date-filtered. */
export function adminPeriod(
  params: URLSearchParams,
  now = new Date(),
): { start?: Date; end?: Date } {
  const period = params.get("period") || "all";
  if (period === "all") return {};
  if (period === "30" || period === "90")
    return {
      start: new Date(now.getTime() - Number(period) * 86400000),
      end: now,
    };
  if (period !== "custom") throw new Error("기간을 확인해주세요.");
  const parse = (key: string) => {
    const raw = params.get(key) || "",
      date = new Date(`${raw}T00:00:00+09:00`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(raw) ||
      !Number.isFinite(date.getTime()) ||
      new Date(date.getTime() + 9 * 3600000).toISOString().slice(0, 10) !== raw
    )
      throw new Error("올바른 날짜를 입력해주세요.");
    return date;
  };
  const start = parse("start"),
    last = parse("end");
  if (start > last) throw new Error("종료일은 시작일 이후여야 합니다.");
  return { start, end: new Date(last.getTime() + 86400000) };
}
export function adminDate(value: string | Date | null | undefined): string {
  if (!value) return "기록 없음";
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString("ko-KR", {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
    : "기록 없음";
}
export function adminAgo(value: string | null, now = Date.now()): string {
  if (!value || !Number.isFinite(new Date(value).getTime())) return "기록 없음";
  const days = Math.max(
    0,
    Math.floor((now - new Date(value).getTime()) / 86400000),
  );
  return days === 0
    ? "오늘"
    : days < 30
      ? `${days}일 전`
      : days < 365
        ? `${Math.floor(days / 30)}개월 전`
        : `${Math.floor(days / 365)}년 전`;
}
