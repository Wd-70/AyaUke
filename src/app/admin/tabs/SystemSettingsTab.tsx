"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowPathIcon, ArrowTopRightOnSquareIcon, CheckCircleIcon, ExclamationTriangleIcon, XCircleIcon } from "@heroicons/react/24/outline";
import {
  AdminBadge,
  AdminPageHeader,
  AdminSection,
  adminButton,
  adminControl,
  adminMuted,
  adminPrimaryButton,
  type AdminTone,
} from "@/components/admin/AdminPrimitives";
import { adminAgo, adminDate } from "@/domains/operations/admin-overview";
import { FEATURE_INFO, FEATURE_KEYS, type FeatureKey, type SiteSettings, type SiteSettingsPatch } from "@/domains/operations/site-settings";
import type { SystemStatus, CheckState } from "@/domains/operations/system-status.service";
import { useToast } from "@/components/Toast";
import { SITE_SETTINGS_KEY, useSiteSettings } from "@/hooks/useAdminSiteSettings";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) throw new Error(json?.error?.message || "요청을 처리하지 못했습니다.");
  return json.data as T;
}


const STATE: Record<CheckState, { tone: AdminTone; label: string; Icon: typeof CheckCircleIcon }> = {
  ok: { tone: "ok", label: "정상", Icon: CheckCircleIcon },
  warn: { tone: "warn", label: "주의", Icon: ExclamationTriangleIcon },
  error: { tone: "error", label: "문제", Icon: XCircleIcon },
};

export default function SystemSettingsTab() {
  const qc = useQueryClient();
  const { showSuccess, showError } = useToast();
  const status = useQuery({
    queryKey: ["admin-system-status"],
    queryFn: () => api<SystemStatus>("/api/admin/system/status"),
    staleTime: 60_000,
  });
  const settings = useSiteSettings();
  const save = useMutation({
    mutationFn: (patch: SiteSettingsPatch) => api<SiteSettings>("/api/admin/system/settings", { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: (data) => qc.setQueryData(SITE_SETTINGS_KEY, data),
  });

  const toggleFeature = (key: FeatureKey, open: boolean) => {
    save.mutate(
      { features: { [key]: open } },
      {
        onSuccess: () => showSuccess(open ? "공개했어요" : "관리자 전용으로 바꿨어요", `${FEATURE_INFO[key].label} — ${open ? "누구나 볼 수 있습니다." : "관리자가 아니면 404로 보입니다."}`),
        onError: (e) => showError("저장 실패", e.message),
      },
    );
  };

  // 허용 오차 입력: 서버 값으로 시작, 저장 버튼으로 반영
  const [tolerance, setTolerance] = useState("");
  const savedTolerance = settings.data?.clipDefaults.durationTolerance;
  useEffect(() => {
    if (savedTolerance != null) setTolerance(String(savedTolerance));
  }, [savedTolerance]);
  const toleranceValue = Number(tolerance);
  const toleranceValid = tolerance.trim() !== "" && Number.isFinite(toleranceValue) && toleranceValue >= 0 && toleranceValue <= 120;
  const toleranceDirty = savedTolerance != null && toleranceValid && toleranceValue !== savedTolerance;

  const s = status.data;
  return (
    <div className="space-y-6 text-light-text dark:text-dark-text">
      <AdminPageHeader
        eyebrow="WORKSPACE / SYSTEM"
        title="시스템 설정"
        description="외부 서비스 연동이 잘 되고 있는지 확인하고, 사이트 기능 공개와 작업 기본값을 정합니다."
        actions={
          <button className={adminButton} disabled={status.isFetching} onClick={() => void status.refetch()}>
            <ArrowPathIcon className={`h-4 w-4 ${status.isFetching ? "animate-spin motion-reduce:animate-none" : ""}`} />
            연동 다시 확인
          </button>
        }
      />

      {/* 연동 상태 */}
      <AdminSection
        title="연동 상태"
        description={
          s ? `각 서비스를 실제로 한 번씩 호출해 본 결과예요 · ${adminDate(s.checkedAt)} 확인` : "각 서비스를 실제로 한 번씩 호출해 봅니다."
        }
      >
        {status.isError ? (
          <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{(status.error as Error).message}</p>
        ) : !s ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl bg-light-primary/10 dark:bg-dark-primary/10" />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {s.services.map((svc) => {
              const st = STATE[svc.state];
              return (
                <div key={svc.id} className="rounded-xl border border-light-primary/15 p-4 dark:border-dark-primary/15">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{svc.label}</span>
                    <AdminBadge tone={st.tone}>
                      <st.Icon className="h-3.5 w-3.5" />
                      {st.label}
                      {svc.ms != null && <span className="tabular-nums opacity-70">· {svc.ms}ms</span>}
                    </AdminBadge>
                  </div>
                  <p className="mt-2 break-words text-sm">{svc.detail}</p>
                  <p className={`${adminMuted} mt-1 text-xs`}>쓰이는 곳: {svc.usedFor}</p>
                </div>
              );
            })}
          </div>
        )}
        {s && (
          <div className="mt-5 border-t border-light-primary/10 pt-4 dark:border-dark-primary/10">
            <h4 className="text-sm font-semibold">데이터 최신성</h4>
            <p className={`${adminMuted} mt-1 text-xs`}>가장 최근에 들어온 항목의 시각이에요. 수집이 멈췄는지 볼 때 씁니다.</p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-3">
              {s.freshness.map((f) => (
                <li key={f.label} className="rounded-xl bg-light-primary/5 px-3 py-2.5 dark:bg-dark-primary/5">
                  <span className={`${adminMuted} block text-xs`}>{f.label}</span>
                  <span className="mt-0.5 block text-sm font-medium">{f.at ? adminAgo(f.at) : "기록 없음"}</span>
                  {f.at && <span className={`${adminMuted} block text-xs`}>{adminDate(f.at)}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </AdminSection>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* 배포 정보 */}
        <AdminSection title="배포 정보" description="지금 이 화면을 보내 준 서버입니다.">
          {s ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-sm">
              <dt className={adminMuted}>환경</dt>
              <dd className="font-medium">{s.deployment.environment}</dd>
              <dt className={adminMuted}>함수 리전</dt>
              <dd>
                <span className="font-medium">{s.deployment.region ?? "—"}</span>
                {s.deployment.region && s.deployment.region !== "icn1" && (
                  <span className="mt-1 block text-xs text-amber-700 dark:text-amber-300">
                    서울(icn1)이 아니면 치지직 썸네일·방송 상태가 막힐 수 있어요. Vercel 대시보드 → Settings → Functions에서 바꿉니다.
                  </span>
                )}
              </dd>
              <dt className={adminMuted}>배포 커밋</dt>
              <dd className="min-w-0">
                {s.deployment.commit ? (
                  <>
                    <span className="font-mono">{s.deployment.commit}</span>
                    {s.deployment.commitMessage && <span className={`${adminMuted} block truncate text-xs`}>{s.deployment.commitMessage}</span>}
                  </>
                ) : (
                  "—"
                )}
              </dd>
              <dt className={adminMuted}>Node</dt>
              <dd className="font-mono">{s.deployment.node}</dd>
            </dl>
          ) : (
            <div className="h-32 animate-pulse rounded-xl bg-light-primary/10 dark:bg-dark-primary/10" />
          )}
        </AdminSection>

        {/* 채널·외부 소스 */}
        <AdminSection title="채널·외부 소스" description="사이트가 데이터를 가져오는 곳입니다. 바꾸려면 배포 환경변수를 설정하세요.">
          {s ? (
            <ul className="space-y-3">
              {s.channels.map((c) => (
                <li key={c.env} className="min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{c.label}</span>
                    {c.href && (
                      <a href={c.href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-1 text-xs text-purple-700 hover:underline dark:text-purple-300">
                        열기 <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                  <code className="mt-1 block break-all rounded-lg bg-light-primary/5 px-2.5 py-1.5 text-xs dark:bg-dark-primary/10">{c.value}</code>
                  <span className={`${adminMuted} mt-1 block text-xs`}>환경변수 <code>{c.env}</code></span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="h-32 animate-pulse rounded-xl bg-light-primary/10 dark:bg-dark-primary/10" />
          )}
        </AdminSection>
      </div>

      {/* 기능 공개 */}
      <AdminSection
        title="기능 공개"
        description="시범·보류 중인 페이지를 일반 방문자에게 보일지 정합니다. 끄면 관리자가 아닌 사람에게는 '없는 페이지(404)'로 보이고, 관리자는 그대로 미리 볼 수 있어요."
      >
        {settings.data ? (
          <ul className="divide-y divide-light-primary/10 dark:divide-dark-primary/10">
            {FEATURE_KEYS.map((key) => {
              const info = FEATURE_INFO[key];
              const open = settings.data!.features[key];
              const id = `feature-${key}`;
              return (
                <li key={key} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <label htmlFor={id} className="flex flex-wrap items-center gap-2 font-medium">
                      {info.label}
                      <code className="text-xs font-normal text-light-text/55 dark:text-dark-text/55">{info.path}</code>
                      <AdminBadge tone={open ? "ok" : "neutral"}>{open ? "공개 중" : "관리자만"}</AdminBadge>
                    </label>
                    <p className={`${adminMuted} mt-1 text-xs`}>{info.description}</p>
                  </div>
                  <button
                    id={id}
                    role="switch"
                    aria-checked={open}
                    disabled={save.isPending}
                    onClick={() => toggleFeature(key, !open)}
                    className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 disabled:opacity-50 ${
                      open ? "bg-purple-600 dark:bg-purple-500" : "bg-slate-300 dark:bg-slate-600"
                    }`}
                  >
                    <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${open ? "translate-x-6" : "translate-x-1"}`} />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="h-32 animate-pulse rounded-xl bg-light-primary/10 dark:bg-dark-primary/10" />
        )}
      </AdminSection>

      {/* 클립 작업 기본값 */}
      <AdminSection title="클립 작업 기본값" description="라이브 클립 탭에서 처음 채워지는 값입니다. 작업할 때마다 그 자리에서 바꿀 수도 있어요.">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!toleranceDirty) return;
            save.mutate(
              { clipDefaults: { durationTolerance: toleranceValue } },
              { onSuccess: () => showSuccess("저장했어요", `허용 오차 기본값 ${toleranceValue}초`), onError: (err) => showError("저장 실패", err.message) },
            );
          }}
        >
          <label className="block min-w-0 max-w-md flex-1">
            <span className="block text-sm font-medium">기본 길이 일괄 적용 · 허용 오차 (초)</span>
            <span className={`${adminMuted} mt-1 block text-xs`}>
              곡의 기본 클립 길이를 기존 클립에 한꺼번에 적용할 때, 현재 길이와 이만큼 이내로 차이 나는 클립은 손으로 맞춘 것으로 보고 건드리지 않아요.
            </span>
            <input
              type="number"
              min={0}
              max={120}
              step={0.5}
              inputMode="decimal"
              value={tolerance}
              onChange={(e) => setTolerance(e.target.value)}
              aria-invalid={!toleranceValid}
              className={`${adminControl} mt-2 w-32 font-mono`}
            />
          </label>
          <button type="submit" className={adminPrimaryButton} disabled={!toleranceDirty || save.isPending}>
            저장
          </button>
        </form>
      </AdminSection>

      {settings.data?.updatedAt && (
        <p className={`${adminMuted} text-xs`}>
          마지막 변경: {settings.data.updatedBy ?? "—"} · {adminDate(settings.data.updatedAt)}
        </p>
      )}
    </div>
  );
}
