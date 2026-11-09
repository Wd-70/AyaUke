import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { getAdminOverview } from "./admin-overview.service";
import {
  getAdminUserActivity,
  listAdminUsers,
} from "@/domains/identity/admin-user.service";
vi.mock("@/shared/db/mongodb", () => ({
  connectDB: async () => {
    const { default: connection } = await import("mongoose");
    return connection;
  },
}));
let server: MongoMemoryServer;
const userId = new mongoose.Types.ObjectId(),
  otherId = new mongoose.Types.ObjectId(),
  songId = new mongoose.Types.ObjectId(),
  clipId = new mongoose.Types.ObjectId();
const old = new Date("2025-07-12T00:00:00Z"),
  recent = new Date("2026-11-01T00:00:00Z");
beforeAll(async () => {
  // Disposable DB only. Never read workspace credentials or production data.
  server = await MongoMemoryServer.create();
  await mongoose.connect(server.getUri());
  const db = mongoose.connection.db!;
  await Promise.all([
    db.collection("users").insertMany([
      {
        _id: userId,
        channelName: "owner.*",
        channelId: "one",
        role: "super_admin",
        createdAt: old,
        lastLoginAt: old,
      },
      {
        _id: otherId,
        channelName: "other",
        channelId: "two",
        role: "user",
        createdAt: recent,
        lastLoginAt: recent,
      },
    ]),
    db
      .collection("useractivities")
      .insertOne({
        userId,
        date: "2026-11-05",
        lastVisitAt: new Date("2026-11-05T00:00:00Z"),
      }),
    db.collection("songdetails").insertMany([
      {
        _id: songId,
        title: "옛 곡",
        artist: "가수",
        mrLinks: [{ url: "mr" }],
        clipDuration: 240,
      },
      { title: "새 곡", status: "active" },
      { title: "삭제", status: "deleted" },
    ]),
    db.collection("songvideos").insertMany([
      {
        _id: clipId,
        title: "클립",
        artist: "가수",
        addedBy: userId,
        shareId: "clip-share",
        createdAt: old,
        isVerified: true,
      },
      {
        title: "재생 불가",
        addedBy: userId,
        createdAt: recent,
        sourceUnavailable: true,
      },
    ]),
    db.collection("likes").insertOne({ userId, songId, createdAt: old }),
    db.collection("cliplikes").insertOne({ userId, clipId, createdAt: old }),
    db
      .collection("playlists")
      .insertOne({
        userId,
        name: "곡 목록",
        isPublic: true,
        shareId: "song-list",
        updatedAt: old,
        createdAt: old,
      }),
    db.collection("clipplaylists").insertMany([
      {
        userId,
        name: "공개 클립 목록",
        isPublic: true,
        shareId: "clip-list",
        updatedAt: recent,
        createdAt: old,
        clips: [{ clipId }],
      },
      {
        userId,
        name: "비공개 클립 목록",
        isPublic: false,
        updatedAt: recent,
        createdAt: old,
        clips: [],
      },
    ]),
    db.collection("parsedtimelines").insertMany([
      {
        isRelevant: true,
        isExcluded: false,
        platform: "youtube",
        videoId: "a",
        videoTitle: "진행중",
        updatedAt: recent,
      },
      {
        isRelevant: true,
        matchedSong: { songId: String(songId) },
        isTimeVerified: false,
        aiTiming: { status: "adjusted" },
        videoId: "a",
        platform: "youtube",
        updatedAt: recent,
      },
      { isRelevant: true, isExcluded: true, videoId: "b" },
    ]),
    db.collection("cliprangeproposals").insertMany([
      { userId, status: "active", expiresAt: new Date("2020-01-01") },
      { userId, status: "active" },
    ]),
  ]);
}, 60000);
afterAll(async () => {
  await mongoose.disconnect();
  await server?.stop();
});
describe("admin read models", () => {
  it("counts legacy songs, separate engagement, and eligible timeline work", async () => {
    const data = await getAdminOverview(true, {});
    expect(data.totals).toMatchObject({
      songs: 2,
      mr: 1,
      duration: 1,
      clips: 2,
      playable: 1,
      verified: 1,
      songLikes: 1,
      clipLikes: 1,
      songPlaylists: 1,
      clipPlaylists: 2,
    });
    expect(data.work.timelines).toEqual({
      unmatched: 1,
      matchedUnverified: 1,
      aiUnverified: 1,
    });
    expect(data.work.proposals).toBe(1);
    expect(data.recent.playlists).toHaveLength(2);
    expect(data.recent.playlists.some((p) => p.title.includes("비공개"))).toBe(
      false,
    );
    expect(data.recent.clips.find((c) => c.title === "클립")?.href).toBe(
      "/clip/clip-share",
    );
  });
  it("filters only period additions, never totals or latest records", async () => {
    const data = await getAdminOverview(true, {
      start: new Date("2026-10-01"),
      end: new Date("2026-12-01"),
    });
    expect(data.period).toEqual({
      users: 1,
      clips: 1,
      songLikes: 0,
      clipLikes: 0,
      playlists: 0,
    });
    expect(data.totals.clips).toBe(2);
    expect(data.recent.likes).toHaveLength(2);
  });
  it("does not return user identities or workflow detail to other admin roles", async () => {
    const data = await getAdminOverview(false, {});
    expect(data.recent.users).toEqual([]);
    expect(data.work.timelines).toBeNull();
    expect(data.work.videos).toEqual([]);
  });
  it("sorts by latest recorded activity, aggregates by id and clamps pages", async () => {
    const result = await listAdminUsers({
      page: 99,
      limit: 20,
      search: "",
      role: "all",
      sortBy: "lastActivityAt",
      sortOrder: "desc",
    });
    expect(result.pagination.currentPage).toBe(1);
    expect(result.users[0]).toMatchObject({
      _id: String(userId),
      visitDays: 1,
      likesCount: 1,
      clipLikesCount: 1,
      clipPlaylistsCount: 2,
      addedClipsCount: 2,
    });
    expect(result.overview).toEqual({ total: 2, admins: 1 });
  });
  it("treats search metacharacters literally and handles no results", async () => {
    const input = {
      page: 1,
      limit: 20,
      search: ".*",
      role: "all",
      sortBy: "createdAt" as const,
      sortOrder: "desc" as const,
    };
    expect((await listAdminUsers(input)).users).toHaveLength(1);
    expect(
      (await listAdminUsers({ ...input, search: "absent" })).pagination,
    ).toMatchObject({ totalUsers: 0, totalPages: 1 });
  });
  it("limits user detail and never exposes private links or note content", async () => {
    const data = await getAdminUserActivity(String(userId));
    expect(data?.visits).toHaveLength(1);
    expect(data?.clipLikes[0].href).toBe("/clip/clip-share");
    expect(
      data?.clipPlaylists.find((p) => p.title.includes("비공개"))?.href,
    ).toBeUndefined();
    expect(data?.contributions.clips).toBe(2);
    expect(await getAdminUserActivity("invalid")).toBeNull();
    expect(
      await getAdminUserActivity(String(new mongoose.Types.ObjectId())),
    ).toBeNull();
  });
});
