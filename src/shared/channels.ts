/**
 * 아야 채널 ID — 화면 링크(클라이언트)와 서버 설정(`shared/config.ts`)의 단일 출처.
 * 서버는 env(AYAUKE_CHZZK_CHANNEL_ID 등)로 덮어쓸 수 있고, 이 값이 기본값이다.
 * 관리자 → 시스템 설정 → '채널·외부 소스'에서 현재 값을 확인할 수 있다.
 */
export const AYAUKE_CHZZK_CHANNEL_ID = 'abe8aa82baf3d3ef54ad8468ee73e7fc';
export const AYAUKE_YOUTUBE_ARCHIVE_ID = 'UCsFclToX4FEApNjAsodeGpg';

export const CHZZK_CHANNEL_URL = `https://chzzk.naver.com/${AYAUKE_CHZZK_CHANNEL_ID}`;
export const CHZZK_LIVE_URL = `https://chzzk.naver.com/live/${AYAUKE_CHZZK_CHANNEL_ID}`;
export const CHZZK_VIDEOS_URL = `${CHZZK_CHANNEL_URL}/videos`;
