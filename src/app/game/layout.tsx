import type { Metadata } from "next";
import { requireFeature } from "@/domains/operations/feature-gate";

// 기능 공개 스위치(관리자 → 시스템 설정)를 요청마다 확인한다
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "프로젝트 아이 팬게임 | AyaUke",
  description: "허니즈와 아카시아 멤버들로 즐기는 프로젝트 아이 팬메이드 웹게임 페이지입니다.",
  // 아직 외부에 공개하지 않는 페이지이므로 검색엔진 색인 제외
  robots: {
    index: false,
    follow: false,
  },
};

export default async function GameLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireFeature("game");
  return <>{children}</>;
}
