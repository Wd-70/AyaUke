import { NextRequest, NextResponse } from 'next/server';

// YouTube API 응답 타입 정의
interface YouTubeVideoItem {
  id: {
    videoId: string;
  };
  snippet: {
    title: string;
    channelTitle: string;
    description: string;
    publishedAt: string;
    thumbnails: {
      default?: { url: string };
      medium?: { url: string };
    };
  };
}

interface YouTubeSearchResponse {
  items: YouTubeVideoItem[];
  error?: {
    message: string;
    errors?: Array<{ reason: string }>;
  };
}

// YouTube API 키 관리 클래스
class YouTubeAPIKeyManager {
  private keys: string[] = [];
  private currentIndex: number = 0;
  private keyStatus: Map<string, { quotaExceeded: boolean, lastUsed: Date }> = new Map();

  constructor() {
    this.loadKeys();
  }

  private loadKeys() {
    // 환경 변수에서 API 키들 로드
    const apiKeys = [
      process.env.YOUTUBE_API_KEY,
      process.env.YOUTUBE_API_KEY_2,
      process.env.YOUTUBE_API_KEY_3,
      process.env.YOUTUBE_API_KEY_4,
      process.env.YOUTUBE_API_KEY_5
    ].filter(key => key && key.trim() !== '');

    this.keys = apiKeys as string[];
    
    // 키 상태 초기화
    this.keys.forEach(key => {
      if (!this.keyStatus.has(key)) {
        this.keyStatus.set(key, { quotaExceeded: false, lastUsed: new Date(0) });
      }
    });
  }

  getCurrentKey(): string | null {
    if (this.keys.length === 0) return null;
    
    // 사용 가능한 키 찾기 (할당량 초과되지 않은 키)
    for (let i = 0; i < this.keys.length; i++) {
      const key = this.keys[(this.currentIndex + i) % this.keys.length];
      const status = this.keyStatus.get(key);
      
      if (!status?.quotaExceeded) {
        this.currentIndex = (this.currentIndex + i) % this.keys.length;
        return key;
      }
    }
    
    return null; // 모든 키가 할당량 초과된 경우
  }

  markKeyAsQuotaExceeded(key: string) {
    const status = this.keyStatus.get(key);
    if (status) {
      status.quotaExceeded = true;
      status.lastUsed = new Date();
    }
  }

  getNextKey(): string | null {
    this.currentIndex = (this.currentIndex + 1) % this.keys.length;
    return this.getCurrentKey();
  }

  getKeyStats() {
    return {
      totalKeys: this.keys.length,
      availableKeys: this.keys.filter(key => !this.keyStatus.get(key)?.quotaExceeded).length,
      currentKeyIndex: this.currentIndex,
      keyStatus: Array.from(this.keyStatus.entries()).map(([key, status]) => ({
        keyPreview: key.substring(0, 10) + '...',
        quotaExceeded: status.quotaExceeded,
        lastUsed: status.lastUsed
      }))
    };
  }
}

// 전역 키 매니저 인스턴스
const keyManager = new YouTubeAPIKeyManager();

export async function POST(request: NextRequest) {
  try {
    const currentKey = keyManager.getCurrentKey();
    
    if (!currentKey) {
      const stats = keyManager.getKeyStats();
      return NextResponse.json({
        success: false,
        error: stats.totalKeys === 0 
          ? 'YouTube API 키가 설정되지 않았습니다. YOUTUBE_API_KEY, YOUTUBE_API_KEY_2, ... 환경 변수를 추가해주세요.'
          : '모든 YouTube API 키의 할당량이 초과되었습니다. 내일 다시 시도하거나 새로운 API 키를 추가해주세요.',
        keyStats: stats
      }, { status: 500 });
    }

    const { title, artist } = await request.json();
    
    if (!title || !artist) {
      return NextResponse.json({
        success: false,
        error: '곡 제목과 아티스트가 필요합니다.'
      }, { status: 400 });
    }

    // 현재 앱과 동일한 검색 쿼리 생성
    const searchQuery = `${title} ${artist} karaoke MR`;
    
    const url = `https://www.googleapis.com/youtube/v3/search?` +
      `key=${currentKey}&` +
      `q=${encodeURIComponent(searchQuery)}&` +
      `part=snippet&` +
      `maxResults=5&` +
      `type=video&` +
      `order=relevance`;

    const response = await fetch(url);
    const data = await response.json() as YouTubeSearchResponse;

    if (data.error) {
      console.error('YouTube API 오류:', data.error);
      
      // 할당량 초과 감지 및 키 전환
      if (data.error.errors?.[0]?.reason === 'quotaExceeded') {
        keyManager.markKeyAsQuotaExceeded(currentKey);
        
        // 다음 키로 재시도
        const nextKey = keyManager.getNextKey();
        if (nextKey) {
          console.log('할당량 초과로 다음 API 키로 전환하여 재시도...');
          
          const retryUrl = `https://www.googleapis.com/youtube/v3/search?` +
            `key=${nextKey}&` +
            `q=${encodeURIComponent(searchQuery)}&` +
            `part=snippet&` +
            `maxResults=5&` +
            `type=video&` +
            `order=relevance`;

          const retryResponse = await fetch(retryUrl);
          const retryData = await retryResponse.json() as YouTubeSearchResponse;
          
          if (retryData.error) {
            return NextResponse.json({
              success: false,
              error: `YouTube API 오류 (재시도): ${retryData.error.message || 'Unknown error'}`,
              keyStats: keyManager.getKeyStats()
            }, { status: 500 });
          }
          
          // 재시도 성공 시 데이터 업데이트
          Object.assign(data, retryData);
        } else {
          return NextResponse.json({
            success: false,
            error: `모든 YouTube API 키의 할당량이 초과되었습니다.`,
            keyStats: keyManager.getKeyStats()
          }, { status: 500 });
        }
      } else {
        return NextResponse.json({
          success: false,
          error: `YouTube API 오류: ${data.error.message || 'Unknown error'}`,
          keyStats: keyManager.getKeyStats()
        }, { status: 500 });
      }
    }

    if (!data.items || data.items.length === 0) {
      return NextResponse.json({
        success: false,
        error: '검색 결과를 찾을 수 없습니다.'
      }, { status: 404 });
    }

    // 검색 결과를 사용하기 쉬운 형태로 변환
    const results = data.items.map((video: YouTubeVideoItem) => ({
      videoId: video.id.videoId,
      title: video.snippet.title,
      url: `https://www.youtube.com/watch?v=${video.id.videoId}`,
      thumbnail: video.snippet.thumbnails.medium?.url || video.snippet.thumbnails.default?.url,
      channelTitle: video.snippet.channelTitle,
      description: video.snippet.description,
      publishedAt: video.snippet.publishedAt
    }));

    return NextResponse.json({
      success: true,
      searchQuery,
      results,
      selectedResult: results[0], // 첫 번째 결과를 기본 선택
      keyStats: keyManager.getKeyStats()
    });

  } catch (error) {
    console.error('YouTube 검색 오류:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}