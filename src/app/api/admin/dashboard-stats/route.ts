import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { canAccessAdminPanel, isSuperAdmin, UserRole } from "@/lib/permissions";
import { adminPeriod } from "@/domains/operations/admin-overview";
import { getAdminOverview } from "@/domains/operations/admin-overview.service";
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !canAccessAdminPanel(session.user.role as UserRole))
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  let period;
  try {
    period = adminPeriod(request.nextUrl.searchParams);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 },
    );
  }
  try {
    return NextResponse.json(
      await getAdminOverview(
        isSuperAdmin(session.user.role as UserRole),
        period,
      ),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "운영 현황을 불러오지 못했습니다." },
      { status: 500 },
    );
  }
}
