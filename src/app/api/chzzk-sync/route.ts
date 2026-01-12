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
  authorName: string;
  createTime: number;
}

async function fetchChzzkVideos(channelId: string, size: number = 50): Promise<ChzzkVideoData[]> {
  try {
    // IMPORTANT: Chzzk API has a maximum size limit of 50 videos per request
    // Parameter order and empty values matter for Chzzk API
    // Must match exact format: sortType=LATEST&pagingType=PAGE&page=0&size=N&publishDateAt=&videoType=
    const maxSize = Math.min(size, 50); // Enforce API limit
    const response = await fetchWithTimeout(
      `https://api.chzzk.naver.com/service/v1/channels/${channelId}/videos?sortType=LATEST&pagingType=PAGE&page=0&size=${maxSize}&publishDateAt=&videoType=`,
      {
        headers: {
          "accept": "application/json, text/plain, */*",
          "referer": `https://chzzk.naver.com/${channelId}`,
          "front-client-platform-type": "PC",
          "front-client-product-type": "web",
          "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        },
      },
      30000 // 30 second timeout
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[fetchChzzkVideos] API response:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      throw new Error(`Chzzk API error: ${response.status}`);
    }

    const data = await response.json();

    // Chzzk API returns: {code: 200, message: null, content: {data: [...], page, size, totalCount, totalPages}}
    if (data.code !== 200) {
      throw new Error(`Chzzk API returned error code: ${data.code}, message: ${data.message}`);
    }

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
      // orderType=POPULAR shows best comments first with replyComments included
      const url = `https://apis.naver.com/nng_main/nng_comment_api/v1/type/STREAMING_VIDEO/id/${videoNo}/comments?limit=${limit}&offset=${offset}&orderType=POPULAR&pagingType=PAGE`;

      const response = await fetchWithTimeout(
        url,
        {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            "Accept": "application/json, text/plain, */*",
            "Referer": `https://chzzk.naver.com/video/${videoNo}`,
            "front-client-platform-type": "PC",
            "front-client-product-type": "web",
          },
        },
        30000 // 30 second timeout
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[fetchChzzkComments] API Error for video ${videoNo}:`, {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
          offset,
        });

        if (response.status === 404) {
          console.log(`[fetchChzzkComments] Video ${videoNo} not found (404)`);
          break;
        }
        throw new Error(`Chzzk Comment API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();


      // Chzzk API returns { code, message, content } structure like video API
      if (data.code && data.code !== 200) {
        console.error(`[fetchChzzkComments] API returned error code ${data.code}: ${data.message}`);
        throw new Error(`Chzzk Comment API error code: ${data.code} - ${data.message}`);
      }

      // Check if comments are in data.content or data.comments
      let comments: any[] = [];
      let bestComments: any[] = [];

      if (data.content) {
        // Collect best comments if available (first page only)
        if (offset === 0 && data.content.bestComments && Array.isArray(data.content.bestComments)) {
          bestComments = data.content.bestComments;
          console.log(`[fetchChzzkComments] Found ${bestComments.length} best comments for video ${videoNo}`);
        }

        // Chzzk API returns comments in data.content.comments.data
        if (data.content.comments) {
          if (typeof data.content.comments === 'object' && !Array.isArray(data.content.comments)) {
            // Comments is an object with nested data
            if (data.content.comments.data) {
              comments = data.content.comments.data;
            } else if (data.content.comments.list) {
              comments = data.content.comments.list;
            } else {
              console.error(`[fetchChzzkComments] Unexpected comment structure for video ${videoNo}:`, Object.keys(data.content.comments));
            }
          } else if (Array.isArray(data.content.comments)) {
            comments = data.content.comments;
          }
        } else if (data.content.data) {
          comments = data.content.data;
        } else if (Array.isArray(data.content)) {
          comments = data.content;
        }
      } else if (data.comments) {
        comments = data.comments;
      }

      // Merge best comments with regular comments (avoiding duplicates)
      if (bestComments.length > 0) {
        const regularCommentIds = new Set(comments.map(c => (c.comment || c).commentId));
        const uniqueBestComments = bestComments.filter(bc => !regularCommentIds.has((bc.comment || bc).commentId));
        comments = [...uniqueBestComments, ...comments];
        console.log(`[fetchChzzkComments] Added ${uniqueBestComments.length} unique best comments`);
      }

      if (comments.length === 0) {
        hasMore = false;
        if (offset === 0) {
          console.log(`[fetchChzzkComments] Video ${videoNo} has no comments`);
        }
      } else {
        // Transform nested comment structure to flat structure
        const transformedComments = comments.map((item, index) => {
          /**
           * Chzzk Comment API Response Structure (as of 2025-01-12)
           *
           * Top-level response:
           * {
           *   code: 200,
           *   message: null,
           *   content: {
           *     bestComments: [...],       // Array of best comments (if any)
           *     comments: {
           *       page: number,
           *       data: [...],              // Array of regular comments
           *       totalCount: number,
           *       commentCount: number
           *     },
           *     commentActive: boolean
           *   }
           * }
           *
           * Each comment item has nested structure:
           * {
           *   comment: {
           *     commentId: number,
           *     objectId: string,           // videoNo as string
           *     commentType: string,        // "COMMENT" or "REPLY"
           *     replyCount: number,         // Number of replies
           *     parentCommentId: number,
           *     content: string,            // Comment text with newlines
           *     createdDate: string,        // "YYYYMMDDHHMMSS" format
           *     mentionedUserIdHash: string,
           *     mentionedUserNickname: string,
           *     deleted: boolean,
           *     ...
           *   },
           *   user: {
           *     userIdHash: string,         // Unique hash identifier
           *     userNickname: string,       // Display nickname (e.g., "사향고양이에용")
           *     profileImageUrl: string,
           *     userLevel: number,
           *     writer: boolean,            // Is channel owner
           *     badge: any,
           *     title: any,
           *     userRoleCode: string,       // "common_user", "streamer", etc.
           *     secretOpen: boolean,
           *     buffnerf: any,
           *     privateUserBlock: boolean,
           *     verifiedMark: boolean,
           *     activatedChannelBadgeIds: any[]
           *   },
           *   replyComments: [            // ← Replies are included here!
           *     { comment: {...}, user: {...} },
           *     ...
           *   ]
           * }
           *
           * Note: Replies are already included in replyComments array.
           * No need to call separate API for replies!
           */
          const comment = item.comment || item; // Fallback to item if not nested
          const user = item.user || {};

          // Parse createdDate from "20260110012218" format to timestamp
          let createTime = 0;
          if (comment.createdDate) {
            // Format: YYYYMMDDHHMMSS
            const dateStr = comment.createdDate;
            const year = parseInt(dateStr.substring(0, 4));
            const month = parseInt(dateStr.substring(4, 6)) - 1; // JS months are 0-indexed
            const day = parseInt(dateStr.substring(6, 8));
            const hour = parseInt(dateStr.substring(8, 10));
            const minute = parseInt(dateStr.substring(10, 12));
            const second = parseInt(dateStr.substring(12, 14));
            createTime = new Date(year, month, day, hour, minute, second).getTime();
          }

          const extractedAuthorName = user.userNickname || user.userIdHash || 'Unknown';

          return {
            commentId: comment.commentId,
            videoNo: parseInt(comment.objectId) || videoNo,
            commentType: comment.commentType || 'COMMENT',
            parentCommentId: comment.parentCommentId || undefined,
            content: comment.content,
            userIdHash: user.userIdHash || 'unknown',
            authorName: extractedAuthorName,
            createTime: createTime,
          };
        });

        allComments.push(...transformedComments);

        // Extract replies from replyComments array in each comment
        let replyCount = 0;
        for (const item of comments) {
          const replyComments = item.replyComments || [];

          if (replyComments.length > 0) {
            const transformedReplies = replyComments.map((replyItem: any) => {
              const reply = replyItem.comment || replyItem;
              const user = replyItem.user || {};

              // Parse createdDate
              let createTime = 0;
              if (reply.createdDate) {
                const dateStr = reply.createdDate;
                const year = parseInt(dateStr.substring(0, 4));
                const month = parseInt(dateStr.substring(4, 6)) - 1;
                const day = parseInt(dateStr.substring(6, 8));
                const hour = parseInt(dateStr.substring(8, 10));
                const minute = parseInt(dateStr.substring(10, 12));
                const second = parseInt(dateStr.substring(12, 14));
                createTime = new Date(year, month, day, hour, minute, second).getTime();
              }

              return {
                commentId: reply.commentId,
                videoNo: parseInt(reply.objectId) || videoNo,
                commentType: reply.commentType || 'REPLY',
                parentCommentId: reply.parentCommentId || undefined,
                content: reply.content,
                userIdHash: user.userIdHash || 'unknown',
                authorName: user.userNickname || user.userIdHash || 'Unknown',
                createTime: createTime,
              };
            });

            allComments.push(...transformedReplies);
            replyCount += transformedReplies.length;
          }
        }

        if (replyCount > 0 && offset === 0) {
          console.log(`[fetchChzzkComments] Extracted ${replyCount} replies from replyComments arrays`);
        }

        offset += limit;

        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error: any) {
      console.error(`[fetchChzzkComments] CRITICAL ERROR for video ${videoNo}:`, {
        error: error.message,
        stack: error.stack,
        offset,
        totalCollected: allComments.length,
      });
      hasMore = false;

      // If we haven't collected any comments yet and got an error, this is a real failure
      if (allComments.length === 0) {
        console.error(`[fetchChzzkComments] ZERO COMMENTS COLLECTED - This will result in empty comment list!`);
      }
    }
  }

  console.log(`[fetchChzzkComments] Completed for video ${videoNo}: collected ${allComments.length} total comments`);
  return allComments;
}

async function checkVideoExists(videoNo: number): Promise<boolean> {
  try {
    // Use v3 API (v1 returns 500 with version error)
    // Add cache-busting query parameter like the browser does
    const dt = Date.now().toString(36).substring(0, 5);
    const response = await fetchWithTimeout(
      `https://api.chzzk.naver.com/service/v3/videos/${videoNo}?dt=${dt}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          "Accept": "application/json, text/plain, */*",
          "Referer": `https://chzzk.naver.com/video/${videoNo}`,
          "front-client-platform-type": "PC",
          "front-client-product-type": "web",
        },
      },
      15000 // 15 second timeout for quick check
    );

    if (!response.ok) {
      return false;
    }

    // Check the response body to verify video is actually accessible
    const data = await response.json();
    return data.code === 200 && data.content?.videoNo === videoNo;
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
          // Helper to send SSE message - MUST be defined before try-catch blocks
          const sendEvent = (event: string, data: any) => {
            const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
            controller.enqueue(encoder.encode(message));
          };

          try {

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
                const needsCommentSync = existingVideo && (existingVideo.totalComments === 0 || !existingVideo.lastCommentSync);

                if (existingVideo && !force && !needsCommentSync) {
                  // Skip only if video exists, force is false, AND comments were already collected
                  sendEvent('video_skip', {
                    current: i + 1,
                    total: totalVideos,
                    videoTitle: videoData.videoTitle,
                    reason: 'already_exists'
                  });
                  stats.processedVideos++;
                  continue;
                }

                if (needsCommentSync) {
                  console.log(`[Sync] Re-syncing comments for video ${videoData.videoNo} (totalComments=${existingVideo.totalComments})`);
                  sendEvent('video_start', {
                    current: i + 1,
                    total: totalVideos,
                    videoNo: videoData.videoNo,
                    videoTitle: videoData.videoTitle,
                    thumbnailUrl: videoData.thumbnailImageUrl,
                    reason: 'resync_comments'
                  });
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
                      authorName: commentData.authorName,
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
            // Split by lines and process each line individually
            const lines = comment.content.split('\n');

            const convertedLines = lines.map(line => {
              const trimmedLine = line.trim();
              if (!trimmedLine) return line;

              // Match timestamp at the start of the line: H:MM:SS or MM:SS
              // Priority: HH:MM:SS first, then MM:SS
              const timePatternHMS = /^(\d{1,2}:\d{2}:\d{2})/;
              const timePatternMS = /^(\d{1,2}:\d{2})/;

              let match = trimmedLine.match(timePatternHMS);
              if (!match) {
                match = trimmedLine.match(timePatternMS);
              }

              if (match) {
                const originalTime = match[1];
                const seconds = parseTimeToSeconds(originalTime);
                const newSeconds = seconds + (video.timeOffset || 0);
                const newTimestamp = formatSeconds(newSeconds);

                return trimmedLine.replace(originalTime, newTimestamp);
              }

              return trimmedLine;
            });

            return convertedLines.join('\n');
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

    // Get HLS URL for a video
    if (action === "get-hls-url") {
      const videoNo = searchParams.get("videoNo");

      if (!videoNo) {
        return NextResponse.json(
          { success: false, error: "videoNo is required" },
          { status: 400 }
        );
      }

      try {
        const dt = Date.now().toString(36).substring(0, 5);
        const response = await fetchWithTimeout(
          `https://api.chzzk.naver.com/service/v3/videos/${videoNo}?dt=${dt}`,
          {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
              "Accept": "application/json, text/plain, */*",
              "Referer": `https://chzzk.naver.com/video/${videoNo}`,
              "front-client-platform-type": "PC",
              "front-client-product-type": "web",
            },
          },
          15000
        );

        if (!response.ok) {
          throw new Error("Failed to fetch video info");
        }

        const data = await response.json();

        if (data.code !== 200 || !data.content?.liveRewindPlaybackJson) {
          throw new Error("Video not available");
        }

        const playbackData = JSON.parse(data.content.liveRewindPlaybackJson);
        const hlsMedia = playbackData.media?.find((m: any) => m.mediaId === "HLS");

        if (!hlsMedia?.path) {
          throw new Error("HLS stream not found");
        }

        return NextResponse.json({
          success: true,
          data: {
            hlsUrl: hlsMedia.path,
            duration: playbackData.meta?.duration || 0,
            videoTitle: data.content.videoTitle,
          },
        });
      } catch (err: any) {
        console.error("Error fetching HLS URL:", err);
        return NextResponse.json(
          { success: false, error: err.message || "Failed to get HLS URL" },
          { status: 500 }
        );
      }
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
        const needsCommentSync = existingVideo && (existingVideo.totalComments === 0 || !existingVideo.lastCommentSync);

        if (existingVideo && !force && !needsCommentSync) {
          // Skip only if video exists, force is false, AND comments were already collected
          console.log(`[Sync] Skipping video ${videoData.videoNo} (already synced with ${existingVideo.totalComments} comments)`);
          continue;
        }

        if (needsCommentSync) {
          console.log(`[Sync] Re-syncing comments for video ${videoData.videoNo} (totalComments=${existingVideo.totalComments})`);
        } else {
          stats.newVideos++;
        }

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

      // Update database with current status
      await ChzzkVideo.findOneAndUpdate(
        { videoNo },
        { $set: { isDeleted: !exists } }
      );

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
