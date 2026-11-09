import { connectDB } from "@/shared/db/mongodb";
import type { AdminOverview, RecentAdminRecord } from "./admin-overview";
export async function adminDatabase() {
  const connection = await connectDB(),
    db = connection.connection.db;
  if (!db) throw new Error("데이터베이스 연결 실패");
  return db;
}
const iso = (value: unknown) =>
  value instanceof Date
    ? value.toISOString()
    : typeof value === "string"
      ? value
      : null;
export async function getAdminOverview(
  superAdmin: boolean,
  period: { start?: Date; end?: Date },
): Promise<AdminOverview> {
  const db = await adminDatabase(),
    opts = { maxTimeMS: 15000 };
  const count = (name: string, filter = {}) =>
    db.collection(name).countDocuments(filter, opts);
  const catalog = {
    status: { $ne: "deleted" },
    $or: [
      { sourceType: { $in: ["sheet", "admin"] } },
      { sourceType: { $exists: false } },
    ],
  };
  const eligible = { isRelevant: true, isExcluded: { $ne: true } };
  const periodFilter = period.start
    ? { createdAt: { $gte: period.start, $lt: period.end! } }
    : {};
  const [
    songs,
    mr,
    duration,
    users,
    clips,
    playable,
    verified,
    songLikes,
    clipLikes,
    songPlaylists,
    clipPlaylists,
    unavailable,
    reports,
    proposals,
    newUsers,
    newClips,
    newSongLikes,
    newClipLikes,
    newSongLists,
    newClipLists,
    unmatched,
    matchedUnverified,
    aiUnverified,
  ] = await Promise.all([
    count("songdetails", catalog),
    count("songdetails", { ...catalog, "mrLinks.0": { $exists: true } }),
    count("songdetails", { ...catalog, clipDuration: { $gt: 0 } }),
    count("users"),
    count("songvideos"),
    count("songvideos", { sourceUnavailable: { $ne: true } }),
    count("songvideos", { isVerified: true }),
    count("likes"),
    count("cliplikes"),
    count("playlists"),
    count("clipplaylists"),
    count("songvideos", { sourceUnavailable: true }),
    count("clipreports", { status: "pending" }),
    count("cliprangeproposals", {
      status: "active",
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } },
      ],
    }),
    count("users", periodFilter),
    count("songvideos", periodFilter),
    count("likes", periodFilter),
    count("cliplikes", periodFilter),
    count("playlists", periodFilter),
    count("clipplaylists", periodFilter),
    superAdmin
      ? count("parsedtimelines", {
          ...eligible,
          "matchedSong.songId": { $in: [null, ""] },
        })
      : 0,
    superAdmin
      ? count("parsedtimelines", {
          ...eligible,
          "matchedSong.songId": { $nin: [null, ""] },
          isTimeVerified: { $ne: true },
        })
      : 0,
    superAdmin
      ? count("parsedtimelines", {
          ...eligible,
          aiTiming: { $ne: null },
          isTimeVerified: { $ne: true },
        })
      : 0,
  ]);
  const [recentClips, recentUsers, lists, likes, videos] = await Promise.all([
    db
      .collection("songvideos")
      .find(
        {},
        {
          projection: { title: 1, artist: 1, createdAt: 1, shareId: 1 },
          ...opts,
        },
      )
      .sort({ createdAt: -1, _id: -1 })
      .limit(5)
      .toArray(),
    superAdmin
      ? db
          .collection("users")
          .find(
            {},
            {
              projection: { displayName: 1, channelName: 1, createdAt: 1 },
              ...opts,
            },
          )
          .sort({ createdAt: -1, _id: -1 })
          .limit(5)
          .toArray()
      : [],
    db
      .collection("playlists")
      .aggregate(
        [
          { $match: { isPublic: true } },
          {
            $project: {
              name: 1,
              updatedAt: 1,
              shareId: 1,
              kind: { $literal: "곡" },
            },
          },
          {
            $unionWith: {
              coll: "clipplaylists",
              pipeline: [
                { $match: { isPublic: true } },
                {
                  $project: {
                    name: 1,
                    updatedAt: 1,
                    shareId: 1,
                    kind: { $literal: "클립" },
                  },
                },
              ],
            },
          },
          { $sort: { updatedAt: -1, _id: -1 } },
          { $limit: 5 },
        ],
        opts,
      )
      .toArray(),
    db
      .collection("likes")
      .aggregate(
        [
          {
            $project: {
              target: "$songId",
              createdAt: 1,
              kind: { $literal: "곡" },
            },
          },
          {
            $unionWith: {
              coll: "cliplikes",
              pipeline: [
                {
                  $project: {
                    target: "$clipId",
                    createdAt: 1,
                    kind: { $literal: "클립" },
                  },
                },
              ],
            },
          },
          { $sort: { createdAt: -1, _id: -1 } },
          { $limit: 5 },
          {
            $lookup: {
              from: "songdetails",
              localField: "target",
              foreignField: "_id",
              as: "song",
            },
          },
          {
            $lookup: {
              from: "songvideos",
              localField: "target",
              foreignField: "_id",
              as: "clip",
            },
          },
          {
            $project: {
              createdAt: 1,
              kind: 1,
              title: {
                $ifNull: [
                  { $arrayElemAt: ["$song.title", 0] },
                  { $arrayElemAt: ["$clip.title", 0] },
                ],
              },
              artist: {
                $ifNull: [
                  { $arrayElemAt: ["$song.artist", 0] },
                  { $arrayElemAt: ["$clip.artist", 0] },
                ],
              },
            },
          },
        ],
        opts,
      )
      .toArray(),
    superAdmin
      ? db
          .collection("parsedtimelines")
          .aggregate(
            [
              { $match: eligible },
              {
                $group: {
                  _id: { platform: "$platform", videoId: "$videoId" },
                  title: { $first: "$videoTitle" },
                  total: { $sum: 1 },
                  verified: { $sum: { $cond: ["$isTimeVerified", 1, 0] } },
                  unmatched: {
                    $sum: {
                      $cond: [
                        {
                          $in: [
                            { $ifNull: ["$matchedSong.songId", ""] },
                            ["", null],
                          ],
                        },
                        1,
                        0,
                      ],
                    },
                  },
                  at: { $max: "$updatedAt" },
                },
              },
              { $match: { $expr: { $lt: ["$verified", "$total"] } } },
              { $sort: { at: -1 } },
              { $limit: 3 },
            ],
            opts,
          )
          .toArray()
      : [],
  ]);
  const record = (
    id: unknown,
    title: unknown,
    subtitle: string,
    at: unknown,
    href?: string,
  ): RecentAdminRecord => ({
    id: String(id),
    title: String(title || "제목 없음"),
    subtitle,
    at: iso(at),
    ...(href ? { href } : {}),
  });
  return {
    generatedAt: new Date().toISOString(),
    canManageUsers: superAdmin,
    totals: {
      songs,
      mr,
      duration,
      users,
      clips,
      playable,
      verified,
      songLikes,
      clipLikes,
      songPlaylists,
      clipPlaylists,
    },
    period: {
      users: newUsers,
      clips: newClips,
      songLikes: newSongLikes,
      clipLikes: newClipLikes,
      playlists: newSongLists + newClipLists,
    },
    work: {
      unavailable,
      reports,
      proposals,
      timelines: superAdmin
        ? { unmatched, matchedUnverified, aiUnverified }
        : null,
      videos: videos.map((v) => ({
        id: `${v._id.platform}-${v._id.videoId}`,
        title: v.title || v._id.videoId,
        total: v.total,
        verified: v.verified,
        unmatched: v.unmatched,
        at: iso(v.at),
      })),
    },
    recent: {
      clips: recentClips.map((c) =>
        record(
          c._id,
          c.title,
          c.artist || "",
          c.createdAt,
          c.shareId ? `/clip/${encodeURIComponent(c.shareId)}` : undefined,
        ),
      ),
      users: recentUsers.map((u) =>
        record(u._id, u.displayName || u.channelName, "가입", u.createdAt),
      ),
      playlists: lists.map((p) =>
        record(
          `${p.kind}-${p._id}`,
          p.name,
          `공개 ${p.kind} 플레이리스트 · 최근 수정`,
          p.updatedAt,
          p.shareId
            ? `${p.kind === "곡" ? "/playlist/" : "/clip-playlist/"}${encodeURIComponent(p.shareId)}`
            : undefined,
        ),
      ),
      likes: likes.map((l) =>
        record(
          `${l.kind}-${l._id}`,
          l.title || "삭제된 항목",
          `${l.kind} 좋아요 · ${l.artist || ""}`,
          l.createdAt,
        ),
      ),
    },
  };
}
