import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import { GET as dashboard } from "@/app/api/admin/dashboard-stats/route";
import { GET as users } from "@/app/api/admin/users/route";
import { GET as activity } from "@/app/api/admin/users/[userId]/activity/route";
import { getAdminOverview } from "./admin-overview.service";
import {
  getAdminUserActivity,
  listAdminUsers,
} from "@/domains/identity/admin-user.service";
vi.mock("next-auth/next", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/authOptions", () => ({ authOptions: {} }));
vi.mock("./admin-overview.service", () => ({ getAdminOverview: vi.fn() }));
vi.mock("@/domains/identity/admin-user.service", () => ({
  listAdminUsers: vi.fn(),
  getAdminUserActivity: vi.fn(),
  userSortFields: [
    "lastActivityAt",
    "createdAt",
    "channelName",
    "role",
    "lastLoginAt",
  ],
}));
const request = (path: string) =>
  new NextRequest(`https://test.example${path}`);
const context = {
  params: Promise.resolve({ userId: "507f1f77bcf86cd799439011" }),
};
beforeEach(() => {
  vi.resetAllMocks();
});
const session = (role: string) =>
  vi.mocked(getServerSession).mockResolvedValue({ user: { role } } as never);
describe("admin API access and input validation", () => {
  it("blocks unauthenticated requests before any data query", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    expect((await dashboard(request("/dashboard"))).status).toBe(403);
    expect((await users(request("/users"))).status).toBe(403);
    expect((await activity(request("/activity"), context)).status).toBe(403);
    expect(getAdminOverview).not.toHaveBeenCalled();
    expect(listAdminUsers).not.toHaveBeenCalled();
    expect(getAdminUserActivity).not.toHaveBeenCalled();
  });
  it("permits summary-only dashboard for song editors but no personal user records", async () => {
    session("song_editor");
    vi.mocked(getAdminOverview).mockResolvedValue({} as never);
    expect((await dashboard(request("/dashboard"))).status).toBe(200);
    expect(getAdminOverview).toHaveBeenCalledWith(false, {});
    expect((await users(request("/users"))).status).toBe(403);
    expect((await activity(request("/activity"), context)).status).toBe(403);
  });
  it.each([
    "limit=100000",
    "page=-1",
    "sortBy=password",
    "role=unknown",
    "search=" + "x".repeat(101),
  ])("rejects unsafe user query %s", async (query) => {
    session("super_admin");
    expect((await users(request(`/users?${query}`))).status).toBe(400);
    expect(listAdminUsers).not.toHaveBeenCalled();
  });
  it("validates custom dates and sends no-store responses", async () => {
    session("super_admin");
    expect(
      (
        await dashboard(
          request("/dashboard?period=custom&start=2026-02-30&end=2026-03-01"),
        )
      ).status,
    ).toBe(400);
    vi.mocked(getAdminOverview).mockResolvedValue({} as never);
    const response = await dashboard(request("/dashboard?period=90"));
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(getAdminOverview).toHaveBeenCalledWith(
      true,
      expect.objectContaining({ start: expect.any(Date) }),
    );
  });
  it("defaults users to full-history activity ordering and returns 404 for missing detail", async () => {
    session("super_admin");
    vi.mocked(listAdminUsers).mockResolvedValue({} as never);
    expect((await users(request("/users"))).status).toBe(200);
    expect(listAdminUsers).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        limit: 20,
        sortBy: "lastActivityAt",
        sortOrder: "desc",
      }),
    );
    vi.mocked(getAdminUserActivity).mockResolvedValue(null);
    expect((await activity(request("/activity"), context)).status).toBe(404);
  });
});
