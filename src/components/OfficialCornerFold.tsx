"use client";

import { useId } from "react";

/**
 * 공식 등록곡 — 카드 좌상단 "접힌 코너" 표식.
 * 텍스트 없이 액센트색 삼각 + 접힘 음영선만. 공식곡이 다수여도 도배감이 적도록 절제.
 * 카드(rounded-xl + overflow-hidden) 안에 두면 삼각 꼭짓점이 카드의 둥근 모서리를 따라간다.
 * 명시적 의미(체크)는 모달의 OfficialBadge가 담당.
 */
export default function OfficialCornerFold({
  size = 30,
  className = "",
  title = "공식 등록곡 (스트리머 노래책)",
}: {
  size?: number;
  className?: string;
  title?: string;
}) {
  const gradId = useId();
  return (
    <div
      className={`absolute top-0 left-0 z-10 pointer-events-none ${className}`}
      title={title}
    >
      <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label={title}>
        <title>{title}</title>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#E38BFF" />
            <stop offset="100%" stopColor="#E35874" />
          </linearGradient>
        </defs>
        {/* 좌상단 코너를 채우는 삼각 */}
        <path d="M0 0 H32 L0 32 Z" fill={`url(#${gradId})`} opacity="0.9" />
        {/* 접힘선(빗변)에 옅은 음영 → 살짝 접힌 느낌 */}
        <line x1="32" y1="0" x2="0" y2="32" stroke="rgba(0,0,0,0.18)" strokeWidth="1" />
      </svg>
    </div>
  );
}
