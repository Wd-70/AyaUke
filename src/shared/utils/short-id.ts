import { randomBytes } from 'crypto'

/**
 * 공유 URL용 짧은 불투명 식별자 생성기 (서버 전용).
 * base62(0-9a-zA-Z) 12자 = 62^12 ≈ 3.2e21 공간으로 사실상 충돌 없음.
 * 곡/클립 플레이리스트(shareId)와 클립(SongVideo.shareId)에서 공통 사용한다.
 */
const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ' // 62자

export function generateShortId(length = 12): string {
  let out = ''
  // 모듈로 편향 제거: 248(=62*4) 이상 바이트는 버린다.
  while (out.length < length) {
    const buf = randomBytes(length)
    for (let i = 0; i < buf.length && out.length < length; i++) {
      const v = buf[i]
      if (v < 248) out += ALPHABET[v % 62]
    }
  }
  return out
}
