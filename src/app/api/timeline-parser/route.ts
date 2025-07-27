import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { hasPermission, Permission, UserRole } from '@/lib/permissions';
import dbConnect from '@/lib/mongodb';
import { YouTubeComment, YouTubeVideo } from '@/models/YouTubeComment';
import SongDetail from '@/models/SongDetail';
import mongoose from 'mongoose';

// 라이브 클립 데이터를 위한 MongoDB 스키마
const LiveClipSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  videoId: { type: String, required: true },
  videoTitle: { type: String, required: true },
  uploadedDate: { type: Date, required: true }, // 파싱된 날짜
  originalDateString: { type: String }, // 원본 날짜 문자열
  artist: { type: String, required: true }, // songData1
  songTitle: { type: String, required: true }, // songData2
  videoUrl: { type: String, required: true }, // 기본 비디오 URL (t 파라미터 제외)
  startTimeSeconds: { type: Number, required: true }, // 시작 시간 (초)
  endTimeSeconds: { type: Number }, // 종료 시간 (초, 마지막 곡은 null)
  duration: { type: Number }, // 곡 길이 (초)
  isRelevant: { type: Boolean, default: true },
  isExcluded: { type: Boolean, default: false },
  matchedSong: {
    songId: { type: String },
    title: { type: String },
    artist: { type: String },
    confidence: { type: Number }
  },
  originalComment: { type: String, required: true }, // 원본 댓글
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const LiveClip = mongoose.models.LiveClip || mongoose.model('LiveClip', LiveClipSchema);

// HTML 엔티티 디코딩 함수
function decodeHtmlEntities(text: string): string {
  const entities: { [key: string]: string } = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#x27;': "'",
    '&#x2F;': '/',
    '&#x60;': '`',
    '&#x3D;': '='
  };
  
  return text.replace(/&[#\w]+;/g, (entity) => {
    return entities[entity] || entity;
  });
}

// 개선된 타임라인 파싱 함수
function parseTimelineComment(htmlText: string, videoTitle: string) {
  console.log(`🔍 원본 HTML: ${htmlText.substring(0, 300)}...`);
  
  // HTML 엔티티 디코딩
  const decodedHtml = decodeHtmlEntities(htmlText);
  console.log(`🔧 디코딩 후: ${decodedHtml.substring(0, 300)}...`);
  
  // 새로운 패턴: <a>태그와 그 다음에 오는 텍스트를 함께 매칭
  // 패턴: <a href="...">시간</a> 아티스트 - 곡명 <br>
  const fullPattern = /<a[^>]*href="([^"]*)"[^>]*>[^<]*<\/a>\s*([^<]*?)(?:<br>|$)/gi;
  const songEntries = [];
  let match;

  const rawMatches = [];
  while ((match = fullPattern.exec(decodedHtml)) !== null) {
    const url = match[1];
    const songText = match[2].trim();
    
    console.log(`🔗 발견된 링크: ${url}`);
    console.log(`🎵 곡 정보 텍스트: "${songText}"`);
    
    // YouTube 링크인지 확인
    if (url.includes('youtube.com/watch') || url.includes('youtu.be/')) {
      // 타임스탬프 추출 (t= 파라미터)
      const timestampMatch = url.match(/[?&]t=(\d+)/);
      
      if (timestampMatch && songText) {
        const timeSeconds = parseInt(timestampMatch[1]);
        
        // 곡 정보 파싱
        const songInfo = parseSongInfo(songText);
        
        // 구분자로 나뉘는지 확인 (관련성 판단)
        const isRelevant = songInfo.artist !== '알 수 없음';
        
        rawMatches.push({
          url,
          timeSeconds,
          artist: songInfo.artist,
          songTitle: songInfo.songTitle,
          isRelevant: isRelevant
        });
        
        console.log(`${isRelevant ? '✅' : '⚠️'} 추가됨: ${timeSeconds}초 - ${songInfo.artist} - ${songInfo.songTitle} ${isRelevant ? '(관련성 있음)' : '(관련성 없음)'}`);
      } else {
        console.log(`❌ 타임스탬프 없음 또는 곡 정보 없음`);
      }
    } else {
      console.log(`❌ YouTube 링크 아님: ${url}`);
    }
  }
  
  console.log(`📊 총 ${rawMatches.length}개 유효한 곡 발견`);

  // 시간순 정렬
  rawMatches.sort((a, b) => a.timeSeconds - b.timeSeconds);

  // 기본 비디오 URL 추출 (t 파라미터 제거)
  const baseVideoUrl = rawMatches.length > 0 ? 
    rawMatches[0].url.replace(/[?&]t=\d+/, '').replace(/[?&]$/, '') : '';

  // 날짜 추출
  const dateInfo = extractDateFromTitle(videoTitle);

  // 각 곡 정보와 시작/종료 시간 계산
  for (let i = 0; i < rawMatches.length; i++) {
    const current = rawMatches[i];
    const next = rawMatches[i + 1];
    
    const liveClip = {
      videoUrl: baseVideoUrl,
      artist: current.artist,
      songTitle: current.songTitle,
      startTimeSeconds: current.timeSeconds,
      endTimeSeconds: next ? next.timeSeconds : null,
      duration: next ? (next.timeSeconds - current.timeSeconds) : null,
      uploadedDate: dateInfo.date,
      originalDateString: dateInfo.originalString,
      isRelevant: current.isRelevant
    };
    
    songEntries.push(liveClip);
  }

  return songEntries;
}

// 곡 정보 파싱 함수 (아티스트와 곡명 분리)
function parseSongInfo(songText: string) {
  console.log(`🎵 파싱할 곡 정보: "${songText}"`);
  
  const cleanText = songText.trim();
  
  // 다양한 구분자로 분리 시도
  const separators = [' - ', ' – ', ' — ', ' | ', ' / '];
  
  for (const separator of separators) {
    if (cleanText.includes(separator)) {
      const parts = cleanText.split(separator);
      if (parts.length >= 2 && parts[0].trim() && parts[1].trim()) {
        const result = {
          artist: parts[0].trim(),
          songTitle: parts.slice(1).join(separator).trim()
        };
        console.log(`✅ 분리 성공 (구분자: "${separator}"): ${result.artist} - ${result.songTitle}`);
        return result;
      }
    }
  }
  
  // 구분자가 없는 경우, 전체를 곡명으로 처리
  const result = {
    artist: '알 수 없음',
    songTitle: cleanText
  };
  console.log(`⚠️ 구분자 없음, 곡명만: ${result.songTitle}`);
  return result;
}

// 초를 MM:SS 형식으로 변환
function formatSeconds(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// 문자열 유사도 계산 (Levenshtein distance 기반)
function calculateSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 1;
  
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1;
  
  const distance = levenshteinDistance(s1, s2);
  return (maxLen - distance) / maxLen;
}

// Levenshtein distance 계산
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

// 텍스트 정규화 (매칭 정확도 향상을 위해)
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[\(\)\[\]{}]/g, '') // 괄호 제거
    .replace(/\s+/g, ' ') // 연속 공백을 하나로
    .replace(/[^\w\s가-힣]/g, '') // 특수문자 제거 (한글, 영문, 숫자, 공백만 유지)
    .trim();
}

// 노래 데이터베이스에서 매칭 찾기
async function findSongMatches(artist: string, songTitle: string) {
  try {
    // 활성 상태인 곡들만 검색
    const songs = await SongDetail.find({ 
      status: { $in: ['active', 'pending'] } 
    }).lean();
    
    const normalizedInputArtist = normalizeText(artist);
    const normalizedInputTitle = normalizeText(songTitle);
    
    const matches = [];
    
    for (const song of songs) {
      // 기본 아티스트/제목 매칭
      const artistSimilarity = calculateSimilarity(normalizedInputArtist, normalizeText(song.artist));
      const titleSimilarity = calculateSimilarity(normalizedInputTitle, normalizeText(song.title));
      
      // 별칭이 있는 경우 별칭도 확인
      let bestArtistSimilarity = artistSimilarity;
      let bestTitleSimilarity = titleSimilarity;
      
      if (song.artistAlias) {
        const aliasSimilarity = calculateSimilarity(normalizedInputArtist, normalizeText(song.artistAlias));
        bestArtistSimilarity = Math.max(bestArtistSimilarity, aliasSimilarity);
      }
      
      if (song.titleAlias) {
        const aliasSimilarity = calculateSimilarity(normalizedInputTitle, normalizeText(song.titleAlias));
        bestTitleSimilarity = Math.max(bestTitleSimilarity, aliasSimilarity);
      }
      
      // 검색 태그도 확인
      if (song.searchTags && song.searchTags.length > 0) {
        for (const tag of song.searchTags) {
          const tagArtistSimilarity = calculateSimilarity(normalizedInputArtist, normalizeText(tag));
          const tagTitleSimilarity = calculateSimilarity(normalizedInputTitle, normalizeText(tag));
          bestArtistSimilarity = Math.max(bestArtistSimilarity, tagArtistSimilarity);
          bestTitleSimilarity = Math.max(bestTitleSimilarity, tagTitleSimilarity);
        }
      }
      
      // 종합 점수 계산 (아티스트 40%, 제목 60%)
      const overallConfidence = (bestArtistSimilarity * 0.4) + (bestTitleSimilarity * 0.6);
      
      // 최소 신뢰도 기준 (0.6 이상만 후보로 선정)
      if (overallConfidence >= 0.6) {
        matches.push({
          songId: song._id.toString(),
          title: song.title,
          artist: song.artist,
          confidence: overallConfidence,
          artistSimilarity: bestArtistSimilarity,
          titleSimilarity: bestTitleSimilarity,
          matchedField: bestArtistSimilarity > artistSimilarity || bestTitleSimilarity > titleSimilarity ? 'alias' : 'main'
        });
      }
    }
    
    // 신뢰도 순으로 정렬하고 상위 5개만 반환
    return matches
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);
      
  } catch (error) {
    console.error('노래 매칭 중 오류:', error);
    return [];
  }
}

// 최적 매칭 선택 (가장 높은 신뢰도)
async function getBestSongMatch(artist: string, songTitle: string) {
  const matches = await findSongMatches(artist, songTitle);
  
  if (matches.length === 0) return null;
  
  const bestMatch = matches[0];
  
  // 신뢰도가 0.8 이상일 때만 자동 매칭으로 처리
  if (bestMatch.confidence >= 0.8) {
    return {
      songId: bestMatch.songId,
      title: bestMatch.title,
      artist: bestMatch.artist,
      confidence: bestMatch.confidence
    };
  }
  
  return null;
}

// 비디오 제목에서 날짜 추출 (개선된 버전)
function extractDateFromTitle(title: string): { date: Date | null, originalString: string | null } {
  // 25.06.01 형식 패턴 (YY.MM.DD)
  const shortYearPattern = /(\d{2})\.(\d{1,2})\.(\d{1,2})/;
  const shortYearMatch = title.match(shortYearPattern);
  
  if (shortYearMatch) {
    const year = parseInt(shortYearMatch[1]);
    const month = parseInt(shortYearMatch[2]);
    const day = parseInt(shortYearMatch[3]);
    
    // 2000년대로 가정 (25 -> 2025)
    const fullYear = year < 50 ? 2000 + year : 1900 + year;
    
    try {
      const date = new Date(fullYear, month - 1, day);
      return {
        date: date,
        originalString: shortYearMatch[0]
      };
    } catch (error) {
      console.error('날짜 파싱 오류:', error);
    }
  }

  // 다른 날짜 형식들
  const datePatterns = [
    {
      pattern: /(\d{4})[\.\-\/](\d{1,2})[\.\-\/](\d{1,2})/,  // 2024.03.15, 2024-03-15
      parser: (match: RegExpMatchArray) => new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]))
    },
    {
      pattern: /(\d{1,2})[\.\-\/](\d{1,2})[\.\-\/](\d{4})/,  // 03.15.2024
      parser: (match: RegExpMatchArray) => new Date(parseInt(match[3]), parseInt(match[1]) - 1, parseInt(match[2]))
    },
    {
      pattern: /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/,       // 2024년 3월 15일
      parser: (match: RegExpMatchArray) => new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]))
    }
  ];

  for (const { pattern, parser } of datePatterns) {
    const match = title.match(pattern);
    if (match) {
      try {
        const date = parser(match);
        return {
          date: date,
          originalString: match[0]
        };
      } catch (error) {
        console.error('날짜 파싱 오류:', error);
      }
    }
  }

  return { date: null, originalString: null };
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
    const { action, itemId, isRelevant, isExcluded } = body;

    switch (action) {
      case 'parse-timeline-comments':
        console.log('🔄 타임라인 댓글 파싱 시작...');
        
        // 타임라인 댓글만 조회
        const timelineComments = await YouTubeComment.find({ 
          isTimeline: true 
        });

        console.log(`📝 총 ${timelineComments.length}개 타임라인 댓글 발견`);

        // 처음 몇 개 댓글의 샘플 출력
        console.log('\n📋 첫 3개 댓글 샘플:');
        for (let i = 0; i < Math.min(3, timelineComments.length); i++) {
          const sample = timelineComments[i];
          console.log(`\n샘플 ${i + 1} (${sample.commentId}):`);
          console.log(`내용: ${sample.textContent.substring(0, 300)}`);
          console.log(`HTML 링크 포함: ${sample.textContent.includes('<a ')}`);
          console.log(`YouTube 링크 포함: ${sample.textContent.includes('youtube.com')}`);
        }

        let processedCount = 0;
        let totalLiveClips = 0;

        for (const comment of timelineComments) {
          try {
            // 비디오 정보 조회
            const video = await YouTubeVideo.findOne({ videoId: comment.videoId });
            if (!video) continue;

            // 디버그: 댓글 내용 확인
            console.log(`\n🔍 댓글 내용 (${comment.commentId}):`);
            console.log(comment.textContent.substring(0, 200) + '...');
            
            // HTML 링크가 있는지 확인
            const hasHtmlLinks = comment.textContent.includes('<a ');
            console.log(`HTML 링크 포함: ${hasHtmlLinks}`);
            
            if (hasHtmlLinks) {
              // 타임라인 댓글 파싱
              const liveClips = parseTimelineComment(comment.textContent, video.title);
              console.log(`파싱 결과: ${liveClips.length}개 클립`);
              
              if (liveClips.length > 0) {
                console.log(`🎵 ${video.title}에서 ${liveClips.length}개 곡 발견`);
                
                for (const clipData of liveClips) {
                  const clipId = `${comment.commentId}_${clipData.startTimeSeconds}`;
                  
                  // 기존 라이브 클립이 있는지 확인
                  const existingClip = await LiveClip.findOne({
                    videoId: comment.videoId,
                    startTimeSeconds: clipData.startTimeSeconds
                  });

                  if (!existingClip) {
                    const liveClip = new LiveClip({
                      id: clipId,
                      videoId: comment.videoId,
                      videoTitle: video.title,
                      uploadedDate: clipData.uploadedDate || video.publishedAt,
                      originalDateString: clipData.originalDateString,
                      artist: clipData.artist,
                      songTitle: clipData.songTitle,
                      videoUrl: clipData.videoUrl,
                      startTimeSeconds: clipData.startTimeSeconds,
                      endTimeSeconds: clipData.endTimeSeconds,
                      duration: clipData.duration,
                      originalComment: comment.textContent,
                      isRelevant: clipData.isRelevant,
                      isExcluded: false
                    });

                    await liveClip.save();
                    totalLiveClips++;
                    
                    console.log(`💾 저장: ${clipData.artist} - ${clipData.songTitle} (${formatSeconds(clipData.startTimeSeconds)}${clipData.endTimeSeconds ? ` ~ ${formatSeconds(clipData.endTimeSeconds)}` : ''}) ${clipData.isRelevant ? '[관련성 있음]' : '[관련성 없음]'}`);
                  }
                }
              }
              
              processedCount++;
            } else {
              console.log(`❌ HTML 링크 없음, 건너뜀`);
            }
          } catch (error) {
            console.error(`댓글 파싱 오류 (${comment.commentId}):`, error);
          }
        }

        // 통계 계산
        const totalVideos = await YouTubeVideo.countDocuments();
        const totalTimelineComments = await YouTubeComment.countDocuments({ isTimeline: true });
        const allLiveClips = await LiveClip.find().sort({ uploadedDate: -1, startTimeSeconds: 1 });
        const relevantClips = allLiveClips.filter(clip => clip.isRelevant && !clip.isExcluded).length;
        const matchedClips = allLiveClips.filter(clip => clip.matchedSong).length;
        
        // 고유 곡 수 계산
        const uniqueSongsSet = new Set();
        allLiveClips.forEach(clip => {
          uniqueSongsSet.add(`${clip.artist}_${clip.songTitle}`);
        });

        const stats = {
          totalVideos,
          totalTimelineComments,
          parsedItems: allLiveClips.length,
          relevantItems: relevantClips,
          matchedSongs: matchedClips,
          uniqueSongs: uniqueSongsSet.size
        };

        console.log(`✅ 타임라인 파싱 완료: ${processedCount}개 댓글에서 ${totalLiveClips}개 라이브 클립 생성`);

        return NextResponse.json({
          success: true,
          data: {
            items: allLiveClips,
            stats
          },
          message: `타임라인 파싱 완료: ${totalLiveClips}개 라이브 클립 생성`
        });

      case 'update-item-relevance':
        if (!itemId) {
          return NextResponse.json(
            { success: false, error: 'itemId가 필요합니다.' },
            { status: 400 }
          );
        }

        await LiveClip.updateOne(
          { id: itemId },
          { 
            isRelevant: isRelevant,
            updatedAt: new Date()
          }
        );

        return NextResponse.json({
          success: true,
          message: '관련성 상태가 업데이트되었습니다.'
        });

      case 'update-item-exclusion':
        if (!itemId) {
          return NextResponse.json(
            { success: false, error: 'itemId가 필요합니다.' },
            { status: 400 }
          );
        }

        await LiveClip.updateOne(
          { id: itemId },
          { 
            isExcluded: isExcluded,
            updatedAt: new Date()
          }
        );

        return NextResponse.json({
          success: true,
          message: '제외 상태가 업데이트되었습니다.'
        });

      case 'find-song-matches':
        if (!itemId) {
          return NextResponse.json(
            { success: false, error: 'itemId가 필요합니다.' },
            { status: 400 }
          );
        }

        const liveClip = await LiveClip.findOne({ id: itemId });
        if (!liveClip) {
          return NextResponse.json(
            { success: false, error: '라이브 클립을 찾을 수 없습니다.' },
            { status: 404 }
          );
        }

        const songMatches = await findSongMatches(liveClip.artist, liveClip.songTitle);
        
        return NextResponse.json({
          success: true,
          data: {
            liveClip: {
              id: liveClip.id,
              artist: liveClip.artist,
              songTitle: liveClip.songTitle
            },
            matches: songMatches
          }
        });

      case 'assign-song-match':
        const { songId, confidence } = body;
        
        if (!itemId || !songId) {
          return NextResponse.json(
            { success: false, error: 'itemId와 songId가 필요합니다.' },
            { status: 400 }
          );
        }

        // 선택된 곡 정보 조회
        const selectedSong = await SongDetail.findById(songId);
        if (!selectedSong) {
          return NextResponse.json(
            { success: false, error: '선택된 곡을 찾을 수 없습니다.' },
            { status: 404 }
          );
        }

        await LiveClip.updateOne(
          { id: itemId },
          { 
            matchedSong: {
              songId: selectedSong._id.toString(),
              title: selectedSong.title,
              artist: selectedSong.artist,
              confidence: confidence || 1.0 // 수동 매칭은 기본적으로 100% 신뢰도
            },
            updatedAt: new Date()
          }
        );

        return NextResponse.json({
          success: true,
          message: '곡 매칭이 완료되었습니다.'
        });

      case 'remove-song-match':
        if (!itemId) {
          return NextResponse.json(
            { success: false, error: 'itemId가 필요합니다.' },
            { status: 400 }
          );
        }

        await LiveClip.updateOne(
          { id: itemId },
          { 
            $unset: { matchedSong: "" },
            updatedAt: new Date()
          }
        );

        return NextResponse.json({
          success: true,
          message: '곡 매칭이 해제되었습니다.'
        });

      case 'update-live-clip':
        const { artist, songTitle, startTimeSeconds, endTimeSeconds } = body;
        
        if (!itemId) {
          return NextResponse.json(
            { success: false, error: 'itemId가 필요합니다.' },
            { status: 400 }
          );
        }

        const updateFields: any = { updatedAt: new Date() };
        
        if (artist !== undefined) updateFields.artist = artist.trim();
        if (songTitle !== undefined) updateFields.songTitle = songTitle.trim();
        if (startTimeSeconds !== undefined) updateFields.startTimeSeconds = startTimeSeconds;
        if (endTimeSeconds !== undefined) updateFields.endTimeSeconds = endTimeSeconds;

        // 지속 시간 재계산 (종료 시간이 있는 경우)
        if (endTimeSeconds !== undefined && startTimeSeconds !== undefined) {
          updateFields.duration = endTimeSeconds > startTimeSeconds ? endTimeSeconds - startTimeSeconds : null;
        }

        await LiveClip.updateOne(
          { id: itemId },
          updateFields
        );

        return NextResponse.json({
          success: true,
          message: '라이브 클립 정보가 업데이트되었습니다.'
        });

      default:
        return NextResponse.json(
          { success: false, error: '올바르지 않은 action입니다.' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('타임라인 파서 API 오류:', error);
    
    let errorMessage = '알 수 없는 오류가 발생했습니다.';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
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

    switch (action) {
      case 'get-parsed-items':
        const items = await LiveClip.find().sort({ uploadedDate: -1, startTimeSeconds: 1 });
        
        return NextResponse.json({
          success: true,
          data: items
        });

      default:
        return NextResponse.json(
          { success: false, error: '올바르지 않은 action입니다.' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('타임라인 파서 GET API 오류:', error);
    
    return NextResponse.json(
      { success: false, error: '데이터 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}