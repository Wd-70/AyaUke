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
    
    // 에러 시 실제 성공했을 때의 데이터를 하드코딩으로 반환
    const fallbackVideos = [
      {
        id: 1,
        title: "띠용&유이언니랑 LCK 같이보고 칼부림 하기 망내도 왔대",
        thumbnail: "https://livecloud-thumb.akamaized.net/chzzk/kr/live-rewind-image/record/42772130/represent/thumbnail/image_13570137_720_0.jpg",
        duration: "4:42:16",
        publishDate: "1일 전",
        viewCount: "1.3K",
        url: "https://chzzk.naver.com/video/8419410"
      },
      {
        id: 2,
        title: "언니들과 슈퍼바이브 + 싱크룸 쪼끔 + 노래 마니",
        thumbnail: "https://livecloud-thumb.akamaized.net/chzzk/kr/live-rewind-image/record/42738725/represent/thumbnail/image_13551423_720_0.jpg",
        duration: "6:46:18",
        publishDate: "2일 전",
        viewCount: "1.1K",
        url: "https://chzzk.naver.com/video/8405352"
      },
      {
        id: 3,
        title: "500년만의 아침노래방!",
        thumbnail: "https://livecloud-thumb.akamaized.net/chzzk/kr/live-rewind-image/record/42695131/represent/thumbnail/image_13528379_720_0.jpg",
        duration: "2:43:44",
        publishDate: "3일 전",
        viewCount: "1.8K",
        url: "https://chzzk.naver.com/video/8381144"
      }
    ];
    
    return NextResponse.json({
      videos: fallbackVideos,
      success: false,
      error: 'API 호출 실패 - 실제 데이터로 폴백',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}