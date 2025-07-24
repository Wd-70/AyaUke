import mongoose from "mongoose";

export interface IUser extends mongoose.Document {
  channelId: string;
  channelName: string;
  displayName: string;
  profileImageUrl?: string;
  role: "super_admin" | "ayauke_admin" | "song_admin" | "song_editor" | "user";
  grantedBy?: string;
  grantedAt?: Date;
  createdAt: Date;
  lastLoginAt: Date;
  channelNameHistory: Array<{
    channelName: string;
    changedAt: Date;
    source: "login" | "initial";
  }>;
  titles: Array<{
    id: string;
    name: string;
    description: string;
    earnedAt: Date;
    condition: string;
    rarity: "common" | "rare" | "epic" | "legendary";
  }>;
  selectedTitle: string | null;
  preferences: {
    theme: "light" | "dark" | "system";
    defaultPlaylistView: "grid" | "list";
  };
  // 활동 통계 (요약 데이터만 저장)
  activityStats: {
    totalLoginDays: number; // 총 로그인한 날 수
    currentStreak: number; // 현재 연속 접속일
    longestStreak: number; // 최장 연속 접속일 기록
    lastVisitDate: string; // 마지막 방문 날짜 (YYYY-MM-DD)
  };
}

const userSchema = new mongoose.Schema<IUser>(
  {
    channelId: {
      type: String,
      required: true,
      unique: true,
    },
    channelName: {
      type: String,
      required: true,
    },
    displayName: {
      type: String,
      required: false,
    },
    profileImageUrl: {
      type: String,
      default: null,
    },
    role: {
      type: String,
      enum: ["super_admin", "song_admin", "song_editor", "user"],
      default: "user",
    },
    grantedBy: {
      type: String,
      default: null,
    },
    grantedAt: {
      type: Date,
      default: null,
    },
    lastLoginAt: {
      type: Date,
      default: Date.now,
    },
    channelNameHistory: [
      {
        channelName: {
          type: String,
          required: true,
        },
        changedAt: {
          type: Date,
          default: Date.now,
        },
        source: {
          type: String,
          enum: ["login", "initial"],
          required: true,
        },
      },
    ],
    titles: [
      {
        id: {
          type: String,
          required: true,
        },
        name: {
          type: String,
          required: true,
        },
        description: {
          type: String,
          required: true,
        },
        earnedAt: {
          type: Date,
          default: Date.now,
        },
        condition: {
          type: String,
          required: true,
        },
        rarity: {
          type: String,
          enum: ["common", "rare", "epic", "legendary"],
          required: true,
        },
      },
    ],
    selectedTitle: {
      type: String,
      default: null,
    },
    preferences: {
      theme: {
        type: String,
        enum: ["light", "dark", "system"],
        default: "system",
      },
      defaultPlaylistView: {
        type: String,
        enum: ["grid", "list"],
        default: "grid",
      },
    },
    activityStats: {
      totalLoginDays: {
        type: Number,
        default: 0,
      },
      currentStreak: {
        type: Number,
        default: 0,
      },
      longestStreak: {
        type: Number,
        default: 0,
      },
      lastVisitDate: {
        type: String,
        default: null,
      },
    },
  },
  {
    timestamps: true,
  }
);

// 인덱스 추가 (channelId는 unique: true로 자동 인덱스 생성됨)
userSchema.index({ role: 1 });

export default mongoose.models.User ||
  mongoose.model<IUser>("User", userSchema);
