import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { connectToDatabase } from '@/lib/mongodb';
import SongVideo from '@/models/SongVideo';
import SongDetail from '@/models/SongDetail';
import { updateVideoData, validateYouTubeUrl } from '@/lib/youtube';
import { roleToIsAdmin } from '@/lib/permissions';

interface BulkClipData {
  songId: string;
  videoUrl: string;
  sungDate: string;
  description?: string;
  startTime?: number;
  endTime?: number;
}

// POST: 라이브 클립 일괄 등록
export async function POST(request: NextRequest) {
  try {
    // 인증 및 관리자 권한 확인
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    // 관리자 권한 확인
    const isAdmin = roleToIsAdmin(session.user.role);
    if (!isAdmin) {
      return NextResponse.json(
        { error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    await connectToDatabase();

    const body = await request.json();
    const { clips }: { clips: BulkClipData[] } = body;

    if (!Array.isArray(clips) || clips.length === 0) {
      return NextResponse.json(
        { error: '업로드할 클립 데이터가 없습니다.' },
        { status: 400 }
      );
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
      duplicates: 0
    };

    // 전체 기존 클립 데이터를 메모리에 로드 (서버 2차 검증용)
    const existingClips = await SongVideo.find({}, {
      songId: 1,
      videoId: 1, 
      startTime: 1,
      description: 1,
      sungDate: 1
    }).lean();

    // 기존 클립을 빠른 검색을 위한 Map으로 변환
    const existingClipsMap = new Map();
    existingClips.forEach(clip => {
      const key = `${clip.songId}-${clip.videoId}`;
      if (!existingClipsMap.has(key)) {
        existingClipsMap.set(key, []);
      }
      existingClipsMap.get(key).push({
        startTime: clip.startTime || 0,
        description: clip.description,
        sungDate: clip.sungDate
      });
    });

    // 곡 정보 캐시 (중복 조회 방지)
    const songCache = new Map();

    for (const [index, clipData] of clips.entries()) {
      try {
        // 기본 데이터 검증
        const { songId, videoUrl, sungDate, description, startTime, endTime } = clipData;
        
        if (!songId || !videoUrl || !sungDate) {
          results.errors.push(`클립 ${index + 1}: songId, videoUrl, sungDate는 필수입니다.`);
          results.failed++;
          continue;
        }

        // 곡 존재 확인 (캐시 활용)
        let song = songCache.get(songId);
        if (!song) {
          song = await SongDetail.findById(songId);
          if (!song) {
            results.errors.push(`클립 ${index + 1}: 곡을 찾을 수 없습니다. (ID: ${songId})`);
            results.failed++;
            continue;
          }
          songCache.set(songId, song);
        }

        // 날짜 형식 검증 및 변환 (기존 로직 재사용)
        let validSungDate: Date;
        try {
          let dateString = sungDate.toString().trim();
          
          if (dateString.includes('T') || dateString.includes('Z')) {
            validSungDate = new Date(dateString);
          } else if (dateString.includes('.')) {
            const parts = dateString.split('.');
            if (parts.length === 3) {
              let year = parseInt(parts[0]);
              const month = parseInt(parts[1]) - 1;
              const day = parseInt(parts[2]);
              
              if (year < 100) {
                if (year <= 30) {
                  year += 2000;
                } else {
                  year += 1900;
                }
              }
              
              validSungDate = new Date(year, month, day);
            } else {
              throw new Error('Invalid dot format');
            }
          } else if (dateString.includes('-')) {
            validSungDate = new Date(dateString + 'T00:00:00');
          } else if (dateString.includes('/')) {
            validSungDate = new Date(dateString);
          } else {
            validSungDate = new Date(dateString);
          }
          
          if (isNaN(validSungDate.getTime())) {
            throw new Error('Invalid date format');
          }
          
          const today = new Date();
          if (validSungDate > today) {
            validSungDate = today;
          }
        } catch (dateError) {
          results.errors.push(`클립 ${index + 1}: 올바른 날짜 형식을 입력해주세요. (${sungDate})`);
          results.failed++;
          continue;
        }

        // 유튜브 URL 검증
        if (!validateYouTubeUrl(videoUrl)) {
          results.errors.push(`클립 ${index + 1}: 올바른 유튜브 URL을 입력해주세요.`);
          results.failed++;
          continue;
        }

        // 비디오 ID와 썸네일 URL 추출
        const videoData = updateVideoData(videoUrl);
        if (!videoData) {
          results.errors.push(`클립 ${index + 1}: 유튜브 URL에서 비디오 정보를 추출할 수 없습니다.`);
          results.failed++;
          continue;
        }

        // 서버 사이드 중복 검사 (2차 안전장치)
        const currentStartTime = startTime || 0;
        const clipKey = `${songId}-${videoData.videoId}`;
        const existingClipsForVideo = existingClipsMap.get(clipKey) || [];
        
        const isDuplicate = existingClipsForVideo.some((existing: any) => 
          Math.abs(existing.startTime - currentStartTime) <= 30
        );

        if (isDuplicate) {
          results.errors.push(`클립 ${index + 1}: 동일한 영상의 같은 시간대 클립이 이미 존재합니다. (${song.artist} - ${song.title})`);
          results.duplicates++;
          continue;
        }

        // 새 영상 생성
        const newVideo = new SongVideo({
          songId,
          title: song.title,
          artist: song.artist,
          videoUrl,
          videoId: videoData.videoId,
          sungDate: validSungDate,
          description: description || `타임스탬프 파서로 자동 등록`,
          startTime: currentStartTime,
          endTime,
          addedBy: session.user.userId,
          addedByName: session.user.displayName || session.user.name || session.user.channelName,
          isVerified: false,
          thumbnailUrl: videoData.thumbnailUrl,
        });

        await newVideo.save();

        // 메모리 캐시에도 추가 (후속 중복검사를 위해)
        if (!existingClipsMap.has(clipKey)) {
          existingClipsMap.set(clipKey, []);
        }
        existingClipsMap.get(clipKey).push({
          startTime: currentStartTime,
          description: newVideo.description,
          sungDate: newVideo.sungDate
        });

        results.success++;

      } catch (error) {
        console.error(`클립 ${index + 1} 등록 오류:`, error);
        results.errors.push(`클립 ${index + 1}: 등록 중 오류가 발생했습니다.`);
        results.failed++;
      }
    }

    // 곡 통계 업데이트 (배치 처리 완료 후)
    const updatedSongs = new Set(clips.map(clip => clip.songId));
    const statsUpdatePromises = Array.from(updatedSongs).map(async (songId) => {
      try {
        const actualClipCount = await SongVideo.countDocuments({ songId });
        const latestClip = await SongVideo.findOne({ songId }).sort({ sungDate: -1 }).lean();
        
        const updateData: any = {
          $set: { sungCount: actualClipCount }
        };
        
        if (latestClip?.sungDate) {
          // 로컬 시간 기준으로 날짜 문자열 생성 (UTC 변환 방지)
          const date = new Date(latestClip.sungDate);
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const sungDateString = `${year}-${month}-${day}`;
          updateData.$set.lastSungDate = sungDateString;
        }
        
        await SongDetail.findByIdAndUpdate(songId, updateData);
      } catch (statsError) {
        console.error(`곡 통계 업데이트 오류 (${songId}):`, statsError);
      }
    });

    await Promise.allSettled(statsUpdatePromises);

    return NextResponse.json({
      success: true,
      message: `배치 업로드 완료: 성공 ${results.success}개, 실패 ${results.failed}개, 중복 ${results.duplicates}개`,
      results
    }, { status: 201 });

  } catch (error) {
    console.error('배치 업로드 오류:', error);
    return NextResponse.json(
      { error: '배치 업로드 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}