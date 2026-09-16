"use client";

/**
 * 클립 검증 상태 토글 — 재사용 단위.
 * - useClipVerify: 로직 + 낙관적 로컬 상태. 배지 등 다른 UI와 상태를 공유해야 하는 화면용.
 * - ClipVerifyButton: 프레젠테이션 버튼(제어형). 상태는 훅이 소유.
 * - ClipVerifyControl: 훅+버튼을 묶은 자체완결형. 단일 클립을 독립 토글하는 화면에 드롭인.
 */

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircleIcon, CheckIcon } from "@heroicons/react/24/outline";
import { useToast } from "@/components/Toast";

/**
 * 검증 상태 토글 훅. 낙관적 로컬 상태를 두어, 같은 클립의 refetch가 복제 지연으로
 * 옛 값을 줘도 방금 토글한 값이 되돌아가지 않는다. 다른 클립으로 바뀔 때(clipId 변경)만 동기화.
 */
export function useClipVerify(clipId: string, initialVerified: boolean, onChanged?: () => void) {
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();
  const [verified, setVerified] = useState(!!initialVerified);

  // clipId가 바뀌면(다른 클립 선택) 새 값으로 동기화. 같은 clipId의 prop 변화는 무시 —
  // 방금 토글한 값이 뒤늦은 refetch로 되돌아가지 않도록.
  useEffect(() => {
    setVerified(!!initialVerified);
  }, [clipId]); // eslint-disable-line react-hooks/exhaustive-deps

  const mutation = useMutation({
    mutationFn: async (verify: boolean) => {
      const res = await fetch("/api/admin/clips", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clipId, action: verify ? "verify" : "unverify" }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "검증 상태 변경 실패");
      return verify;
    },
    onSuccess: (verify) => {
      setVerified(verify);
      showSuccess(verify ? "검증 완료" : "검증 해제", `클립이 ${verify ? "검증" : "미검증"} 상태가 되었습니다.`);
      queryClient.invalidateQueries({ queryKey: ["admin-clips"] });
      onChanged?.();
    },
    onError: (e: Error) => showError("실패", e.message),
  });

  return { verified, toggle: () => mutation.mutate(!verified), isPending: mutation.isPending };
}

interface ButtonProps {
  verified: boolean;
  onToggle: () => void;
  isPending?: boolean;
  size?: "sm" | "md";
  className?: string;
}

/** 검증 토글 버튼 (제어형). 상태/로직은 useClipVerify가 소유. */
export default function ClipVerifyButton({
  verified,
  onToggle,
  isPending = false,
  size = "md",
  className = "",
}: ButtonProps) {
  const sizeClass = size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm";
  const iconClass = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={isPending}
      className={`inline-flex items-center gap-1.5 rounded-lg transition-colors disabled:opacity-50 ${sizeClass} ${
        verified
          ? "border border-light-primary/30 dark:border-dark-primary/30 text-light-text/70 dark:text-dark-text/70 hover:bg-light-primary/10 dark:hover:bg-dark-primary/20"
          : "bg-blue-600 hover:bg-blue-700 text-white"
      } ${className}`}
      title={verified ? "검증 상태를 해제합니다" : "확인 완료된 클립으로 표시합니다"}
    >
      {verified ? <CheckIcon className={iconClass} /> : <CheckCircleIcon className={iconClass} />}
      {verified ? "검증 해제" : "검증 완료"}
    </button>
  );
}

interface ControlProps {
  clipId: string;
  isVerified: boolean;
  onChanged?: () => void;
  size?: "sm" | "md";
  className?: string;
}

/** 훅+버튼을 묶은 자체완결형 — 단일 클립을 독립적으로 토글하는 화면용 드롭인. */
export function ClipVerifyControl({ clipId, isVerified, onChanged, size, className }: ControlProps) {
  const { verified, toggle, isPending } = useClipVerify(clipId, isVerified, onChanged);
  return (
    <ClipVerifyButton verified={verified} onToggle={toggle} isPending={isPending} size={size} className={className} />
  );
}
