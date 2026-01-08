import mongoose from "mongoose";
import User, { IUser } from "@/models/User";
import { getStaticUserRole } from "@/lib/adminChannels";
import { checkForNewTitles, grantTitle, UserStats } from "@/lib/titleSystem";

/**
 * 사용자 생성 또는 업데이트 (로그인 시 호출)
 */
export async function createOrUpdateUser(userData: {
  channelId: string;
  channelName: string;
  profileImageUrl?: string;
}): Promise<IUser> {
  try {
    const staticRole = getStaticUserRole(userData.channelId);

    // 기존 사용자 찾기
    let user = await User.findOne({ channelId: userData.channelId });

    if (user) {
      // 기존 사용자 업데이트
      const oldChannelName = user.channelName;
      const newChannelName = userData.channelName;

      // channelName 변경 감지 및 이력 추가
      if (oldChannelName !== newChannelName) {
        user.channelNameHistory.push({
          channelName: newChannelName,
          changedAt: new Date(),
          source: "login",
        });
        console.log(
          `치지직 채널명 변경 감지: ${oldChannelName} → ${newChannelName}`
        );
      }

      user.channelName = newChannelName;
      // displayName이 없으면 channelName으로 설정하지 않음 (프로필 수정 시에만 생성)
      user.profileImageUrl = userData.profileImageUrl || user.profileImageUrl;

      // 정적 권한이 현재 권한보다 높으면 업데이트
      // if (staticRole !== 'user' && (user.role === 'user' || staticRole === 'super_admin')) {
      //   user.role = staticRole
      //   console.log(`사용자 권한 업데이트: ${userData.channelName} → ${staticRole}`)
      // }

      user.lastLoginAt = new Date();

      // 기존 사용자의 칭호 필드가 없으면 초기화
      if (!user.titles) {
        user.titles = [];
      }
      if (user.selectedTitle === undefined) {
        user.selectedTitle = null;
      }

      // 칭호 체크 및 부여
      await checkAndGrantTitles(user);

      const savedUser = await user.save();
      console.log(
        `기존 사용자 업데이트: ${userData.channelName} (${userData.channelId})`
      );

      // 저장 후 실제 DB 상태 확인
      console.log("🏆 저장 후 DB 상태:", {
        titlesCount: savedUser.titles?.length || 0,
        selectedTitle: savedUser.selectedTitle,
        titles: savedUser.titles?.map((t: any) => t.name) || [],
      });

      // DB에서 다시 조회해서 실제 저장 확인
      const reloadedUser = await User.findOne({
        channelId: userData.channelId,
      });
      console.log("🏆 DB 재조회 결과:", {
        titlesCount: reloadedUser?.titles?.length || 0,
        selectedTitle: reloadedUser?.selectedTitle,
        titles: reloadedUser?.titles?.map((t: any) => t.name) || [],
      });
    } else {
      // 새 사용자 생성
      user = new User({
        channelId: userData.channelId,
        channelName: userData.channelName,
        displayName: userData.channelName, // 가입시 channelName을 displayName으로 설정
        profileImageUrl: userData.profileImageUrl,
        role: staticRole,
        lastLoginAt: new Date(),
        channelNameHistory: [
          {
            channelName: userData.channelName,
            changedAt: new Date(),
            source: "initial",
          },
        ],
        titles: [], // 빈 칭호 배열로 초기화
        selectedTitle: null,
        preferences: {
          theme: "system",
          defaultPlaylistView: "grid",
        },
      });

      // 신규 사용자 칭호 체크 및 부여
      await checkAndGrantTitles(user);

      await user.save();
      console.log(
        `새 사용자 생성: ${userData.channelName} (${userData.channelId}) - 권한: ${staticRole}`
      );
    }

    return user;
  } catch (error) {
    console.error("사용자 생성/업데이트 오류:", error);
    throw error;
  }
}

/**
 * 사용자 정보 조회
 */
export async function getUserByChannelId(
  channelId: string
): Promise<IUser | null> {
  try {
    return await User.findOne({ channelId });
  } catch (error) {
    console.error("사용자 조회 오류:", error);
    return null;
  }
}

/**
 * 사용자 환경설정 업데이트
 */
export async function updateUserPreferences(
  channelId: string,
  preferences: Partial<IUser["preferences"]>
) {
  try {
    const user = await User.findOne({ channelId });
    if (!user) return null;

    user.preferences = { ...user.preferences, ...preferences };
    await user.save();

    return user;
  } catch (error) {
    console.error("사용자 환경설정 업데이트 오류:", error);
    return null;
  }
}

/**
 * 관리자 목록 조회
 */
export async function getAdminUsers(): Promise<IUser[]> {
  try {
    return await User.find({ role: { $ne: "user" } }).sort({ lastLoginAt: -1 });
  } catch (error) {
    console.error("관리자 목록 조회 오류:", error);
    return [];
  }
}

/**
 * 활성 사용자 통계
 */
export async function getUserStats() {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({
      lastLoginAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // 30일 내
    });
    const adminUsers = await User.countDocuments({ role: { $ne: "user" } });

    return {
      totalUsers,
      activeUsers,
      adminUsers,
    };
  } catch (error) {
    console.error("사용자 통계 조회 오류:", error);
    return {
      totalUsers: 0,
      activeUsers: 0,
      adminUsers: 0,
    };
  }
}

/**
 * 사용자 통계 수집
 */
async function getUserStatsForTitles(user: IUser): Promise<UserStats> {
  try {
    // Like 모델에서 해당 사용자의 좋아요 수 조회
    const Like = (await import("@/models/Like")).default;
    const likeCount = await Like.countDocuments({ userId: user._id });

    // Playlist 모델에서 해당 사용자의 플레이리스트 수 조회
    const Playlist = (await import("@/models/Playlist")).default;
    const playlistCount = await Playlist.countDocuments({ userId: user._id });

    // 실제 활동 통계 사용 (activityStats가 없으면 기본값)
    const activityStats = user.activityStats || {
      totalLoginDays: 1,
      currentStreak: 1,
      longestStreak: 1,
      lastVisitDate: null,
    };

    return {
      likeCount,
      playlistCount,
      loginCount: activityStats.totalLoginDays,
      consecutiveDays: activityStats.currentStreak,
    };
  } catch (error) {
    console.error("사용자 통계 수집 오류:", error);
    return {
      likeCount: 0,
      playlistCount: 0,
      loginCount: 1,
      consecutiveDays: 1,
    };
  }
}

/**
 * 사용자 칭호 체크 및 부여
 */
async function checkAndGrantTitles(user: IUser): Promise<void> {
  try {
    // 기존 칭호가 없으면 빈 배열로 초기화
    if (!user.titles) {
      user.titles = [];
    }
    if (user.selectedTitle === undefined) {
      user.selectedTitle = null;
    }

    // 사용자 통계 수집
    const stats = await getUserStatsForTitles(user);

    // 새로 획득할 수 있는 칭호 확인
    const newTitleDefs = checkForNewTitles(user, stats);

    // 새 칭호 부여
    let grantedCount = 0;
    for (const titleDef of newTitleDefs) {
      if (grantTitle(user, titleDef)) {
        grantedCount++;
        console.log(`칭호 부여: ${user.channelName} → ${titleDef.name}`);
        // Mongoose가 배열 변경을 감지하도록 명시적으로 표시
        user.markModified("titles");
        user.markModified("selectedTitle");
      }
    }

    if (grantedCount > 0) {
      console.log(`총 ${grantedCount}개의 새로운 칭호를 부여했습니다`);
      console.log("🏆 현재 사용자 칭호 상태:", {
        titlesCount: user.titles.length,
        selectedTitle: user.selectedTitle,
        titles: user.titles.map((t) => t.name),
      });
    }
  } catch (error) {
    console.error("칭호 체크 및 부여 오류:", error);
  }
}
