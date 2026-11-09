import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { isSuperAdmin, UserRole } from "@/lib/permissions";
import { getAdminUserActivity } from "@/domains/identity/admin-user.service";
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session || !isSuperAdmin(session.user.role as UserRole))
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  try {
    const result = await getAdminUserActivity((await params).userId);
    return result
      ? NextResponse.json(result, {
          headers: { "Cache-Control": "private, no-store" },
        })
      : NextResponse.json(
          { error: "사용자를 찾을 수 없습니다." },
          { status: 404 },
        );
  } catch {
    return NextResponse.json(
      { error: "활동 기록을 불러오지 못했습니다." },
      { status: 500 },
    );
  }
}
