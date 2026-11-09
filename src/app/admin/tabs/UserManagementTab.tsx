"use client";
import { useEffect, useState } from "react";
import {
  ArrowPathIcon,
  MagnifyingGlassIcon,
  UsersIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import UserDetailModal from "@/components/admin/UserDetailModal";
import {
  adminControl,
  adminMuted,
  adminPanel,
} from "@/components/admin/AdminPrimitives";
import { adminAgo, adminDate } from "@/domains/operations/admin-overview";
import type { AdminUserListItem } from "@/domains/identity/admin-user.service";
import type { AdminUserView } from "@/domains/identity/user.view";
const roles: Record<string, string> = {
  super_admin: "최고 관리자",
  ayauke_admin: "아야우케 관리자",
  song_admin: "노래 관리자",
  song_editor: "노래 편집자",
  user: "일반 사용자",
};
interface UserResponse {
  users: AdminUserListItem[];
  overview: { total: number; admins: number };
  pagination: {
    currentPage: number;
    totalPages: number;
    totalUsers: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    limit: number;
  };
}
export default function UserManagementTab() {
  const [data, setData] = useState<UserResponse | null>(null),
    [search, setSearch] = useState(""),
    [debounced, setDebounced] = useState(""),
    [role, setRole] = useState("all"),
    [sort, setSort] = useState("lastActivityAt"),
    [order, setOrder] = useState("desc"),
    [page, setPage] = useState(1),
    [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [selected, setSelected] = useState<AdminUserListItem | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const query = new URLSearchParams({
      search: debounced,
      role,
      sortBy: sort,
      sortOrder: order,
      page: String(page),
      limit: "20",
    });
    fetch(`/api/admin/users?${query}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || "조회 실패");
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
  }, [debounced, role, sort, order, page, refresh]);
  const changed = (user: AdminUserView) => {
    setData((current) =>
      current
        ? {
            ...current,
            users: current.users.map((u) =>
              u._id === user._id ? { ...u, ...user } : u,
            ),
          }
        : current,
    );
    setSelected(null);
    setRefresh((x) => x + 1);
  };
  return (
    <div className="space-y-5 text-light-text dark:text-dark-text">
      <header className="flex flex-wrap justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[.18em] text-purple-700 dark:text-purple-300">
            WORKSPACE / PEOPLE
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            사용자 관리
          </h2>
          <p className={`${adminMuted} mt-2`}>
            기간에 가두지 않고, 각 사용자의 전체 활동을 살펴보세요.
          </p>
        </div>
        <button
          aria-label="사용자 목록 새로고침"
          disabled={loading}
          onClick={() => setRefresh((x) => x + 1)}
          className={`${adminControl} inline-flex items-center gap-2 self-start`}
        >
          <ArrowPathIcon className="h-4 w-4" />
          새로고침
        </button>
      </header>
      <div className="grid grid-cols-2 gap-3">
        <div className={`${adminPanel} flex items-center gap-4 p-5`}>
          <UsersIcon className="h-6 w-6 text-purple-600 dark:text-purple-300" />
          <div>
            <p className={adminMuted}>전체 사용자</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {data?.overview.total ?? "—"}
              <span className="ml-1 text-sm font-normal">명</span>
            </p>
          </div>
        </div>
        <div className={`${adminPanel} flex items-center gap-4 p-5`}>
          <ShieldCheckIcon className="h-6 w-6 text-purple-600 dark:text-purple-300" />
          <div>
            <p className={adminMuted}>관리 권한</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {data?.overview.admins ?? "—"}
              <span className="ml-1 text-sm font-normal">명</span>
            </p>
          </div>
        </div>
      </div>
      <section
        className={`${adminPanel} overflow-hidden`}
        aria-label="사용자 목록"
      >
        <div className="flex flex-wrap gap-3 border-b border-light-primary/15 p-4 dark:border-dark-primary/15">
          <label className="relative min-w-0 flex-1 basis-60">
            <span className="sr-only">사용자 검색</span>
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-light-text/70 dark:text-dark-text/70" />
            <input
              value={search}
              maxLength={100}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="이름 또는 채널 ID 검색"
              className={`${adminControl} w-full pl-10`}
            />
          </label>
          <select
            aria-label="권한 필터"
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
              setPage(1);
            }}
            className={adminControl}
          >
            <option value="all">모든 권한</option>
            {Object.entries(roles).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <select
            aria-label="사용자 정렬 기준"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
            className={adminControl}
          >
            <option value="lastActivityAt">최근 활동순</option>
            <option value="createdAt">가입일순</option>
            <option value="channelName">채널 이름순</option>
            <option value="lastLoginAt">로그인순</option>
          </select>
          <button
            onClick={() => {
              setOrder((x) => (x === "desc" ? "asc" : "desc"));
              setPage(1);
            }}
            className={adminControl}
          >
            {order === "desc" ? "내림차순 ↓" : "오름차순 ↑"}
          </button>
        </div>
        {error ? (
          <div
            role="alert"
            className="p-6 text-sm text-red-700 dark:text-red-300"
          >
            {error}{" "}
            <button
              className={`${adminControl} ml-2`}
              onClick={() => setRefresh((x) => x + 1)}
            >
              다시 시도
            </button>
          </div>
        ) : loading ? (
          <p role="status" className={`${adminMuted} p-8 text-center`}>
            사용자 기록을 불러오는 중…
          </p>
        ) : (
          <>
            <div className="hidden grid-cols-[minmax(0,1.5fr)_1fr_1fr_1fr_auto] gap-4 bg-light-primary/5 px-5 py-3 text-xs font-medium text-light-text/70 dark:bg-dark-primary/5 dark:text-dark-text/70 lg:grid">
              <span>사용자 / 권한</span>
              <span>최근 기록된 활동</span>
              <span>가입일</span>
              <span>누적 좋아요 / 목록</span>
              <span>상세</span>
            </div>
            <ul className="divide-y divide-light-primary/10 dark:divide-dark-primary/10">
              {data?.users.map((user) => (
                <li
                  key={user._id}
                  className="grid items-center gap-4 p-5 transition-colors hover:bg-light-primary/5 dark:hover:bg-dark-primary/5 lg:grid-cols-[minmax(0,1.5fr)_1fr_1fr_1fr_auto]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      aria-hidden="true"
                      className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-purple-100 font-semibold text-purple-800 dark:bg-purple-950 dark:text-purple-200"
                    >
                      {user.profileImageUrl ? (
                        <img
                          src={user.profileImageUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        (user.displayName || user.channelName).slice(0, 1)
                      )}
                    </div>
                    <div className="min-w-0">
                      <button
                        onClick={() => setSelected(user)}
                        className="min-h-11 break-words text-left text-sm font-semibold hover:underline"
                      >
                        {user.displayName || user.channelName}
                      </button>
                      <p className="truncate text-xs text-light-text/70 dark:text-dark-text/70">
                        {user.channelName}
                      </p>
                      <span className="mt-1 inline-block rounded-full bg-purple-50 px-2 py-1 text-[11px] text-purple-800 dark:bg-purple-950/60 dark:text-purple-200">
                        {roles[user.role] || user.role}
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-light-text/70 dark:text-dark-text/70 lg:hidden">
                      최근 기록된 활동
                    </p>
                    <p className="text-sm tabular-nums">
                      {adminDate(user.lastActivityAt)}
                    </p>
                    <p className={`${adminMuted} mt-1 text-xs`}>
                      {adminAgo(user.lastActivityAt)} · 방문 기록{" "}
                      {user.visitDays}일
                    </p>
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-light-text/70 dark:text-dark-text/70 lg:hidden">
                      가입일
                    </p>
                    <p className="text-sm tabular-nums">
                      {adminDate(user.createdAt)}
                    </p>
                  </div>
                  <div className="space-y-1 text-xs">
                    <p>
                      좋아요{" "}
                      <span className="text-light-text/70 dark:text-dark-text/70">
                        곡 {user.likesCount ?? 0} · 클립 {user.clipLikesCount}
                      </span>
                    </p>
                    <p>
                      목록{" "}
                      <span className="text-light-text/70 dark:text-dark-text/70">
                        곡 {user.playlistsCount ?? 0} · 클립{" "}
                        {user.clipPlaylistsCount}
                      </span>
                    </p>
                    {(user.addedClipsCount > 0 || user.proposalsCount > 0) && (
                      <p className="text-purple-700 dark:text-purple-300">
                        클립 기여 {user.addedClipsCount} · 제안{" "}
                        {user.proposalsCount}
                      </p>
                    )}
                  </div>
                  <button
                    aria-label={`${user.displayName || user.channelName} 사용자 상세 보기`}
                    className={adminControl}
                    onClick={() => setSelected(user)}
                  >
                    상세 →
                  </button>
                </li>
              ))}
            </ul>
            {!data?.users.length && (
              <p className={`${adminMuted} p-10 text-center`}>
                검색 조건에 맞는 사용자가 없습니다.
              </p>
            )}
            {data && (
              <nav
                aria-label="사용자 목록 페이지"
                className="flex flex-wrap items-center justify-between gap-3 border-t border-light-primary/15 p-4 dark:border-dark-primary/15"
              >
                <p role="status" className={adminMuted}>
                  검색 결과 {data.pagination.totalUsers}명 ·{" "}
                  {data.pagination.currentPage} / {data.pagination.totalPages}{" "}
                  페이지
                </p>
                <div className="flex gap-2">
                  <button
                    className={adminControl}
                    disabled={!data.pagination.hasPreviousPage}
                    onClick={() => setPage(data.pagination.currentPage - 1)}
                  >
                    이전
                  </button>
                  <button
                    className={adminControl}
                    disabled={!data.pagination.hasNextPage}
                    onClick={() => setPage(data.pagination.currentPage + 1)}
                  >
                    다음
                  </button>
                </div>
              </nav>
            )}
          </>
        )}
      </section>
      <p className={`${adminMuted} text-xs`}>
        최근 활동은 로그인·방문 기록 중 최신 시각입니다. 방문 추적이 없는 화면의
        이용은 포함되지 않습니다. 좋아요·목록은 현재 보유 데이터입니다.
      </p>
      {selected && (
        <UserDetailModal
          user={selected}
          isOpen
          onClose={() => setSelected(null)}
          onUserUpdate={changed}
        />
      )}
    </div>
  );
}
