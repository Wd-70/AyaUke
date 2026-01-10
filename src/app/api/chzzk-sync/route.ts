import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import ChzzkVideo from "@/models/ChzzkVideo";
import ChzzkComment from "@/models/ChzzkComment";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { escapeRegex } from "@/lib/regexUtils";
import { fetchWithRetry, createRetryStatisticsTracker, isRetryableError, retryWithBackoff } from '@/lib/retryUtils';
import { transformRetryError } from '@/lib/errorTransformer';
import { fetchWithTimeout } from '@/lib/fetchWithTimeout';

const AYAUKE_CHANNEL_ID = "abe8aa82baf3d3ef54ad8468ee73e7fc";

// ============================================================================
// Utility Functions
// ============================================================================

// Timeline pattern detection (reused from youtube-comments)
const TIMELINE_PATTERNS = [
  /(\d{1,2}):(\d{2}):(\d{2})/g,   // 1:23:45 (시간:분:초)
  /(\d{1,2}):(\d{2})/g,           // 3:45 (분:초)
  /(\d{1,2})분(\d{2})초/g,         // 3분45초
  /@(\d{1,2}):(\d{2}):(\d{2})/g,  // @1:23:45 (시간:분:초)
  /@(\d{1,2}):(\d{2})/g,          // @3:45 (분:초)
  /\b(\d{1,2})분\b/g,            // 3분
  /\b(\d+)초\b/g                 // 45초
];

function isTimelineComment(content: string): boolean {
  return TIMELINE_PATTERNS.some(pattern => pattern.test(content));
}

function extractTimestamps(content: string): string[] {
  const timestamps: string[] = [];

  // Priority order: longer patterns first
  const priorityPatterns = [
    /(\d{1,2}):(\d{2}):(\d{2})/g,   // 1:23:45
    /@(\d{1,2}):(\d{2}):(\d{2})/g,  // @1:23:45
    /(\d{1,2}):(\d{2})/g,           // 3:45
    /@(\d{1,2}):(\d{2})/g,          // @3:45
    /(\d{1,2})분(\d{2})초/g,         // 3분45초
    /\b(\d{1,2})분\b/g,            // 3분
    /\b(\d+)초\b/g                 // 45초
  ];

  priorityPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      timestamps.push(match[0]);
    }
  });

  return [...new Set(timestamps)]; // Remove duplicates
}

function parseTimeToSeconds(timeParam: string): number {
  // HH:MM:SS format
  const colonHmsMatch = timeParam.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
  if (colonHmsMatch) {
    const hours = parseInt(colonHmsMatch[1]);
    const minutes = parseInt(colonHmsMatch[2]);
    const seconds = parseInt(colonHmsMatch[3]);
    return hours * 3600 + minutes * 60 + seconds;
  }

  // MM:SS format
  const colonMsMatch = timeParam.match(/^(\d{1,2}):(\d{2})$/);
  if (colonMsMatch) {
    const minutes = parseInt(colonMsMatch[1]);
    const seconds = parseInt(colonMsMatch[2]);
    return minutes * 60 + seconds;
  }

  // Pure number (seconds)
  if (/^\d+$/.test(timeParam)) {
    return parseInt(timeParam);
  }

  // Korean format: X분Y초
  const minSecMatch = timeParam.match(/(\d+)분(\d+)초/);
  if (minSecMatch) {
    const minutes = parseInt(minSecMatch[1]);
    const seconds = parseInt(minSecMatch[2]);
    return minutes * 60 + seconds;
  }

  // Korean format: X분
  const minMatch = timeParam.match(/(\d+)분/);
  if (minMatch) {
    const minutes = parseInt(minMatch[1]);
    return minutes * 60;
  }

  // Korean format: X초
  const secMatch = timeParam.match(/(\d+)초/);
  if (secMatch) {
    return parseInt(secMatch[1]);
  }

  return 0;
}

function formatSeconds(seconds: number): string {
  // Handle negative timestamps - clamp to 0:00
  // Negative values occur when YouTube video starts before Chzzk video (negative timeOffset)
  // Clamping to 0:00 provides clearest user experience
  if (seconds < 0) {
    return '0:00';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }
}

// ============================================================================
// Chzzk API Functions
// ============================================================================

interface ChzzkVideoData {
  videoNo: number;
  videoId: string;
  videoTitle: string;
  publishDateAt: number;
  duration: number;
  readCount: number;
  thumbnailImageUrl: string;
  channel: {
    channelId: string;
    channelName: string;
  };
}

interface ChzzkCommentData {
  commentId: number;
  videoNo: number;
  commentType: string;
  parentCommentId?: number;
  content: string;
  userIdHash: string;
  createTime: number;
}

async function fetchChzzkVideos(channelId: string, size: number = 100): Promise<ChzzkVideoData[]> {
  try {
    // Use correct pagination parameters: pagingType and sortType are REQUIRED
    const response = await fetchWithTimeout(
      `https://api.chzzk.naver.com/service/v1/channels/${channelId}/videos?pagingType=PAGE&page=0&size=${size}&sortType=LATEST`,
      {
        headers: {
          // Complete User-Agent with Chrome version and Safari compatibility
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          "Accept": "application/json, text/plain, */*",
          "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
          "Referer": `https://chzzk.naver.com/${channelId}`,
          "Origin": "https://chzzk.naver.com",
        },
      },
      30000 // 30 second timeout
    );

    if (!response.ok) {
      throw new Error(`Chzzk API error: ${response.status}`);
    }

    const data = await response.json();
    return data.content?.data || [];
  } catch (error: any) {
    console.error("[fetchChzzkVideos] Error fetching Chzzk videos:", {
      channelId,
      size,
      error: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      stack: error.stack
    });

    // Transform error for user-friendly message
    if (error.message?.includes('400')) {
      throw new Error('Chzzk API returned 400 Bad Request. Please verify channel ID and API parameters.');
    }

    throw error;
  }
}

async function fetchChzzkComments(videoNo: number): Promise<ChzzkCommentData[]> {
  const allComments: ChzzkCommentData[] = [];
  let offset = 0;
  const limit = 30;
  let hasMore = true;

  while (hasMore) {
    try {
      const response = await fetchWithTimeout(
        `https://apis.naver.com/nng_main/nng_comment_api/v1/type/STREAMING_VIDEO/id/${videoNo}/comments?limit=${limit}&offset=${offset}&orderType=POPULAR&pagingType=PAGE`,
        {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
        },
        30000 // 30 second timeout
      );

      if (!response.ok) {
        if (response.status === 404) {
          // Video deleted or no comments
          break;
        }
        throw new Error(`Chzzk Comment API error: ${response.status}`);
      }

      const data = await response.json();
      const comments = data.comments || [];

      if (comments.length === 0) {
        hasMore = false;
      } else {
        allComments.push(...comments);
        offset += limit;

        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error(`Error fetching comments for video ${videoNo}:`, error);
      hasMore = false;
    }
  }

  return allComments;
}

async function checkVideoExists(videoNo: number): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(
      `https://api.chzzk.naver.com/service/v1/videos/${videoNo}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      },
      15000 // 15 second timeout for quick check
    );

    return response.ok;
  } catch (error) {
    return false;
  }
}

// ============================================================================
// GET Handler
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    // === AUTHENTICATION CHECK ===
    const session = await getServerSession(authOptions);

    // Check if user is authenticated
    if (!session || !session.user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized: Authentication required'
        },
        { status: 401 }
      );
    }

    // Check if user has admin privileges
    if (!session.user.isAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: 'Forbidden: Admin access required'
        },
        { status: 403 }
      );
    }
    // === END AUTHENTICATION CHECK ===

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    // Sync channel with SSE streaming
    if (action === "sync-channel-stream") {
      const force = searchParams.get("force") === "true";

      // Create SSE response with proper headers
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            // Defensive check for SSE setup
            if (typeof encoder === 'undefined' || typeof controller === 'undefined') {
              throw new Error('[SSE Setup] TextEncoder or ReadableStreamController is undefined');
            }

            // Helper to send SSE message
            const sendEvent = (event: string, data: any) => {
              const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
              controller.enqueue(encoder.encode(message));
            };

            // Initialize retry statistics tracker
            const retryTracker = createRetryStatisticsTracker();

            // Fetch videos
            sendEvent('progress', { stage: 'fetching_videos', message: 'Fetching channel videos...' });
            const videos = await fetchChzzkVideos(AYAUKE_CHANNEL_ID);
            const totalVideos = videos.length;

            sendEvent('progress', {
              stage: 'videos_fetched',
              totalVideos,
              message: `Found ${totalVideos} videos`
            });

            let stats = {
              totalVideos,
              processedVideos: 0,
              newVideos: 0,
              totalComments: 0,
              timelineComments: 0,
              errors: [] as any[],
              retryStatistics: retryTracker.stats
            };

            // Process each video
            for (let i = 0; i < videos.length; i++) {
              const videoData = videos[i];

              try {
                // Send current video info
                sendEvent('video_start', {
                  current: i + 1,
                  total: totalVideos,
                  videoNo: videoData.videoNo,
                  videoTitle: videoData.videoTitle,
                  thumbnailUrl: videoData.thumbnailImageUrl
                });

                // Check if exists
                const existingVideo = await ChzzkVideo.findOne({ videoNo: videoData.videoNo });
                if (existingVideo && !force) {
                  sendEvent('video_skip', {
                    current: i + 1,
                    total: totalVideos,
                    videoTitle: videoData.videoTitle,
                    reason: 'already_exists'
                  });
                  stats.processedVideos++;
                  continue;
                }

                stats.newVideos++;

                // Track retries for this video
                let currentVideoRetries = 0;

                // Fetch comments with progress
                sendEvent('comments_start', {
                  current: i + 1,
                  total: totalVideos,
                  videoTitle: videoData.videoTitle
                });

                const comments = await fetchChzzkComments(videoData.videoNo);

                let timelineCount = 0;
                // Process comments
                for (const commentData of comments) {
                  const isTimeline = isTimelineComment(commentData.content);
                  if (isTimeline) timelineCount++;
                  const timestamps = isTimeline ? extractTimestamps(commentData.content) : [];

                  await ChzzkComment.findOneAndUpdate(
                    { commentId: commentData.commentId },
                    {
                      commentId: commentData.commentId,
                      videoNo: commentData.videoNo,
                      commentType: commentData.commentType,
                      parentCommentId: commentData.parentCommentId,
                      content: commentData.content,
                      authorName: commentData.userIdHash,
                      publishedAt: new Date(commentData.createTime),
                      isTimeline,
                      extractedTimestamps: timestamps,
                    },
                    { upsert: true, new: true }
                  );
                }

                stats.totalComments += comments.length;
                stats.timelineComments += timelineCount;

                // Save video
                await ChzzkVideo.findOneAndUpdate(
                  { videoNo: videoData.videoNo },
                  {
                    videoNo: videoData.videoNo,
                    videoId: videoData.videoId,
                    channelId: videoData.channel.channelId,
                    channelName: videoData.channel.channelName,
                    videoTitle: videoData.videoTitle,
                    publishDate: new Date(videoData.publishDateAt).toISOString(),
                    duration: videoData.duration,
                    readCount: videoData.readCount,
                    thumbnailImageUrl: videoData.thumbnailImageUrl,
                    videoUrl: `https://chzzk.naver.com/video/${videoData.videoNo}`,
                    totalComments: comments.length,
                    timelineComments: timelineCount,
                    lastCommentSync: new Date(),
                    isDeleted: false,
                  },
                  { upsert: true, new: true }
                );

                // Send completion for this video
                sendEvent('video_complete', {
                  current: i + 1,
                  total: totalVideos,
                  videoTitle: videoData.videoTitle,
                  commentsCount: comments.length,
                  timelineCommentsCount: timelineCount,
                  retryCount: currentVideoRetries,
                  stats: {
                    processedVideos: i + 1,
                    totalComments: stats.totalComments,
                    timelineComments: stats.timelineComments,
                    totalRetries: stats.retryStatistics.totalRetries
                  }
                });

                if (currentVideoRetries > 0) {
                  retryTracker.stats.successfulRetries++; // Mark as successful retry
                }

                stats.processedVideos++;

                // Rate limiting delay
                await new Promise(resolve => setTimeout(resolve, 150));

              } catch (error: any) {
                // Log error but continue
                const errorInfo = {
                  videoNo: videoData.videoNo,
                  videoTitle: videoData.videoTitle,
                  error: transformRetryError(error, currentVideoRetries),
                  retryCount: currentVideoRetries,
                  wasRetryable: isRetryableError(error)
                };
                stats.errors.push(errorInfo);

                // Track failed retries
                if (currentVideoRetries > 0) {
                  retryTracker.stats.failedAfterRetries++;
                }

                sendEvent('video_error', {
                  current: i + 1,
                  total: totalVideos,
                  videoTitle: videoData.videoTitle,
                  error: errorInfo.error,
                  retryCount: currentVideoRetries
                });

                stats.processedVideos++;
              }
            }

            // Send final completion
            sendEvent('complete', {
              stats,
              message: `Sync completed successfully. Retries: ${stats.retryStatistics.totalRetries}`
            });

            // CLEANUP: Clear references to prevent memory leaks
            videos.length = 0; // Clear array
            stats.errors.length = 0; // Clear error array

            controller.close();
          } catch (error: any) {
            sendEvent('error', { error: error.message });

            // CLEANUP: Ensure arrays are cleared even on error
            if (typeof stats !== 'undefined') {
              stats.errors.length = 0;
            }

            controller.close();
          }
        }
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // List videos
    if (action === "list-videos") {
      const page = parseInt(searchParams.get("page") || "1");
      const limit = parseInt(searchParams.get("limit") || "20");
      const search = searchParams.get("search") || "";

      // BUG-011 FIX: Escape regex special characters to prevent ReDoS and injection attacks
      // Reference: BUGS_FOUND.md lines 262-321
      // SECURITY NOTE: This protects against regex injection but maintains substring search.
      // For case-insensitive exact word matching, consider MongoDB text search index.
      const sanitizedSearch = search ? escapeRegex(search) : "";

      const query = sanitizedSearch
        ? { videoTitle: { $regex: sanitizedSearch, $options: "i" } }
        : {};

      const total = await ChzzkVideo.countDocuments(query);
      const videos = await ChzzkVideo.find(query)
        .sort({ publishDate: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

      return NextResponse.json({
        success: true,
        data: {
          videos,
          pagination: {
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            totalCount: total,
          },
        },
      });
    }

    // Get video details with comments
    if (action === "get-video") {
      const videoNo = parseInt(searchParams.get("videoNo") || "0");
      const convertTimestamps = searchParams.get("convertTimestamps") === "true";

      if (!videoNo) {
        return NextResponse.json(
          { success: false, error: "videoNo is required" },
          { status: 400 }
        );
      }

      const video = await ChzzkVideo.findOne({ videoNo }).lean();
      if (!video) {
        return NextResponse.json(
          { success: false, error: "Video not found" },
          { status: 404 }
        );
      }

      const comments = await ChzzkComment.find({ videoNo })
        .sort({ publishedAt: -1 })
        .lean();

      let convertedComments: string[] | undefined;
      if (convertTimestamps && video.timeOffset !== null && video.timeOffset !== undefined) {
        convertedComments = comments
          .filter(c => c.isTimeline)
          .map(comment => {
            let converted = comment.content;
            comment.extractedTimestamps.forEach(timestamp => {
              const seconds = parseTimeToSeconds(timestamp);
              const newSeconds = seconds + (video.timeOffset || 0);
              const newTimestamp = formatSeconds(newSeconds);
              converted = converted.replace(timestamp, newTimestamp);
            });
            return converted;
          });
      }

      return NextResponse.json({
        success: true,
        data: {
          video,
          comments,
          convertedComments,
        },
      });
    }

    // Get statistics
    if (action === "get-statistics") {
      const dateFrom = searchParams.get("dateFrom");
      const dateTo = searchParams.get("dateTo");

      // Build date filter
      let dateFilter: any = {};
      if (dateFrom || dateTo) {
        dateFilter.publishDate = {};
        if (dateFrom) dateFilter.publishDate.$gte = dateFrom;
        if (dateTo) dateFilter.publishDate.$lte = dateTo;
      }

      // Aggregate statistics
      const [stats] = await ChzzkVideo.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: null,
            totalVideos: { $sum: 1 },
            totalTimelineComments: { $sum: "$timelineComments" },
            videosWithYoutubeUrl: {
              $sum: {
                $cond: [{ $ne: ["$youtubeUrl", null] }, 1, 0]
              }
            },
            videosWithTimeOffset: {
              $sum: {
                $cond: [{ $ne: ["$timeOffset", null] }, 1, 0]
              }
            },
            fullyConvertedVideos: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ne: ["$youtubeUrl", null] },
                      { $ne: ["$timeOffset", null] }
                    ]
                  },
                  1,
                  0
                ]
              }
            },
            mostRecentSync: { $max: "$lastCommentSync" },
            avgTimelineComments: { $avg: "$timelineComments" }
          }
        }
      ]);

      // Get top videos
      const topVideos = await ChzzkVideo.find(dateFilter)
        .sort({ timelineComments: -1 })
        .limit(20)
        .select('videoNo videoTitle timelineComments totalComments publishDate youtubeUrl timeOffset thumbnailImageUrl')
        .lean();

      // Calculate conversion health score
      const healthScore = stats?.totalVideos > 0
        ? (stats.fullyConvertedVideos / stats.totalVideos) * 100
        : 0;

      return NextResponse.json({
        success: true,
        data: {
          statistics: {
            totalVideos: stats?.totalVideos || 0,
            totalTimelineComments: stats?.totalTimelineComments || 0,
            videosWithYoutubeUrl: stats?.videosWithYoutubeUrl || 0,
            videosWithTimeOffset: stats?.videosWithTimeOffset || 0,
            fullyConvertedVideos: stats?.fullyConvertedVideos || 0,
            mostRecentSync: stats?.mostRecentSync || null,
            avgTimelineComments: Math.round(stats?.avgTimelineComments || 0),
            conversionHealthScore: Math.round(healthScore * 10) / 10
          },
          topVideos,
          metadata: {
            dateFrom,
            dateTo,
            calculatedAt: new Date().toISOString()
          }
        }
      });
    }

    return NextResponse.json(
      { success: false, error: "Invalid action" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("GET /api/chzzk-sync error:", error);

    // Check if it's a timeout error
    if (error.message?.includes('timeout')) {
      return NextResponse.json(
        {
          error: 'Request Timeout',
          message: error.message,
          code: 'TIMEOUT'
        },
        { status: 504 } // Gateway Timeout
      );
    }

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    // === AUTHENTICATION CHECK ===
    const session = await getServerSession(authOptions);

    // Check if user is authenticated
    if (!session || !session.user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized: Authentication required'
        },
        { status: 401 }
      );
    }

    // Check if user has admin privileges
    if (!session.user.isAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: 'Forbidden: Admin access required'
        },
        { status: 403 }
      );
    }
    // === END AUTHENTICATION CHECK ===

    const body = await request.json();
    const { action } = body;

    // Sync entire channel
    if (action === "sync-channel") {
      const force = body.force || false;

      const retryTracker = createRetryStatisticsTracker();

      let stats = {
        totalVideos: 0,
        newVideos: 0,
        totalComments: 0,
        timelineComments: 0,
        retryStatistics: retryTracker.stats
      };

      // Fetch all videos from channel
      const videos = await fetchChzzkVideos(AYAUKE_CHANNEL_ID);
      stats.totalVideos = videos.length;

      for (const videoData of videos) {
        // Check if video already exists
        const existingVideo = await ChzzkVideo.findOne({ videoNo: videoData.videoNo });

        if (existingVideo && !force) {
          // Skip if already exists and not forcing update
          continue;
        }

        stats.newVideos++;

        // Fetch comments for this video
        const comments = await fetchChzzkComments(videoData.videoNo);

        let timelineCount = 0;

        // Process and save comments
        for (const commentData of comments) {
          const isTimeline = isTimelineComment(commentData.content);
          if (isTimeline) timelineCount++;

          const timestamps = isTimeline ? extractTimestamps(commentData.content) : [];

          await ChzzkComment.findOneAndUpdate(
            { commentId: commentData.commentId },
            {
              commentId: commentData.commentId,
              videoNo: commentData.videoNo,
              commentType: commentData.commentType,
              parentCommentId: commentData.parentCommentId,
              content: commentData.content,
              authorName: commentData.userIdHash,
              publishedAt: new Date(commentData.createTime),
              isTimeline,
              extractedTimestamps: timestamps,
            },
            { upsert: true, new: true }
          );
        }

        stats.totalComments += comments.length;
        stats.timelineComments += timelineCount;

        // Save or update video
        await ChzzkVideo.findOneAndUpdate(
          { videoNo: videoData.videoNo },
          {
            videoNo: videoData.videoNo,
            videoId: videoData.videoId,
            channelId: videoData.channel.channelId,
            channelName: videoData.channel.channelName,
            videoTitle: videoData.videoTitle,
            publishDate: new Date(videoData.publishDateAt).toISOString(),
            duration: videoData.duration,
            readCount: videoData.readCount,
            thumbnailImageUrl: videoData.thumbnailImageUrl,
            videoUrl: `https://chzzk.naver.com/video/${videoData.videoNo}`,
            totalComments: comments.length,
            timelineComments: timelineCount,
            lastCommentSync: new Date(),
            isDeleted: false,
          },
          { upsert: true, new: true }
        );

        // Add delay between videos to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      return NextResponse.json({
        success: true,
        data: stats,
        message: stats.retryStatistics.totalRetries > 0
          ? `Sync completed with ${stats.retryStatistics.totalRetries} retries`
          : 'Sync completed successfully'
      });
    }

    // Update video info (YouTube URL, time offset, etc.)
    if (action === "update-video") {
      const { videoNo, youtubeUrl, timeOffset } = body;

      if (!videoNo) {
        return NextResponse.json(
          { success: false, error: "videoNo is required" },
          { status: 400 }
        );
      }

      const updateData: any = {};
      let offsetCleared = false;

      if (youtubeUrl !== undefined) {
        updateData.youtubeUrl = youtubeUrl;

        // AUTO-CLEAR: Clear offset if URL is empty (BUG-008 fix)
        if (!youtubeUrl || youtubeUrl.trim() === '') {
          updateData.timeOffset = null;
          updateData.syncSetAt = null;
          updateData.youtubeVideoId = null;
          offsetCleared = true;
        } else {
          // Extract YouTube video ID from all URL formats (watch?v=, youtu.be/, embed/)
          // Regex supports: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/embed/ID
          const youtubeIdMatch = youtubeUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([^&\s?]+)/);
          if (youtubeIdMatch) {
            updateData.youtubeVideoId = youtubeIdMatch[1];
          }
        }
      }

      if (timeOffset !== undefined) {
        updateData.timeOffset = timeOffset;
        if (timeOffset === null) {
          updateData.syncSetAt = null;
        } else {
          updateData.syncSetAt = new Date();
        }
      }

      const video = await ChzzkVideo.findOneAndUpdate(
        { videoNo },
        { $set: updateData },
        { new: true }
      );

      if (!video) {
        return NextResponse.json(
          { success: false, error: "Video not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          video,
          offsetCleared
        },
      });
    }

    // Check if video still exists on Chzzk
    if (action === "check-video-status") {
      const { videoNo } = body;

      if (!videoNo) {
        return NextResponse.json(
          { success: false, error: "videoNo is required" },
          { status: 400 }
        );
      }

      const exists = await checkVideoExists(videoNo);

      // Update database if video is deleted
      if (!exists) {
        await ChzzkVideo.findOneAndUpdate(
          { videoNo },
          { $set: { isDeleted: true } }
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          exists,
          isAccessible: exists,
        },
      });
    }

    return NextResponse.json(
      { success: false, error: "Invalid action" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("POST /api/chzzk-sync error:", error);

    // Check if it's a timeout error
    if (error.message?.includes('timeout')) {
      return NextResponse.json(
        {
          error: 'Request Timeout',
          message: error.message,
          code: 'TIMEOUT'
        },
        { status: 504 } // Gateway Timeout
      );
    }

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
