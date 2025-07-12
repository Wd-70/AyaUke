// 모든 개별 좋아요 기능 완전 비활성화
// 대량 로딩 테스트 중

export function useLike(songId: string) {
  return {
    liked: false,
    isLoading: false,
    error: null,
    toggleLike: async () => {
      // 완전 비활성화
    }
  }
}

export function useUserLikes() {
  return {
    likes: [],
    isLoading: false,
    error: null,
    refresh: async () => {},
    pagination: null
  }
}

// 대량 로딩만 허용
export * from './useLikes'