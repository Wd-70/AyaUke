/**
 * 플레이어 음량 설정 영속화 (localStorage).
 * ClipPlayer(시청)와 ChzzkPlayer(검증/편집) 등 모든 플레이어가 공유해
 * 영상·플랫폼·화면이 바뀌어도 음량이 유지된다.
 */

const VOLUME_STORAGE_KEY = 'clip-player-volume';

export interface StoredVolume {
  /** 0~1 */
  volume: number;
  muted: boolean;
}

export function loadStoredVolume(): StoredVolume {
  if (typeof window === 'undefined') return { volume: 1, muted: false };
  try {
    const raw = localStorage.getItem(VOLUME_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const volume = Number(parsed.volume);
      if (volume >= 0 && volume <= 1) {
        return { volume, muted: !!parsed.muted };
      }
    }
  } catch {
    /* 손상된 값은 무시하고 기본값 사용 */
  }
  return { volume: 1, muted: false };
}

export function saveStoredVolume(value: StoredVolume) {
  try {
    localStorage.setItem(VOLUME_STORAGE_KEY, JSON.stringify(value));
  } catch {
    /* private 모드 등에서 실패해도 재생에는 지장 없음 */
  }
}
