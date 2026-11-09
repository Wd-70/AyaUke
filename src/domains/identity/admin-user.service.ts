import { Types } from "mongoose";
import { adminDatabase } from "@/domains/operations/admin-overview.service";
import type { AdminUserView } from "./user.view";
import type { Document } from "mongodb";

export const userSortFields = [
  "lastActivityAt",
  "createdAt",
  "channelName",
  "role",
  "lastLoginAt",
] as const;
export type UserSortField = (typeof userSortFields)[number];
export interface UserListInput {
  page: number;
  limit: number;
  search: string;
  role: string;
  sortBy: UserSortField;
  sortOrder: "asc" | "desc";
}
const safeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Aggregate a whole page at once, joining by immutable User._id rather than display name. */
export async function listAdminUsers(input: UserListInput) {
  const db = await adminDatabase(),
    opts = { maxTimeMS: 15000 };
  const filter: Document = {};
  if (input.search)
    filter.$or = ["channelName", "displayName", "channelId"].map((key) => ({
      [key]: { $regex: safeRegex(input.search), $options: "i" },
    }));
  if (input.role !== "all") filter.role = input.role;
  const totalUsers = await db.collection("users").countDocuments(filter, opts);
  const totalPages = Math.max(1, Math.ceil(totalUsers / input.limit)),
    page = Math.min(input.page, totalPages);
  const pipeline: Document[] = [
    { $match: filter },
    {
      $lookup: {
        from: "useractivities",
        let: { user: "$_id" },
        pipeline: [
          { $match: { $expr: { $eq: ["$userId", "$$user"] } } },
          {
            $group: {
              _id: null,
              lastVisitAt: { $max: "$lastVisitAt" },
              visitDays: { $sum: 1 },
            },
          },
        ],
        as: "visits",
      },
    },
    {
      $set: {
        lastVisitAt: {
          $ifNull: [{ $arrayElemAt: ["$visits.lastVisitAt", 0] }, null],
        },
        visitDays: { $ifNull: [{ $arrayElemAt: ["$visits.visitDays", 0] }, 0] },
      },
    },
    { $set: { lastActivityAt: { $max: ["$lastLoginAt", "$lastVisitAt"] } } },
    { $sort: { [input.sortBy]: input.sortOrder === "asc" ? 1 : -1, _id: 1 } },
    { $skip: (page - 1) * input.limit },
    { $limit: input.limit },
  ];
  for (const [collection, key] of [
    ["likes", "likesCount"],
    ["cliplikes", "clipLikesCount"],
    ["playlists", "playlistsCount"],
    ["clipplaylists", "clipPlaylistsCount"],
    ["songvideos", "addedClipsCount"],
    ["cliprangeproposals", "proposalsCount"],
  ] as const) {
    pipeline.push(
      {
        $lookup: {
          from: collection,
          let: { user: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: [
                    collection === "songvideos" ? "$addedBy" : "$userId",
                    "$$user",
                  ],
                },
              },
            },
            { $count: "total" },
          ],
          as: key,
        },
      },
      {
        $set: {
          [key]: { $ifNull: [{ $arrayElemAt: [`$${key}.total`, 0] }, 0] },
        },
      },
    );
  }
  pipeline.push({
    $project: {
      channelId: 1,
      channelName: 1,
      displayName: 1,
      profileImageUrl: 1,
      role: 1,
      createdAt: 1,
      lastLoginAt: 1,
      activityStats: 1,
      titles: 1,
      selectedTitle: 1,
      lastVisitAt: 1,
      lastActivityAt: 1,
      visitDays: 1,
      likesCount: 1,
      clipLikesCount: 1,
      playlistsCount: 1,
      clipPlaylistsCount: 1,
      addedClipsCount: 1,
      proposalsCount: 1,
    },
  });
  const users = await db
    .collection("users")
    .aggregate(pipeline, opts)
    .toArray();
  const [overview] = await db
    .collection("users")
    .aggregate(
      [
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            admins: { $sum: { $cond: [{ $ne: ["$role", "user"] }, 1, 0] } },
          },
        },
      ],
      opts,
    )
    .toArray();
  return {
    users: users.map((u) => ({ ...u, _id: String(u._id) })),
    overview: { total: overview?.total || 0, admins: overview?.admins || 0 },
    pagination: {
      currentPage: page,
      totalPages,
      totalUsers,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
      limit: input.limit,
    },
  };
}

export async function getAdminUserActivity(id: string) {
  if (!Types.ObjectId.isValid(id)) return null;
  const db = await adminDatabase(),
    userId = new Types.ObjectId(id),
    opts = { maxTimeMS: 15000 };
  if (
    !(await db
      .collection("users")
      .findOne({ _id: userId }, { projection: { _id: 1 }, ...opts }))
  )
    return null;
  const [visits, likes, playlists, contributions] = await Promise.all([
    db
      .collection("useractivities")
      .find(
        { userId },
        { projection: { _id: 0, date: 1, lastVisitAt: 1 }, ...opts },
      )
      .sort({ lastVisitAt: -1 })
      .limit(30)
      .toArray(),
    db
      .collection("cliplikes")
      .aggregate(
        [
          { $match: { userId } },
          { $sort: { createdAt: -1, _id: -1 } },
          { $limit: 50 },
          {
            $lookup: {
              from: "songvideos",
              localField: "clipId",
              foreignField: "_id",
              as: "clip",
            },
          },
          {
            $project: {
              _id: 1,
              createdAt: 1,
              title: { $arrayElemAt: ["$clip.title", 0] },
              artist: { $arrayElemAt: ["$clip.artist", 0] },
              shareId: { $arrayElemAt: ["$clip.shareId", 0] },
            },
          },
        ],
        opts,
      )
      .toArray(),
    db
      .collection("clipplaylists")
      .find(
        { userId },
        {
          projection: {
            name: 1,
            isPublic: 1,
            shareId: 1,
            clips: 1,
            updatedAt: 1,
          },
          ...opts,
        },
      )
      .sort({ updatedAt: -1, _id: -1 })
      .limit(50)
      .toArray(),
    Promise.all([
      db.collection("songvideos").countDocuments({ addedBy: userId }, opts),
      db.collection("cliprangeproposals").countDocuments({ userId }, opts),
      db.collection("cliprangehistories").countDocuments({ userId }, opts),
      db.collection("clipreports").countDocuments({ reportedBy: userId }, opts),
    ]),
  ]);
  return {
    visits,
    clipLikes: likes.map((l) => ({
      id: String(l._id),
      title: l.title || "삭제된 클립",
      subtitle: l.artist || "",
      at: l.createdAt?.toISOString() || null,
      href: l.shareId ? `/clip/${encodeURIComponent(l.shareId)}` : undefined,
    })),
    clipPlaylists: playlists.map((p) => ({
      id: String(p._id),
      title: p.name,
      subtitle: `${p.isPublic ? "공개" : "비공개"} · ${p.clips?.length || 0}개`,
      at: p.updatedAt?.toISOString() || null,
      ...(p.isPublic && p.shareId
        ? { href: `/clip-playlist/${encodeURIComponent(p.shareId)}` }
        : {}),
    })),
    contributions: {
      clips: contributions[0],
      proposals: contributions[1],
      applied: contributions[2],
      reports: contributions[3],
    },
  };
}

export type AdminUserListItem = AdminUserView & {
  lastVisitAt: string | null;
  lastActivityAt: string | null;
  visitDays: number;
  clipLikesCount: number;
  clipPlaylistsCount: number;
  addedClipsCount: number;
  proposalsCount: number;
};
