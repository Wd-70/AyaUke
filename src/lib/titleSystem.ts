import { IUser } from "@/models/User";
import { config } from "@/shared/config";

export interface TitleDefinition {
  id: string;
  name: string;
  description: string;
  condition: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  checkCondition: (user: IUser, stats?: any) => boolean;
  autoGrant: boolean; // 자동 부여 여부
}

export interface UserStats {
  likeCount: number;
  playlistCount: number;
  loginCount: number;
  consecutiveDays: number;
}

// 칭호 정의들
export const TITLE_DEFINITIONS: TitleDefinition[] = [
  // 관리자 칭호 (기존 role 기반)
  {
    id: "super_admin",
    name: "최고 관리자",
    description: "사이트의 모든 권한을 가진 최고 관리자입니다",
    condition: "사이트 관리자 권한 보유",
    rarity: "legendary",
    checkCondition: (user) => user.role === "super_admin",
    autoGrant: true,
  },
  {
    id: "ayauke_admin",
    name: "아야냥이",
    description: "스트리머 아야에게 부여되는 특별한 칭호입니다",
    condition: "사이트를 선물받은 스트리머",
    rarity: "epic",
    checkCondition: (user) => user.role === "ayauke_admin",
    autoGrant: true,
  },
  {
    id: "honeyz",
    name: "HONEYZ",
    description: "허니즈에게 부여되는 칭호입니다",
    condition: "허니즈 소속 스트리머",
    rarity: "epic",
    checkCondition: (user) => config.honeyzChannelIds.includes(user.channelId),
    autoGrant: true,
  },
  {
    id: "song_admin",
    name: "노래 관리자",
    description: "노래 정보를 관리하는 관리자입니다",
    condition: "노래 관리자 권한 보유",
    rarity: "epic",
    checkCondition: (user) => user.role === "song_admin",
    autoGrant: true,
  },
  {
    id: "song_editor",
    name: "편집자",
    description: "노래 정보를 편집할 수 있는 편집자입니다",
    condition: "편집자 권한 보유",
    rarity: "rare",
    checkCondition: (user) => user.role === "song_editor",
    autoGrant: true,
  },

  // 활동 기반 칭호
  {
    id: "chzzk_user",
    name: "치지직 사용자",
    description: "아야의 팬사이트에 오신 것을 환영합니다!",
    condition: "회원가입 시 자동 부여",
    rarity: "common",
    checkCondition: () => true, // 모든 신규 사용자에게 부여
    autoGrant: true,
  },
  {
    id: "regular_visitor",
    name: "단골손님",
    description: "자주 방문해주시는 소중한 단골손님입니다",
    condition: "로그인 10회 이상",
    rarity: "common",
    checkCondition: (user, stats) => (stats?.loginCount || 0) >= 10,
    autoGrant: true,
  },
  {
    id: "music_lover",
    name: "노래 매니아",
    description: "음악을 사랑하는 진정한 매니아입니다",
    condition: "좋아요 50개 이상",
    rarity: "rare",
    checkCondition: (user, stats) => (stats?.likeCount || 0) >= 50,
    autoGrant: true,
  },
  {
    id: "playlist_curator",
    name: "플레이리스트 큐레이터",
    description: "음악 취향이 뛰어난 플레이리스트 전문가입니다",
    condition: "플레이리스트 5개 이상 생성",
    rarity: "rare",
    checkCondition: (user, stats) => (stats?.playlistCount || 0) >= 5,
    autoGrant: true,
  },
  {
    id: "loyal_fan",
    name: "충성스러운 팬",
    description: "아야를 꾸준히 응원해주시는 충성스러운 팬입니다",
    condition: "30일 연속 접속",
    rarity: "epic",
    checkCondition: (user, stats) => (stats?.consecutiveDays || 0) >= 30,
    autoGrant: true,
  },

  // 특별 칭호 (수동 부여)
  {
    id: "developer_friend",
    name: "개발자의 친구",
    description: "개발자와 특별한 인연이 있는 소중한 친구입니다",
    condition: "개발자가 직접 부여",
    rarity: "legendary",
    checkCondition: () => false, // 수동 부여만
    autoGrant: false,
  },
  {
    id: "beta_tester",
    name: "베타 테스터",
    description: "사이트 초기부터 함께해주신 베타 테스터입니다",
    condition: "특정 기간 가입자",
    rarity: "epic",
    checkCondition: () => false, // 수동 부여만
    autoGrant: false,
  },
];

// 칭호 ID로 정의 찾기
export function getTitleDefinition(
  titleId: string
): TitleDefinition | undefined {
  return TITLE_DEFINITIONS.find((title) => title.id === titleId);
}

// 희귀도별 색상 반환
export function getTitleRarityColor(rarity: string): string {
  switch (rarity) {
    case "common":
      return "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-800 dark:border-gray-700";
    case "rare":
      return "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border border-blue-800 dark:border-blue-700";
    case "epic":
      return "bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 border border-purple-800 dark:border-purple-700";
    case "legendary":
      return "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 border border-yellow-800 dark:border-yellow-700";
    default:
      return "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-800 dark:border-gray-700";
  }
}

// 사용자가 획득할 수 있는 새로운 칭호 확인
export function checkForNewTitles(
  user: IUser,
  stats?: UserStats
): TitleDefinition[] {
  const currentTitleIds = user.titles.map((title) => title.id);
  const newTitles: TitleDefinition[] = [];

  for (const titleDef of TITLE_DEFINITIONS) {
    // 이미 보유한 칭호는 건너뛰기
    if (currentTitleIds.includes(titleDef.id)) continue;

    // 자동 부여 칭호만 체크
    if (!titleDef.autoGrant) continue;

    // 조건 확인
    if (titleDef.checkCondition(user, stats)) {
      newTitles.push(titleDef);
    }
  }

  return newTitles;
}

// 사용자에게 칭호 부여
export function grantTitle(user: IUser, titleDef: TitleDefinition): boolean {
  console.log("🏆 칭호 부여 시도:", {
    titleId: titleDef.id,
    titleName: titleDef.name,
  });

  // 이미 보유한 칭호인지 확인
  const alreadyHas = user.titles.some((title) => title.id === titleDef.id);
  if (alreadyHas) {
    console.log("🏆 이미 보유한 칭호:", titleDef.name);
    return false;
  }

  // 칭호 추가
  const newTitle = {
    id: titleDef.id,
    name: titleDef.name,
    description: titleDef.description,
    earnedAt: new Date(),
    condition: titleDef.condition,
    rarity: titleDef.rarity,
  };

  console.log("🏆 칭호 추가 전 titles.length:", user.titles.length);
  user.titles.push(newTitle);
  console.log("🏆 칭호 추가 후 titles.length:", user.titles.length);
  console.log("🏆 추가된 칭호:", newTitle);

  // 첫 번째 칭호라면 자동으로 선택
  if (!user.selectedTitle) {
    user.selectedTitle = titleDef.id;
    console.log("🏆 첫 번째 칭호로 선택됨:", titleDef.id);
  }

  return true;
}

// 선택된 칭호 정보 가져오기
export function getSelectedTitleInfo(user: IUser) {
  if (!user.selectedTitle) return null;

  const selectedTitle = user.titles.find(
    (title) => title.id === user.selectedTitle
  );
  if (!selectedTitle) return null;

  // Mongoose 객체를 순수한 JavaScript 객체로 변환
  const maybeDoc = selectedTitle as { toObject?: () => typeof selectedTitle };
  const titleObj =
    typeof maybeDoc.toObject === "function"
      ? maybeDoc.toObject()
      : JSON.parse(JSON.stringify(selectedTitle));

  return {
    id: titleObj.id,
    name: titleObj.name,
    description: titleObj.description,
    rarity: titleObj.rarity,
    colorClass: getTitleRarityColor(titleObj.rarity),
  };
}
