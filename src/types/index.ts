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
  likeCount?: number;
  lastSungDate?: string;
  keyAdjustment?: number | null;
  selectedMRIndex?: number;
  personalNotes?: string;
  imageUrl?: string;
}

// SongCard에서 사용하는 확장된 Song 타입
export interface SongData extends Song {
  mrLinks?: MRLink[];  // string[] 대신 MRLink[] 사용
}

export interface MRLink {
  url: string;
  skipSeconds?: number;
  label?: string;
  duration?: string;
}

export interface LyricsLink {
  title: string;
  url: string;
  verified: boolean;
  addedBy?: string;
  addedAt?: Date;
}

export interface SongDetail {
  _id?: string;                            // MongoDB ObjectId
  title: string;
  artist: string;
  titleAlias?: string;
  artistAlias?: string;
  language?: string;
  lyrics?: string;
  lyricsLinks?: LyricsLink[];
  searchTags?: string[];
  sungCount?: number;
  likeCount?: number;
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

// 노래 영상 관련 타입들
export interface SongVideo {
  _id?: string;
  songId: string; // SongDetail의 _id와 연결
  title: string; // 곡 제목 (검색용)
  artist: string; // 아티스트 (검색용)
  videoUrl: string; // 유튜브 URL
  videoId: string; // 유튜브 비디오 ID (추출)
  sungDate: Date; // 부른 날짜
  description?: string; // 영상에 대한 설명 (옵션)
  startTime?: number; // 시작 시간 (초) - 노래 시작 부분으로 바로 이동
  endTime?: number; // 종료 시간 (초) - 노래 끝나는 부분
  addedBy: string; // 추가한 사용자의 채널 ID
  addedByName: string; // 추가한 사용자의 이름
  isVerified: boolean; // 관리자가 검증한 영상인지
  verifiedBy?: string; // 검증한 관리자 채널 ID
  verifiedAt?: Date; // 검증 날짜
  thumbnailUrl?: string; // 썸네일 URL (유튜브에서 자동 추출)
  duration?: string; // 영상 길이 (유튜브에서 자동 추출)
  createdAt?: Date;
  updatedAt?: Date;
}