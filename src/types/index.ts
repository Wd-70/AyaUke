export interface Song {
  id: string;                              // MongoDB ObjectId (메인 ID)
  sheetId?: string;                        // 구글시트 원본 ID (병합된 데이터의 경우)
  title: string;
  artist: string;
  language: string;
  genre?: string;
  mrLinks?: string[];
  lyrics?: string;
  difficulty?: string;
  tags?: string[];
  dateAdded?: string;
  source?: 'sheet' | 'mongodb' | 'merged'; // 데이터 소스 추가
  
  // MongoDB에서 가져온 추가 데이터 (선택사항)
  titleAlias?: string;
  artistAlias?: string;
  searchTags?: string[];
  sungCount?: number;
  lastSungDate?: string;
  keyAdjustment?: number | null;
  selectedMRIndex?: number;
  personalNotes?: string;
  imageUrl?: string;
}

export interface MRLink {
  url: string;
  skipSeconds?: number;
  label?: string;
  duration?: string;
}

export interface SongDetail {
  _id?: string;                            // MongoDB ObjectId
  title: string;
  artist: string;
  titleAlias?: string;
  artistAlias?: string;
  language?: string;
  lyrics?: string;
  searchTags?: string[];
  sungCount?: number;
  lastSungDate?: string;
  keyAdjustment?: number | null;
  mrLinks?: MRLink[];
  selectedMRIndex?: number;
  personalNotes?: string;
  imageUrl?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface StreamInfo {
  isLive: boolean;
  title?: string;
  viewers?: number;
  startTime?: string;
  platform: 'chzzk' | 'youtube';
}

export interface ScheduleItem {
  id: string;
  title: string;
  date: string;
  time: string;
  type: 'game' | 'karaoke' | 'chatting' | 'collaboration' | 'special';
  description?: string;
  game?: string;
}

export interface GameInfo {
  id: string;
  title: string;
  status: 'completed' | 'ongoing' | 'dropped';
  genre: string;
  platform: string;
  coverImage?: string;
  playedDate?: string;
  videos?: string[];
}

export interface ClipInfo {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
  duration: string;
  views: number;
  category: string;
  date: string;
}

export interface NotificationSettings {
  streamNotifications: boolean;
  soundEnabled: boolean;
  volume: number;
}

// 노래 추천소 관련 타입들
export interface SongRequest {
  id: string;
  title: string;
  artist: string;
  
  // 제출자 정보
  originalSubmitter: string;
  originalSubmitterName: string;
  submittedAt: string;
  
  // 추천 시스템 (노래책 좋아요와 별개)
  recommendationCount: number;
  recommendedBy: string[];
  isRecommendedByUser?: boolean; // 현재 유저의 추천 여부
  
  // 조회수
  viewCount: number;
  
  // 기본 곡 정보 (노래책과 호환)
  language?: string;
  genre?: string;
  difficulty?: string;
  lyrics?: string;
  description?: string; // 추천 이유/설명
  
  // 태그 시스템
  tags: string[];
  searchTags?: string[]; // 검색용 추가 태그
  
  // MR 링크들 (노래책과 동일한 구조)
  mrLinks: MRLink[];
  selectedMRIndex?: number; // 기본 MR 선택
  
  // 원곡 관련 링크들
  originalTrackUrl?: string; // 원곡 링크 (YouTube, Spotify 등)
  lyricsUrl?: string; // 가사 원본 링크
  
  // 추가 메타데이터
  keyAdjustment?: number | null; // 키 조정
  duration?: string; // 곡 길이
  releaseYear?: string; // 발매년도
  
  // 편집 이력
  editHistory: EditHistoryEntry[];
  
  // 상태 관리
  status: 'active' | 'pending_approval' | 'approved' | 'rejected';
  
  // 노래책 편입 여부
  promotedToSongbook: boolean;
  promotedAt?: string;
  promotedBy?: string;
  songbookId?: string;
  
  // 메타데이터
  createdAt: string;
  updatedAt: string;
}

export interface EditHistoryEntry {
  userId: string;
  userName: string;
  editedAt: string;
  changes: string;
  fieldsChanged: string[];
}

export type SongRequestSortOption = 
  | 'latest'        // 최신순
  | 'recommended'   // 추천순
  | 'viewed'        // 조회수순
  | 'trending'      // 인기순 (추천+조회수 복합)
  | 'pending';      // 승격 대기순

export interface SongRequestFilters {
  search?: string;
  genre?: string;
  tags?: string[];
  status?: SongRequest['status'];
  promotedToSongbook?: boolean;
}

export interface SongRequestStats {
  totalRequests: number;
  weeklyNewRequests: number;
  pendingPromotions: number;
  totalRecommendations: number;
  activeContributors: number;
}