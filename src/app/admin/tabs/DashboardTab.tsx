"use client";
import { useEffect, useState } from "react";
import {
  ArrowPathIcon,
  MusicalNoteIcon,
  PlayIcon,
  UsersIcon,
  HeartIcon,
  QueueListIcon,
  ArrowUpRightIcon,
} from "@heroicons/react/24/outline";
import {
  adminDate,
  type AdminOverview,
} from "@/domains/operations/admin-overview";
import {
  AdminRecords,
  AdminSection,
  adminControl,
  adminMuted,
  adminPanel,
} from "@/components/admin/AdminPrimitives";
type Destination = "clip-workflow" | "clips" | "clip-reports" | "users";
export default function DashboardTab({
  onNavigate,
}: {
  onNavigate?: (tab: Destination) => void;
}) {
  const [data, setData] = useState<AdminOverview | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("all"),
    [start, setStart] = useState(""),
    [end, setEnd] = useState(""),
    [custom, setCustom] = useState(""),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (period === "custom" && !custom) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const query = period === "custom" ? custom : `period=${period}`;
    fetch(`/api/admin/dashboard-stats?${query}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || "현황을 불러오지 못했습니다.");
        return json;
      })
      .then((json) => {
        if (!controller.signal.aborted) setData(json);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [period, custom, refresh]);
  const go = (tab: Destination, label: string) =>
    onNavigate ? (
      <button
        className={`${adminControl} inline-flex items-center gap-2`}
        onClick={() => onNavigate(tab)}
      >
        {label}
        <ArrowUpRightIcon className="h-4 w-4" />
      </button>
    ) : null;
  const t = data?.totals;
  const cards = t
    ? [
        {
          label: "등록 곡",
          value: t.songs,
          detail: `MR ${t.mr.toLocaleString()}곡 · 기본 길이 ${t.duration}곡`,
          icon: MusicalNoteIcon,
        },
        {
          label: "라이브 클립",
          value: t.clips,
          detail: `재생 가능 ${t.playable.toLocaleString()} · 검증 완료 ${t.verified.toLocaleString()}`,
          icon: PlayIcon,
        },
        {
          label: "사용자",
          value: t.users,
          detail: "가입한 전체 사용자",
          icon: UsersIcon,
        },
        {
          label: "좋아요",
          value: t.songLikes + t.clipLikes,
          detail: `곡 ${t.songLikes} · 클립 ${t.clipLikes}`,
          icon: HeartIcon,
        },
        {
          label: "플레이리스트",
          value: t.songPlaylists + t.clipPlaylists,
          detail: `곡 ${t.songPlaylists} · 클립 ${t.clipPlaylists}`,
          icon: QueueListIcon,
        },
      ]
    : [];
  return (
    <div className="space-y-6 text-light-text dark:text-dark-text">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[.18em] text-purple-700 dark:text-purple-300">
            WORKSPACE / OVERVIEW
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            운영 대시보드
          </h2>
          <p className={`${adminMuted} mt-2`}>
            쌓인 콘텐츠와 최근 기록, 이어서 할 작업을 한눈에.
          </p>
        </div>
        <button
          className={`${adminControl} inline-flex items-center gap-2`}
          disabled={loading}
          onClick={() => setRefresh((x) => x + 1)}
          aria-label="대시보드 새로고침"
        >
          <ArrowPathIcon
            className={`h-4 w-4 ${loading ? "animate-spin motion-reduce:animate-none" : ""}`}
          />
          새로고침
        </button>
      </header>
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-300 p-4 text-sm text-red-700 dark:text-red-300"
        >
          {error}{" "}
          <button
            className="min-h-11 underline"
            onClick={() => setRefresh((x) => x + 1)}
          >
            다시 시도
          </button>
        </div>
      )}
      {!data && loading ? (
        <div role="status" className={`${adminPanel} p-10 text-center`}>
          운영 현황을 불러오는 중…
        </div>
      ) : (
        data && (
          <>
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
              {cards.map(({ label, value, detail, icon: Icon }) => (
                <section
                  key={label}
                  className={`${adminPanel} relative overflow-hidden p-4 last:col-span-2 sm:p-5 xl:last:col-span-1`}
                >
                  <div className="mb-5 flex items-center justify-between">
                    <span className={adminMuted}>{label}</span>
                    <Icon className="h-5 w-5 text-purple-600 dark:text-purple-300" />
                  </div>
                  <p className="text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">
                    {value.toLocaleString()}
                  </p>
                  <p className={`${adminMuted} mt-2 text-xs`}>{detail}</p>
                </section>
              ))}
            </div>
            <section
              className={`${adminPanel} p-4`}
              aria-label="기간별 신규 기록"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">기간별 신규 기록</h3>
                  <p className={`${adminMuted} mt-1 text-xs`}>
                    상단 보유 현황과 아래 최근 기록은 항상 전체 기간입니다.
                  </p>
                </div>
                <select
                  aria-label="신규 기록 집계 기간"
                  className={adminControl}
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                >
                  <option value="all">전체 기간</option>
                  <option value="90">최근 90일</option>
                  <option value="30">최근 30일</option>
                  <option value="custom">직접 지정</option>
                </select>
              </div>
              {period === "custom" && (
                <form
                  className="mt-3 flex flex-wrap items-end gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (start && end && start <= end) {
                      setError("");
                      setCustom(`period=custom&start=${start}&end=${end}`);
                    } else setError("시작일과 종료일을 확인해주세요.");
                  }}
                >
                  <label className={adminMuted}>
                    시작일
                    <input
                      required
                      type="date"
                      value={start}
                      onChange={(e) => setStart(e.target.value)}
                      className={`${adminControl} mt-1 block`}
                    />
                  </label>
                  <label className={adminMuted}>
                    종료일
                    <input
                      required
                      type="date"
                      value={end}
                      min={start}
                      onChange={(e) => setEnd(e.target.value)}
                      className={`${adminControl} mt-1 block`}
                    />
                  </label>
                  <button className={adminControl}>기간 적용</button>
                </form>
              )}
              <p
                role="status"
                aria-live="polite"
                className={`${adminMuted} mt-4 flex flex-wrap gap-x-5 gap-y-2`}
              >
                {loading ? (
                  "집계 중…"
                ) : error ? (
                  "집계를 완료하지 못했습니다. 다시 시도해주세요."
                ) : period === "custom" && !custom ? (
                  "기간을 지정하고 적용해주세요."
                ) : (
                  <>
                    <span>
                      가입 <strong>{data.period.users}</strong>명
                    </span>
                    <span>
                      클립 추가{" "}
                      <strong>{data.period.clips.toLocaleString()}</strong>개
                    </span>
                    <span>
                      곡 좋아요 <strong>{data.period.songLikes}</strong>건
                    </span>
                    <span>
                      클립 좋아요 <strong>{data.period.clipLikes}</strong>건
                    </span>
                    <span>
                      플레이리스트 생성 <strong>{data.period.playlists}</strong>
                      개
                    </span>
                  </>
                )}
              </p>
            </section>
            <div className="grid items-start gap-5 xl:grid-cols-3">
              <div className="space-y-5 xl:col-span-2">
                {data.work.timelines && (
                  <AdminSection
                    title="이어서 할 작업"
                    description="최근 수정된 영상 중 시간 검증이 남은 항목입니다."
                    action={go("clip-workflow", "클립 만들기")}
                  >
                    <div className="mb-5 grid grid-cols-3 gap-2">
                      {[
                        ["미매칭", data.work.timelines.unmatched],
                        [
                          "매칭 · 미검증",
                          data.work.timelines.matchedUnverified,
                        ],
                        ["AI 조정 · 미검증", data.work.timelines.aiUnverified],
                      ].map(([label, value]) => (
                        <div
                          key={label}
                          className="rounded-xl bg-purple-50 p-3 dark:bg-purple-950/30"
                        >
                          <p className="text-xs text-light-text/70 dark:text-dark-text/70">
                            {label}
                          </p>
                          <p className="mt-2 text-xl font-semibold tabular-nums">
                            {Number(value).toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                    <ul className="space-y-4">
                      {data.work.videos.map((v) => (
                        <li key={v.id}>
                          <div className="flex flex-wrap justify-between gap-2 text-sm">
                            <p className="min-w-0 flex-1 break-words font-medium">
                              {v.title}
                            </p>
                            <span className={adminMuted}>
                              {v.verified} / {v.total} 검증
                            </span>
                          </div>
                          <div
                            role="progressbar"
                            aria-label={`${v.title} 시간 검증`}
                            aria-valuenow={v.verified}
                            aria-valuemin={0}
                            aria-valuemax={v.total}
                            className="mt-2 h-1.5 overflow-hidden rounded-full bg-purple-100 dark:bg-purple-950"
                          >
                            <div
                              className="h-full rounded-full bg-purple-500"
                              style={{
                                width: `${v.total ? (v.verified / v.total) * 100 : 0}%`,
                              }}
                            />
                          </div>
                          <p className={`${adminMuted} mt-1 text-xs`}>
                            미매칭 {v.unmatched}개 · 최근 수정 {adminDate(v.at)}
                          </p>
                        </li>
                      ))}
                    </ul>
                    {!data.work.videos.length && (
                      <p className={adminMuted}>
                        시간 검증이 남은 영상이 없습니다.
                      </p>
                    )}
                    <p className={`${adminMuted} mt-5 text-xs`}>
                      AI 조정은 사람의 검증과 별개입니다. 타임라인 검증과 생성된
                      클립 검증도 구분합니다.
                    </p>
                  </AdminSection>
                )}
                <AdminSection
                  title="최근 추가한 클립"
                  description="기간 제한 없이 가장 최근 5개"
                  action={go("clips", "클립 관리")}
                >
                  <AdminRecords items={data.recent.clips} />
                </AdminSection>
                <AdminSection
                  title="최근 좋아요"
                  description="현재 남아 있는 곡·클립 좋아요 기록"
                >
                  <AdminRecords items={data.recent.likes} />
                </AdminSection>
              </div>
              <div className="space-y-5">
                <AdminSection
                  title="운영 점검"
                  description="문제가 있는 항목만 모아 확인하세요."
                >
                  <div className="flex items-center justify-between gap-3 rounded-xl bg-amber-50 p-3 text-sm dark:bg-amber-950/20">
                    <span>재생 불가 클립</span>
                    <strong>{data.work.unavailable}개</strong>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {go("clips", "원본 점검")}
                    {go("clip-reports", `신고 ${data.work.reports}건`)}
                  </div>
                  <p className={`${adminMuted} mt-4`}>
                    {data.work.reports === 0 && data.work.proposals === 0
                      ? "신고·구간 제안 처리 대기 없음"
                      : `미처리 신고 ${data.work.reports}건 · 활성 구간 제안 ${data.work.proposals}건`}
                  </p>
                  {data.work.proposals > 0 && go("clips", "구간 제안 확인")}
                </AdminSection>
                {data.canManageUsers && (
                  <AdminSection
                    title="최근 가입"
                    description="전체 기간에서 최근 5명"
                    action={go("users", "사용자 관리")}
                  >
                    <AdminRecords items={data.recent.users} />
                  </AdminSection>
                )}
                <AdminSection
                  title="공개 플레이리스트"
                  description="곡·클립 플레이리스트의 최근 수정 기록"
                >
                  <AdminRecords items={data.recent.playlists} />
                </AdminSection>
              </div>
            </div>
            <footer className={`${adminMuted} text-xs`}>
              조회 기준{" "}
              {new Date(data.generatedAt).toLocaleString("ko-KR", {
                timeZone: "Asia/Seoul",
              })}{" "}
              · 좋아요·플레이리스트 수는 현재 보유 데이터 기준입니다.
            </footer>
          </>
        )
      )}
    </div>
  );
}
