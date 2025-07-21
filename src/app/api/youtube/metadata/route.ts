import { NextRequest, NextResponse } from 'next/server';

// YouTube 비디오 메타데이터 조회 API
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const videoUrl = searchParams.get('url');
    
    if (!videoUrl) {
      return NextResponse.json(
        { error: 'YouTube URL이 필요합니다.' },
        { status: 400 }
      );
    }

    // YouTube 비디오 ID 추출
    const extractYouTubeVideoId = (url: string): string | null => {
      const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/;
      const match = url.match(regex);
      return match ? match[1] : null;
    };

    const videoId = extractYouTubeVideoId(videoUrl);
    if (!videoId) {
      return NextResponse.json(
        { error: '올바른 YouTube URL이 아닙니다.' },
        { status: 400 }
      );
    }

    // YouTube Data API 키 확인
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      // API 키가 없으면 기본 정보만 반환
      return NextResponse.json({
        success: true,
        metadata: {
          videoId,
          title: '',
          extractedDate: '',
          thumbnailUrl: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
        }
      });
    }

    // YouTube Data API 호출
    const youtubeApiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet&key=${apiKey}`;
    
    const response = await fetch(youtubeApiUrl);
    const data = await response.json();
    
    if (!response.ok || !data.items || data.items.length === 0) {
      return NextResponse.json(
        { error: '영상 정보를 가져올 수 없습니다.' },
        { status: 404 }
      );
    }

    const video = data.items[0];
    const title = video.snippet.title;
    
    // 제목에서 날짜 추출 함수
    const extractDateFromTitle = (title: string): string => {
      if (!title) return '';
      
      // [YY.MM.DD] 또는 [YYYY.MM.DD] 형식 찾기
      const dateMatch = title.match(/\[(\d{2,4})\.(\d{1,2})\.(\d{1,2})\]/);
      if (dateMatch) {
        let year = parseInt(dateMatch[1], 10);
        const month = parseInt(dateMatch[2], 10);
        const day = parseInt(dateMatch[3], 10);
        
        // 2자리 년도인 경우 20XX로 변환
        if (year < 100) {
          year += 2000;
        }
        
        // YYYY-MM-DD 형식으로 변환
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
      
      return '';
    };

    const extractedDate = extractDateFromTitle(title);

    return NextResponse.json({
      success: true,
      metadata: {
        videoId,
        title,
        extractedDate,
        thumbnailUrl: video.snippet.thumbnails?.medium?.url || `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
        publishedAt: video.snippet.publishedAt,
        channelTitle: video.snippet.channelTitle
      }
    });

  } catch (error) {
    console.error('YouTube 메타데이터 조회 오류:', error);
    return NextResponse.json(
      { error: '메타데이터를 가져오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}