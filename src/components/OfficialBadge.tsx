"use client";

import { useId } from "react";

/**
 * 공식 등록곡 인증 배지 — 치지직 파트너 스트리머 배지 스타일.
 * 물결(스캘럽) 씰 + 흰색 체크. 사이트 액센트(퍼플→핑크) 그라데이션으로 조화.
 *
 * 카드에서는 모서리 리본을, 모달/상세에서는 이 체크 배지를 제목 옆에 사용.
 */
export default function OfficialBadge({
  size = 20,
  className = "",
  title = "공식 등록곡",
}: {
  size?: number;
  className?: string;
  title?: string;
}) {
  // 한 페이지에 여러 배지가 떠도 그라데이션 id가 충돌하지 않도록 고유화
  const gradId = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label={title}
      className={className}
    >
      <title>{title}</title>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#E38BFF" />
          <stop offset="100%" stopColor="#E35874" />
        </linearGradient>
      </defs>
      {/* 물결 인증 씰 */}
      <path
        fill={`url(#${gradId})`}
        d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34z"
      />
      {/* 흰색 체크 */}
      <path
        fill="#fff"
        d="M10.05 15.65l-3-3 1.4-1.4 1.6 1.6 4.45-4.45 1.4 1.4z"
      />
    </svg>
  );
}
