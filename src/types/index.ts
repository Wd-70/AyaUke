export interface Song {
  id: string;
  title: string;
  artist: string;
  language: string;
  genre?: string;
  mrLinks?: string[];
  lyrics?: string;
  difficulty?: string;
  tags?: string[];
  dateAdded?: string;
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