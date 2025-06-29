import { NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log('치지직 영상 API 호출 시작');
    
    // Chzzk 공식 API를 사용하여 영상 데이터 가져오기
    const response = await fetch('https://api.chzzk.naver.com/service/v1/channels/abe8aa82baf3d3ef54ad8468ee73e7fc/videos?size=3', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const apiData = await response.json();
    console.log('API 응답 성공:', apiData.content?.data?.length, '개 영상');
    
    if (!apiData.content?.data || apiData.content.data.length === 0) {
      throw new Error('영상 데이터가 없습니다');
    }

    // API 데이터를 우리 형식으로 변환
    interface ChzzkVideo {
      videoTitle: string;
      thumbnailImageUrl: string;
      duration: number;
      publishDate: string;
      readCount: number;
      videoNo: number;
    }
    
    const videos = apiData.content.data.map((video: ChzzkVideo, index: number) => {
      // 시간을 분:초 형식으로 변환
      const formatDuration = (seconds: number) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        if (hours > 0) {
          return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
      };

      // 조회수 포맷팅
      const formatViewCount = (count: number) => {
        if (count >= 1000000) {
          return `${(count / 1000000).toFixed(1)}M`;
        } else if (count >= 1000) {
          return `${(count / 1000).toFixed(1)}K`;
        }
        return count.toString();
      };

      // 게시일 포맷팅
      const formatPublishDate = (dateString: string) => {
        const publishDate = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - publishDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) {
          return '1일 전';
        } else if (diffDays <= 7) {
          return `${diffDays}일 전`;
        } else if (diffDays <= 30) {
          const weeks = Math.floor(diffDays / 7);
          return `${weeks}주 전`;
        } else {
          const months = Math.floor(diffDays / 30);
          return `${months}개월 전`;
        }
      };

      return {
        id: index + 1,
        title: video.videoTitle,
        thumbnail: video.thumbnailImageUrl,
        duration: formatDuration(video.duration),
        publishDate: formatPublishDate(video.publishDate),
        viewCount: formatViewCount(video.readCount),
        url: `https://chzzk.naver.com/video/${video.videoNo}`
      };
    });

    console.log(`실제 API 데이터 성공: ${videos.length}개 영상 반환`);
    
    return NextResponse.json({
      videos: videos.slice(0, 3), // 최대 3개만 반환
      success: true,
      message: '실제 치지직 API 데이터 사용'
    });

  } catch (error) {
    console.error('크롤링 에러:', error);
    
    // 에러 시 폴백 데이터 반환
    const fallbackVideos = [
      {
        id: 1,
        title: '🎤 노래방송 | J-pop 특집 + 신청곡 받아요!',
        thumbnail: createDummyThumbnail('노래방송', '#8B5CF6'),
        duration: '2:34:12',
        publishDate: '2일 전',
        viewCount: '1.2K',
        url: 'https://chzzk.naver.com/abe8aa82baf3d3ef54ad8468ee73e7fc/videos'
      },
      {
        id: 2,
        title: '🎮 게임방송 | 발로란트 랭크 올리기 도전!',
        thumbnail: createDummyThumbnail('게임방송', '#EC4899'),
        duration: '1:45:33',
        publishDate: '5일 전',
        viewCount: '856',
        url: 'https://chzzk.naver.com/abe8aa82baf3d3ef54ad8468ee73e7fc/videos'
      },
      {
        id: 3,
        title: '💬 저스트채팅 | 시청자분들과 수다타임',
        thumbnail: createDummyThumbnail('저스트채팅', '#6366F1'),
        duration: '1:12:44',
        publishDate: '1주 전',
        viewCount: '634',
        url: 'https://chzzk.naver.com/abe8aa82baf3d3ef54ad8468ee73e7fc/videos'
      }
    ];
    
    return NextResponse.json({
      videos: fallbackVideos,
      success: false,
      error: 'API 호출 실패 - 폴백 데이터 사용',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// 더미 썸네일 생성 (SVG 데이터 URL)
function createDummyThumbnail(type: string, color: string): string {
  const svg = `
    <svg width="320" height="180" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${color};stop-opacity:0.8" />
          <stop offset="100%" style="stop-color:${color};stop-opacity:0.4" />
        </linearGradient>
      </defs>
      <rect width="320" height="180" fill="url(#grad)"/>
      <circle cx="160" cy="90" r="30" fill="white" fill-opacity="0.9"/>
      <polygon points="150,75 150,105 175,90" fill="${color}"/>
      <text x="160" y="130" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="14" font-weight="bold">${type}</text>
    </svg>
  `;
  
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}