"use client";
import { useEffect, useState } from "react";
import {
  AdminRecords,
  AdminSection,
  adminControl,
  adminMuted,
} from "./AdminPrimitives";
import {
  adminDate,
  type RecentAdminRecord,
} from "@/domains/operations/admin-overview";
interface ActivityData {
  visits: { date: string; lastVisitAt: string }[];
  clipLikes: RecentAdminRecord[];
  clipPlaylists: RecentAdminRecord[];
  contributions: {
    clips: number;
    proposals: number;
    applied: number;
    reports: number;
  };
}
export default function UserActivityDetails({ userId }: { userId: string }) {
  const [data, setData] = useState<ActivityData | null>(null),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError("");
    fetch(`/api/admin/users/${encodeURIComponent(userId)}/activity`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || "활동 조회 실패");
        return json;
      })
      .then((json) => {
        if (!controller.signal.aborted) setData(json);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [userId, retry]);
  if (error)
    return (
      <p role="alert" className="text-sm text-red-700 dark:text-red-300">
        {error}{" "}
        <button onClick={() => setRetry((x) => x + 1)} className={adminControl}>
          다시 시도
        </button>
      </p>
    );
  if (!data)
    return (
      <p role="status" className={adminMuted}>
        활동 기록을 불러오는 중…
      </p>
    );
  const contributions = Object.entries(data.contributions).filter(
    ([, count]) => count > 0,
  );
  const labels: Record<string, string> = {
    clips: "추가한 클립",
    proposals: "보관 중인 구간 제안",
    applied: "구간 반영 이력",
    reports: "신고",
  };
  return (
    <div className="space-y-5">
      <p className={adminMuted}>
        전체 기간의 기록입니다. 개인 메모와 개인 구간 설정 내용은 표시하지
        않습니다.
      </p>
      {contributions.length > 0 && (
        <AdminSection title="콘텐츠 기여">
          <dl className="grid grid-cols-2 gap-3">
            {contributions.map(([key, count]) => (
              <div
                key={key}
                className="rounded-xl bg-purple-50 p-3 dark:bg-purple-950/30"
              >
                <dt className={adminMuted}>{labels[key]}</dt>
                <dd className="mt-1 text-xl font-semibold">
                  {count.toLocaleString()}
                </dd>
              </div>
            ))}
          </dl>
          <p className={`${adminMuted} mt-3 text-xs`}>
            만료·삭제된 제안은 포함하지 않습니다. 반영 이력에는 관리자 직접
            수정도 포함될 수 있습니다.
          </p>
        </AdminSection>
      )}
      <div className="grid items-start gap-5 md:grid-cols-2">
        <AdminSection title="클립 좋아요" description="최근 기록 최대 50개">
          <AdminRecords items={data.clipLikes} />
        </AdminSection>
        <AdminSection
          title="클립 플레이리스트"
          description="최근 수정 최대 50개 · 비공개 목록은 링크 미제공"
        >
          <AdminRecords items={data.clipPlaylists} />
        </AdminSection>
      </div>
      <AdminSection
        title="방문 기록"
        description="최근 기록된 방문일 최대 30일 · 전체 사이트 방문을 보장하지 않습니다."
      >
        {data.visits.length ? (
          <ul className="flex flex-wrap gap-2">
            {data.visits.map((v) => (
              <li
                key={v.date}
                className="rounded-lg bg-light-primary/5 px-3 py-2 text-xs tabular-nums dark:bg-dark-primary/5"
              >
                <time dateTime={v.lastVisitAt}>{adminDate(v.lastVisitAt)}</time>
              </li>
            ))}
          </ul>
        ) : (
          <p className={adminMuted}>방문 기록 없음</p>
        )}
      </AdminSection>
    </div>
  );
}
