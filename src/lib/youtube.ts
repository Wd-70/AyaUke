// YouTube 관련 유틸리티 함수들

export function extractYouTubeVideoId(url: string): string | null {
  const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

export function generateThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
}

export function validateYouTubeUrl(url: string): boolean {
  const youtubeRegex = /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+/;
  return youtubeRegex.test(url);
}

// videoUrl이 변경되었을 때 필요한 데이터를 업데이트하는 함수
export function updateVideoData(videoUrl: string): { videoId: string; thumbnailUrl: string } | null {
  if (!validateYouTubeUrl(videoUrl)) {
    return null;
  }

  const videoId = extractYouTubeVideoId(videoUrl);
  if (!videoId) {
    return null;
  }

  return {
    videoId,
    thumbnailUrl: generateThumbnailUrl(videoId)
  };
}