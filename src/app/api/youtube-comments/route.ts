import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { hasPermission, Permission, UserRole } from '@/lib/permissions';
import dbConnect from '@/lib/mongodb';
import { YouTubeChannel, YouTubeVideo, YouTubeComment } from '@/models/YouTubeComment';

// 타임라인 패턴 정규식 (시간:분:초 형식도 지원)
const TIMELINE_PATTERNS = [
  /(\d{1,2}):(\d{2}):(\d{2})/g,   // 1:23:45 (시간:분:초)
  /(\d{1,2}):(\d{2})/g,           // 3:45 (분:초)
  /(\d{1,2})분(\d{2})초/g,         // 3분45초  
  /@(\d{1,2}):(\d{2}):(\d{2})/g,  // @1:23:45 (시간:분:초)
  /@(\d{1,2}):(\d{2})/g,          // @3:45 (분:초)
  /\b(\d{1,2})분\b/g,            // 3분
  /\b(\d+)초\b/g                 // 45초
];

// 타임라인 댓글 검사
function isTimelineComment(comment: string): boolean {
  return TIMELINE_PATTERNS.some(pattern => pattern.test(comment));
}

// 타임스탬프 추출 (우선순위에 따라 정확한 패턴만 매칭)
function extractTimestamps(comment: string): string[] {
  const timestamps: string[] = [];
  
  // 우선순위 순서로 패턴 체크 (긴 패턴부터)
  const priorityPatterns = [
    /(\d{1,2}):(\d{2}):(\d{2})/g,   // 1:23:45 (시간:분:초) - 최우선
    /@(\d{1,2}):(\d{2}):(\d{2})/g,  // @1:23:45 (시간:분:초) - 최우선
    /(\d{1,2}):(\d{2})/g,           // 3:45 (분:초)
    /@(\d{1,2}):(\d{2})/g,          // @3:45 (분:초)
    /(\d{1,2})분(\d{2})초/g,         // 3분45초  
    /\b(\d{1,2})분\b/g,            // 3분
    /\b(\d+)초\b/g                 // 45초
  ];
  
  let remainingComment = comment;
  
  for (const pattern of priorityPatterns) {
    const matches = remainingComment.match(pattern);
    if (matches) {
      timestamps.push(...matches);
      // 매칭된 부분을 제거하여 중복 매칭 방지
      matches.forEach(match => {
        remainingComment = remainingComment.replace(match, ' '.repeat(match.length));
      });
    }
    // 전역 플래그 초기화
    pattern.lastIndex = 0;
  }
  
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
    
    // API 호출 제한을 위한 딜레이 (줄임)
    if (nextPageToken) {
      await new Promise(resolve => setTimeout(resolve, 50));
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
        // 채널 통계 조회 (모든 채널 포함)
        const channelId = AYAUKE_ARCHIVE_CHANNEL_ID;
        
        const channel = await YouTubeChannel.findOne({ channelId });
        // 검색 조건 구성 (채널 제한 없이 모든 영상 조회)
        const searchQuery: any = {};
        if (search) {
          searchQuery.title = { $regex: search, $options: 'i' };
        }
        
        const totalVideos = await YouTubeVideo.countDocuments(searchQuery);
        const videos = await YouTubeVideo.find(searchQuery)
          .sort({ publishedAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit);

        // 각 비디오의 채널 정보 추가 및 lastNewCommentAt 마이그레이션
        const videosWithChannelInfo = await Promise.all(
          videos.map(async (video) => {
            const channelInfo = await YouTubeChannel.findOne({ channelId: video.channelId });
            const videoObj = video.toObject();
            
            // lastNewCommentAt 필드가 없는 기존 데이터 마이그레이션
            if (!videoObj.lastNewCommentAt) {
              // 해당 비디오의 가장 최근에 시스템에서 인식한 댓글 날짜 찾기
              const latestComment = await YouTubeComment.findOne(
                { videoId: video.videoId },
                { updatedAt: 1, createdAt: 1 }
              ).sort({ updatedAt: -1, createdAt: -1 });
              
              // 시스템에서 마지막으로 인식한 댓글 날짜 (updatedAt 우선, 없으면 createdAt)
              const initDate = latestComment 
                ? (latestComment.updatedAt || latestComment.createdAt)
                : video.publishedAt;
              
              await YouTubeVideo.updateOne(
                { videoId: video.videoId },
                { lastNewCommentAt: initDate }
              );
              videoObj.lastNewCommentAt = initDate;
            }
            
            return {
              ...videoObj,
              channelName: channelInfo?.channelName || video.channelId
            };
          })
        );
        
        const totalComments = await YouTubeComment.countDocuments();
        const timelineComments = await YouTubeComment.countDocuments({ isTimeline: true });
        
        return NextResponse.json({
          success: true,
          data: {
            channel,
            videos: videosWithChannelInfo,
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
        
        // 새로운 데이터 추적을 위한 변수들
        let newVideos = 0;
        let newComments = 0;
        let newTimelineComments = 0;
        const syncStartTime = new Date();

        // 병렬 처리를 위한 배치 크기 (YouTube API 제한 고려)
        const BATCH_SIZE = 3;
        
        // 비디오 정보 먼저 일괄 저장 (새로운 비디오 추적)
        const videoSavePromises = videos.map(async (videoItem) => {
          const videoId = videoItem.id.videoId;
          const snippet = videoItem.snippet;
          
          // 기존 비디오 확인
          const existingVideo = await YouTubeVideo.findOne({ videoId });
          const isNewVideo = !existingVideo;
          
          const videoUpdateData: any = {
            channelId: syncChannelId,
            title: snippet.title,
            publishedAt: new Date(snippet.publishedAt),
            thumbnailUrl: snippet.thumbnails?.medium?.url || '',
            lastCommentSync: new Date()
          };
          
          // 새로운 비디오인 경우에만 lastNewCommentAt 초기화 (기존 값 보존)
          if (isNewVideo) {
            // 새 비디오는 일단 업로드 날짜로 초기화 (댓글 수집 후 나중에 업데이트)
            videoUpdateData.lastNewCommentAt = new Date(snippet.publishedAt);
          }
          
          await YouTubeVideo.findOneAndUpdate(
            { videoId },
            videoUpdateData,
            { upsert: true, new: true }
          );
          
          return { videoId, isNewVideo };
        });

        const videoResults = await Promise.all(videoSavePromises);
        newVideos = videoResults.filter(result => result.isNewVideo).length;
        console.log(`💾 ${videos.length}개 비디오 정보 저장 완료 (새로운 비디오: ${newVideos}개)`);

        // 댓글 수집을 배치로 병렬 처리
        for (let i = 0; i < videos.length; i += BATCH_SIZE) {
          const batch = videos.slice(i, i + BATCH_SIZE);
          
          const batchPromises = batch.map(async (videoItem) => {
            const videoId = videoItem.id.videoId;
            const snippet = videoItem.snippet;

            try {
              const comments = await getVideoComments(videoId);
              let videoTimelineComments = 0;
              let videoNewComments = 0;
              let videoNewTimelineComments = 0;

              for (const commentItem of comments) {
                const comment = commentItem.snippet.topLevelComment.snippet;
                const isTimeline = isTimelineComment(comment.textDisplay);
                
                if (isTimeline) videoTimelineComments++;

                // 기존 댓글 확인
                const existingComment = await YouTubeComment.findOne({ commentId: commentItem.id });
                const isNewComment = !existingComment;

                // 새로운 댓글만 저장 (기존 댓글은 건드리지 않음)
                if (isNewComment) {
                  await YouTubeComment.create({
                    commentId: commentItem.id,
                    videoId,
                    authorName: comment.authorDisplayName,
                    textContent: comment.textDisplay,
                    publishedAt: new Date(comment.publishedAt),
                    likeCount: comment.likeCount || 0,
                    isTimeline,
                    extractedTimestamps: isTimeline ? extractTimestamps(comment.textDisplay) : []
                  });

                  // 새로운 댓글 카운트
                  videoNewComments++;
                  if (isTimeline) videoNewTimelineComments++;
                }
              }

              // 비디오 통계 업데이트
              const updateData: any = {
                totalComments: comments.length,
                timelineComments: videoTimelineComments
              };
              
              // 새로운 댓글이 있을 때만 lastNewCommentAt 업데이트
              if (videoNewComments > 0) {
                updateData.lastNewCommentAt = new Date();
              } else {
                // 새로운 비디오인 경우, 시스템에서 방금 저장한 댓글들의 날짜로 초기화
                const videoResult = videoResults.find(result => result.videoId === videoId);
                if (videoResult && videoResult.isNewVideo && comments.length > 0) {
                  // 방금 저장된 댓글들 중 가장 최근 것의 시스템 날짜 (현재 시간)
                  updateData.lastNewCommentAt = new Date();
                }
              }
              
              await YouTubeVideo.updateOne({ videoId }, updateData);

              return {
                videoId,
                title: snippet.title,
                timelineComments: videoTimelineComments,
                newComments: videoNewComments,
                newTimelineComments: videoNewTimelineComments
              };

            } catch (error) {
              console.log(`❌ ${videoId} 댓글 수집 실패:`, error);
              return {
                videoId,
                title: snippet.title,
                timelineComments: 0,
                newComments: 0,
                newTimelineComments: 0
              };
            }
          });

          // 배치 완료 대기
          const batchResults = await Promise.all(batchPromises);
          
          // 결과 처리
          batchResults.forEach(result => {
            totalTimelineComments += result.timelineComments;
            newComments += result.newComments;
            newTimelineComments += result.newTimelineComments;
            processedVideos++;
            
            const newIndicator = result.newComments > 0 ? ` (새로운 댓글: ${result.newComments}개${result.newTimelineComments > 0 ? `, 타임라인: ${result.newTimelineComments}개` : ''})` : '';
            console.log(`✅ ${processedVideos}/${videos.length} - ${result.title}: ${result.timelineComments}개 타임라인 댓글${newIndicator}`);
          });

          // 배치 간 딜레이 (API 제한 고려)
          if (i + BATCH_SIZE < videos.length) {
            await new Promise(resolve => setTimeout(resolve, 300));
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

        // 결과 메시지 생성
        const syncEndTime = new Date();
        const syncDuration = Math.round((syncEndTime.getTime() - syncStartTime.getTime()) / 1000);
        
        let resultMessage = '';
        
        if (newVideos === 0 && newComments === 0) {
          resultMessage = `동기화 완료: 새로운 데이터가 없습니다. (처리시간: ${syncDuration}초)`;
        } else {
          const newDataParts = [];
          if (newVideos > 0) newDataParts.push(`새로운 비디오 ${newVideos}개`);
          if (newComments > 0) newDataParts.push(`새로운 댓글 ${newComments}개`);
          if (newTimelineComments > 0) newDataParts.push(`새로운 타임라인 댓글 ${newTimelineComments}개`);
          
          resultMessage = `동기화 완료: ${newDataParts.join(', ')} 수집됨! (처리시간: ${syncDuration}초)`;
        }

        return NextResponse.json({
          success: true,
          message: resultMessage,
          data: {
            totalVideos: processedVideos,
            totalTimelineComments,
            newVideos,
            newComments,
            newTimelineComments,
            syncDuration
          }
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
        let newCommentsCount = 0;
        let newTimelineCount = 0;

        for (const commentItem of comments) {
          const comment = commentItem.snippet.topLevelComment.snippet;
          const isTimeline = isTimelineComment(comment.textDisplay);
          
          if (isTimeline) timelineCount++;

          // 기존 댓글 확인
          const existingComment = await YouTubeComment.findOne({ commentId: commentItem.id });
          const isNewComment = !existingComment;

          // 새로운 댓글만 저장 (기존 댓글은 건드리지 않음)
          if (isNewComment) {
            await YouTubeComment.create({
              commentId: commentItem.id,
              videoId,
              authorName: comment.authorDisplayName,
              textContent: comment.textDisplay,
              publishedAt: new Date(comment.publishedAt),
              likeCount: comment.likeCount || 0,
              isTimeline,
              extractedTimestamps: isTimeline ? extractTimestamps(comment.textDisplay) : []
            });

            // 새로운 댓글 카운트
            newCommentsCount++;
            if (isTimeline) newTimelineCount++;
          }
        }

        const syncUpdateData: any = {
          totalComments: comments.length,
          timelineComments: timelineCount,
          lastCommentSync: new Date()
        };
        
        // 새로운 댓글이 있을 때만 lastNewCommentAt 업데이트
        if (newCommentsCount > 0) {
          syncUpdateData.lastNewCommentAt = new Date();
        }
        
        await YouTubeVideo.updateOne({ videoId }, syncUpdateData);

        // 결과 메시지 생성
        let videoResultMessage = '';
        
        if (newCommentsCount === 0) {
          videoResultMessage = `비디오 동기화 완료: 새로운 댓글이 없습니다. (총 ${comments.length}개 댓글, ${timelineCount}개 타임라인)`;
        } else {
          const newParts = [`새로운 댓글 ${newCommentsCount}개`];
          if (newTimelineCount > 0) newParts.push(`새로운 타임라인 댓글 ${newTimelineCount}개`);
          
          videoResultMessage = `비디오 동기화 완료: ${newParts.join(', ')} 수집됨! (총 ${comments.length}개 댓글, ${timelineCount}개 타임라인)`;
        }

        return NextResponse.json({
          success: true,
          message: videoResultMessage,
          data: {
            totalComments: comments.length,
            timelineCount,
            newComments: newCommentsCount,
            newTimelineComments: newTimelineCount
          }
        });

      case 'add-manual-video':
        // 수동 영상 추가 (다른 채널의 영상도 추가 가능)
        if (!videoId) {
          return NextResponse.json(
            { success: false, error: 'videoId가 필요합니다.' },
            { status: 400 }
          );
        }

        try {
          // YouTube API에서 비디오 정보 가져오기
          const API_KEY = process.env.YOUTUBE_API_KEY;
          if (!API_KEY) {
            return NextResponse.json(
              { success: false, error: 'YouTube API 키가 설정되지 않았습니다.' },
              { status: 500 }
            );
          }

          const videoResponse = await fetch(
            `https://www.googleapis.com/youtube/v3/videos?key=${API_KEY}&id=${videoId}&part=snippet,contentDetails`
          );

          if (!videoResponse.ok) {
            return NextResponse.json(
              { success: false, error: '비디오 정보를 가져올 수 없습니다.' },
              { status: 400 }
            );
          }

          const videoData = await videoResponse.json();
          if (!videoData.items || videoData.items.length === 0) {
            return NextResponse.json(
              { success: false, error: '비디오를 찾을 수 없습니다.' },
              { status: 404 }
            );
          }

          const snippet = videoData.items[0].snippet;
          
          // 기존 비디오 확인
          const existingVideo = await YouTubeVideo.findOne({ videoId });
          const isNewVideo = !existingVideo;

          // 채널 정보 저장/업데이트
          await YouTubeChannel.findOneAndUpdate(
            { channelId: snippet.channelId },
            {
              channelName: snippet.channelTitle,
              lastUpdate: new Date()
            },
            { upsert: true, new: true }
          );

          // 비디오 정보 저장 (채널 ID는 실제 채널 ID 사용)
          const manualVideoUpdateData: any = {
            channelId: snippet.channelId,
            title: snippet.title,
            publishedAt: new Date(snippet.publishedAt),
            thumbnailUrl: snippet.thumbnails?.medium?.url || '',
            lastCommentSync: new Date()
          };
          
          // 새로운 비디오인 경우에만 lastNewCommentAt 초기화 (기존 값 보존)
          if (isNewVideo) {
            // 새 비디오는 일단 업로드 날짜로 초기화 (댓글 수집 후 나중에 업데이트)
            manualVideoUpdateData.lastNewCommentAt = new Date(snippet.publishedAt);
          }
          
          await YouTubeVideo.findOneAndUpdate(
            { videoId },
            manualVideoUpdateData,
            { upsert: true, new: true }
          );

          // 댓글 수집
          const manualComments = await getVideoComments(videoId);
          let manualTimelineCount = 0;
          let manualNewComments = 0;
          let manualNewTimelineComments = 0;

          for (const commentItem of manualComments) {
            const comment = commentItem.snippet.topLevelComment.snippet;
            const isTimeline = isTimelineComment(comment.textDisplay);
            
            if (isTimeline) manualTimelineCount++;

            // 기존 댓글 확인
            const existingComment = await YouTubeComment.findOne({ commentId: commentItem.id });
            const isNewComment = !existingComment;

            // 새로운 댓글만 저장 (기존 댓글은 건드리지 않음)
            if (isNewComment) {
              await YouTubeComment.create({
                commentId: commentItem.id,
                videoId,
                authorName: comment.authorDisplayName,
                textContent: comment.textDisplay,
                publishedAt: new Date(comment.publishedAt),
                likeCount: comment.likeCount || 0,
                isTimeline,
                extractedTimestamps: isTimeline ? extractTimestamps(comment.textDisplay) : []
              });

              // 새로운 댓글 카운트
              manualNewComments++;
              if (isTimeline) manualNewTimelineComments++;
            }
          }

          // 비디오 댓글 통계 업데이트
          const manualUpdateData: any = {
            totalComments: manualComments.length,
            timelineComments: manualTimelineCount,
            lastCommentSync: new Date()
          };
          
          // 새로운 댓글이 있을 때만 lastNewCommentAt 업데이트
          if (manualNewComments > 0) {
            manualUpdateData.lastNewCommentAt = new Date();
          } else {
            // 새로운 비디오인 경우, 시스템에서 방금 저장한 댓글들의 날짜로 초기화
            if (isNewVideo && manualComments.length > 0) {
              // 방금 저장된 댓글들의 시스템 날짜 (현재 시간)
              manualUpdateData.lastNewCommentAt = new Date();
            }
          }
          
          await YouTubeVideo.updateOne({ videoId }, manualUpdateData);

          // 결과 메시지 생성
          let manualResultMessage = '';
          
          if (isNewVideo) {
            manualResultMessage = `새로운 영상이 추가되었습니다: "${snippet.title}"`;
          } else {
            manualResultMessage = `기존 영상이 업데이트되었습니다: "${snippet.title}"`;
          }

          if (manualNewComments > 0) {
            const newParts = [`새로운 댓글 ${manualNewComments}개`];
            if (manualNewTimelineComments > 0) newParts.push(`새로운 타임라인 댓글 ${manualNewTimelineComments}개`);
            manualResultMessage += ` (${newParts.join(', ')} 수집됨)`;
          }

          return NextResponse.json({
            success: true,
            message: manualResultMessage,
            data: {
              videoId,
              channelId: snippet.channelId,
              title: snippet.title,
              isNewVideo,
              totalComments: manualComments.length,
              timelineCount: manualTimelineCount,
              newComments: manualNewComments,
              newTimelineComments: manualNewTimelineComments
            }
          });

        } catch (error) {
          console.error('수동 영상 추가 오류:', error);
          return NextResponse.json(
            { success: false, error: '영상 추가 중 오류가 발생했습니다.' },
            { status: 500 }
          );
        }

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