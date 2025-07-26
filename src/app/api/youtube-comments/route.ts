import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { hasPermission, Permission, UserRole } from '@/lib/permissions';
import dbConnect from '@/lib/mongodb';
import { YouTubeChannel, YouTubeVideo, YouTubeComment } from '@/models/YouTubeComment';

// 타임라인 패턴 정규식
const TIMELINE_PATTERNS = [
  /(\d{1,2}):(\d{2})/g,           // 3:45
  /(\d{1,2})분(\d{2})초/g,         // 3분45초  
  /(\d{1,2}):\d{2}/g,            // 12:34
  /(\d+):(\d+)/g,                // 일반적인 시간 형식
  /@(\d{1,2}):(\d{2})/g,         // @3:45
  /\b(\d{1,2})분\b/g,            // 3분
  /\b(\d+)초\b/g                 // 45초
];

// 타임라인 댓글 검사
function isTimelineComment(comment: string): boolean {
  return TIMELINE_PATTERNS.some(pattern => pattern.test(comment));
}

// 타임스탬프 추출
function extractTimestamps(comment: string): string[] {
  const timestamps: string[] = [];
  TIMELINE_PATTERNS.forEach(pattern => {
    const matches = comment.match(pattern);
    if (matches) timestamps.push(...matches);
  });
  return [...new Set(timestamps)]; // 중복 제거
}

// 아야 아카이브 채널 ID (하드코딩)
const AYAUKE_ARCHIVE_CHANNEL_ID = 'UCsFclToX4FEApNjAsodeGpg';

// YouTube API에서 채널 정보 가져오기 - 두 단계로 처리
async function getChannelVideos(channelId: string, publishedAfter?: Date) {
  const API_KEY = process.env.YOUTUBE_API_KEY;
  if (!API_KEY) throw new Error('YouTube API 키가 설정되지 않았습니다.');

  // 1단계: 채널의 uploads 플레이리스트 ID 가져오기
  const channelResponse = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?key=${API_KEY}&id=${channelId}&part=contentDetails`
  );

  if (!channelResponse.ok) {
    throw new Error(`채널 정보 조회 오류: ${channelResponse.status}`);
  }

  const channelData = await channelResponse.json();
  if (!channelData.items || channelData.items.length === 0) {
    throw new Error('채널을 찾을 수 없습니다.');
  }

  const uploadsPlaylistId = channelData.items[0].contentDetails.relatedPlaylists.uploads;

  // 2단계: uploads 플레이리스트에서 비디오 목록 가져오기 (페이지네이션 지원)
  let allItems = [];
  let nextPageToken = '';
  
  do {
    const params = new URLSearchParams({
      key: API_KEY,
      playlistId: uploadsPlaylistId,
      part: 'snippet,contentDetails',
      maxResults: '50'
    });
    
    if (nextPageToken) {
      params.append('pageToken', nextPageToken);
    }

    const playlistResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?${params}`
    );
    
    if (!playlistResponse.ok) {
      throw new Error(`플레이리스트 조회 오류: ${playlistResponse.status}`);
    }

    const playlistData = await playlistResponse.json();
    const items = playlistData.items || [];
    
    allItems.push(...items);
    nextPageToken = playlistData.nextPageToken;
    
    // API 호출 제한을 위한 딜레이
    if (nextPageToken) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
  } while (nextPageToken);

  console.log(`📺 총 ${allItems.length}개 비디오 발견`);

  // publishedAfter 필터 적용
  if (publishedAfter) {
    allItems = allItems.filter(item => 
      new Date(item.snippet.publishedAt) > publishedAfter
    );
  }

  // search API와 호환되는 형태로 변환
  return allItems.map(item => ({
    id: {
      videoId: item.snippet.resourceId.videoId
    },
    snippet: item.snippet
  }));
}

// YouTube API에서 비디오 댓글 가져오기
async function getVideoComments(videoId: string) {
  const API_KEY = process.env.YOUTUBE_API_KEY;
  if (!API_KEY) throw new Error('YouTube API 키가 설정되지 않았습니다.');

  const url = `https://www.googleapis.com/youtube/v3/commentThreads?` +
    `key=${API_KEY}&videoId=${videoId}&part=snippet&maxResults=100&order=time`;

  const response = await fetch(url);
  
  if (!response.ok) {
    if (response.status === 403) {
      // 댓글이 비활성화된 경우
      return [];
    }
    throw new Error(`YouTube API 오류: ${response.status}`);
  }

  const data = await response.json();
  return data.items || [];
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !hasPermission(session.user.role as UserRole, Permission.SONGS_VIEW)) {
      return NextResponse.json(
        { success: false, error: '권한이 필요합니다.' },
        { status: 403 }
      );
    }

    await dbConnect();

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const videoId = searchParams.get('videoId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';

    switch (action) {
      case 'channel-stats':
        // 채널 통계 조회
        const channelId = AYAUKE_ARCHIVE_CHANNEL_ID;
        
        const channel = await YouTubeChannel.findOne({ channelId });
        // 검색 조건 구성
        const searchQuery: any = { channelId };
        if (search) {
          searchQuery.title = { $regex: search, $options: 'i' };
        }
        
        const totalVideos = await YouTubeVideo.countDocuments(searchQuery);
        const videos = await YouTubeVideo.find(searchQuery)
          .sort({ publishedAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit);
        
        const totalComments = await YouTubeComment.countDocuments();
        const timelineComments = await YouTubeComment.countDocuments({ isTimeline: true });
        
        return NextResponse.json({
          success: true,
          data: {
            channel,
            videos,
            pagination: {
              currentPage: page,
              totalPages: Math.ceil(totalVideos / limit),
              totalVideos,
              limit
            },
            stats: {
              totalVideos,
              totalComments,
              timelineComments,
              processedComments: await YouTubeComment.countDocuments({ isProcessed: true })
            }
          }
        });

      case 'video-details':
        if (!videoId) {
          return NextResponse.json(
            { success: false, error: 'videoId가 필요합니다.' },
            { status: 400 }
          );
        }

        const video = await YouTubeVideo.findOne({ videoId });
        const comments = await YouTubeComment.find({ videoId }).sort({ publishedAt: -1 });
        
        return NextResponse.json({
          success: true,
          data: {
            video,
            comments,
            stats: {
              total: comments.length,
              timeline: comments.filter(c => c.isTimeline).length,
              processed: comments.filter(c => c.isProcessed).length
            }
          }
        });

      default:
        return NextResponse.json(
          { success: false, error: '올바르지 않은 action입니다.' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('YouTube 댓글 API 오류:', error);
    
    // 더 자세한 에러 정보 제공
    let errorMessage = '알 수 없는 오류가 발생했습니다.';
    if (error instanceof Error) {
      errorMessage = error.message;
      
      // YouTube API 관련 에러 메시지 개선
      if (error.message.includes('채널 정보 조회 오류: 403')) {
        errorMessage = 'YouTube API 키 권한이 부족합니다. API 키를 확인해주세요.';
      } else if (error.message.includes('채널 정보 조회 오류: 404')) {
        errorMessage = '채널을 찾을 수 없습니다. 채널 ID를 확인해주세요.';
      } else if (error.message.includes('플레이리스트 조회 오류')) {
        errorMessage = '채널의 비디오 목록을 가져올 수 없습니다.';
      }
    }
    
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !hasPermission(session.user.role as UserRole, Permission.SONGS_EDIT)) {
      return NextResponse.json(
        { success: false, error: '편집 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    await dbConnect();

    const body = await request.json();
    const { action, channelId, videoId, commentId, data } = body;

    switch (action) {
      case 'sync-channel':
        // 전체 채널 동기화
        console.log('🎬 채널 동기화 시작...');
        
        // 채널 ID 사용
        const syncChannelId = AYAUKE_ARCHIVE_CHANNEL_ID;
        
        const videos = await getChannelVideos(syncChannelId);
        let processedVideos = 0;
        let totalTimelineComments = 0;

        for (const videoItem of videos) {
          const videoId = videoItem.id.videoId;
          const snippet = videoItem.snippet;

          // 비디오 정보 저장/업데이트
          await YouTubeVideo.findOneAndUpdate(
            { videoId },
            {
              channelId: syncChannelId,
              title: snippet.title,
              publishedAt: new Date(snippet.publishedAt),
              thumbnailUrl: snippet.thumbnails?.medium?.url || '',
              lastCommentSync: new Date()
            },
            { upsert: true, new: true }
          );

          // 댓글 수집
          try {
            const comments = await getVideoComments(videoId);
            let videoTimelineComments = 0;

            for (const commentItem of comments) {
              const comment = commentItem.snippet.topLevelComment.snippet;
              const isTimeline = isTimelineComment(comment.textDisplay);
              
              if (isTimeline) videoTimelineComments++;

              await YouTubeComment.findOneAndUpdate(
                { commentId: commentItem.id },
                {
                  videoId,
                  authorName: comment.authorDisplayName,
                  textContent: comment.textDisplay,
                  publishedAt: new Date(comment.publishedAt),
                  likeCount: comment.likeCount || 0,
                  isTimeline,
                  extractedTimestamps: isTimeline ? extractTimestamps(comment.textDisplay) : []
                },
                { upsert: true, new: true }
              );
            }

            // 비디오 통계 업데이트
            await YouTubeVideo.updateOne(
              { videoId },
              {
                totalComments: comments.length,
                timelineComments: videoTimelineComments
              }
            );

            totalTimelineComments += videoTimelineComments;
            processedVideos++;

            console.log(`✅ ${processedVideos}/${videos.length} - ${snippet.title}: ${videoTimelineComments}개 타임라인 댓글`);

            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));

          } catch (error) {
            console.log(`❌ ${videoId} 댓글 수집 실패:`, error);
          }
        }

        // 채널 정보 업데이트
        await YouTubeChannel.findOneAndUpdate(
          { channelId: syncChannelId },
          {
            channelName: '아야 다시보기',
            channelUrl: 'https://www.youtube.com/@AyaUke_Archive',
            lastSyncDate: new Date(),
            totalVideos: videos.length,
            totalComments: await YouTubeComment.countDocuments(),
            timelineComments: totalTimelineComments
          },
          { upsert: true, new: true }
        );

        return NextResponse.json({
          success: true,
          message: `채널 동기화 완료: ${processedVideos}개 비디오, ${totalTimelineComments}개 타임라인 댓글`
        });

      case 'sync-video':
        // 개별 비디오 댓글 새로고침
        if (!videoId) {
          return NextResponse.json(
            { success: false, error: 'videoId가 필요합니다.' },
            { status: 400 }
          );
        }

        const comments = await getVideoComments(videoId);
        let timelineCount = 0;

        for (const commentItem of comments) {
          const comment = commentItem.snippet.topLevelComment.snippet;
          const isTimeline = isTimelineComment(comment.textDisplay);
          
          if (isTimeline) timelineCount++;

          await YouTubeComment.findOneAndUpdate(
            { commentId: commentItem.id },
            {
              videoId,
              authorName: comment.authorDisplayName,
              textContent: comment.textDisplay,
              publishedAt: new Date(comment.publishedAt),
              likeCount: comment.likeCount || 0,
              isTimeline,
              extractedTimestamps: isTimeline ? extractTimestamps(comment.textDisplay) : []
            },
            { upsert: true, new: true }
          );
        }

        await YouTubeVideo.updateOne(
          { videoId },
          {
            totalComments: comments.length,
            timelineComments: timelineCount,
            lastCommentSync: new Date()
          }
        );

        return NextResponse.json({
          success: true,
          message: `비디오 동기화 완료: ${comments.length}개 댓글, ${timelineCount}개 타임라인`
        });

      case 'update-comment':
        // 댓글 상태 업데이트
        if (!commentId) {
          return NextResponse.json(
            { success: false, error: 'commentId가 필요합니다.' },
            { status: 400 }
          );
        }

        const updateData: any = {};
        if (data.isProcessed !== undefined) {
          updateData.isProcessed = data.isProcessed;
          if (data.isProcessed) {
            updateData.processedBy = session.user.channelId;
            updateData.processedAt = new Date();
          }
        }
        if (data.isTimeline !== undefined) {
          updateData.isTimeline = data.isTimeline;
          updateData.manuallyMarked = true;
          // 타임라인 상태 변경 시 타임스탬프 재추출
          const comment = await YouTubeComment.findOne({ commentId });
          if (comment && data.isTimeline) {
            updateData.extractedTimestamps = extractTimestamps(comment.textContent);
          } else {
            updateData.extractedTimestamps = [];
          }
        }

        await YouTubeComment.updateOne({ commentId }, updateData);

        return NextResponse.json({
          success: true,
          message: '댓글 상태가 업데이트되었습니다.'
        });

      default:
        return NextResponse.json(
          { success: false, error: '올바르지 않은 action입니다.' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('YouTube 댓글 처리 오류:', error);
    
    // 더 자세한 에러 정보 제공
    let errorMessage = '알 수 없는 오류가 발생했습니다.';
    if (error instanceof Error) {
      errorMessage = error.message;
      
      // YouTube API 관련 에러 메시지 개선
      if (error.message.includes('채널 정보 조회 오류: 403')) {
        errorMessage = 'YouTube API 키 권한이 부족합니다. API 키를 확인해주세요.';
      } else if (error.message.includes('채널 정보 조회 오류: 404')) {
        errorMessage = '채널을 찾을 수 없습니다. 채널 ID를 확인해주세요.';
      } else if (error.message.includes('플레이리스트 조회 오류')) {
        errorMessage = '채널의 비디오 목록을 가져올 수 없습니다.';
      }
    }
    
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}