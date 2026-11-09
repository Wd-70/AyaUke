import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/authOptions";
import { isSuperAdmin, UserRole } from "@/lib/permissions";
import {
  listAdminUsers,
  userSortFields,
} from "@/domains/identity/admin-user.service";
const Query = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  search: z.string().trim().max(100).default(""),
  role: z
    .enum([
      "all",
      "super_admin",
      "ayauke_admin",
      "song_admin",
      "song_editor",
      "user",
    ])
    .default("all"),
  sortBy: z.enum(userSortFields).default("lastActivityAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !isSuperAdmin(session.user.role as UserRole))
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  const input = Query.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  if (!input.success)
    return NextResponse.json(
      { error: "검색 조건을 확인해주세요." },
      { status: 400 },
    );
  try {
    return NextResponse.json(await listAdminUsers(input.data), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "사용자 목록을 불러오지 못했습니다." },
      { status: 500 },
    );
  }
}
