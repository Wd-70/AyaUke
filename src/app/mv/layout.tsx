import type { ReactNode } from "react";
import { requireFeature } from "@/domains/operations/feature-gate";

// 기능 공개 스위치(관리자 → 시스템 설정)를 요청마다 확인한다
export const dynamic = "force-dynamic";

export default async function FeatureLayout({ children }: { children: ReactNode }) {
  await requireFeature("mv");
  return <>{children}</>;
}
