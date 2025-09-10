import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { connectToDatabase } from '@/lib/mongodb';
import SongVideo from '@/models/SongVideo';
import SongDetail from '@/models/SongDetail';
import { SongVideo as SongVideoType } from '@/types';
import { updateVideoData, validateYouTubeUrl } from '@/lib/youtube';

// GET: 특정 곡의 영상 목록 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ songId: string }> }
) {
  try {
    await connectToDatabase();
    
    const { songId } = await params;
    
    // 곡이 존재하는지 확인
    const song = await SongDetail.findById(songId);
    if (!song) {
      return NextResponse.json(
        { error: '곡을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 영상 목록 조회 (최신순)
    const videos = await SongVideo.find({ songId })
      .sort({ sungDate: -1, createdAt: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      videos: videos.map(video => ({
        ...video,
        _id: video._id.toString(),
      })),
    });
  } catch (error) {
    console.error('영상 목록 조회 오류:', error);
    return NextResponse.json(
      { error: '영상 목록을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// POST: 새 영상 추가
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ songId: string }> }
) {
  try {
    // 인증 확인
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    await connectToDatabase();
    
    const { songId } = await params;
    const body = await request.json();
    
    // 곡이 존재하는지 확인
    const song = await SongDetail.findById(songId);
    if (!song) {
      return NextResponse.json(
        { error: '곡을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 요청 데이터 검증
    const { videoUrl, sungDate, description, startTime, endTime } = body;
    
    if (!videoUrl || !sungDate) {
      return NextResponse.json(
        { error: '유튜브 URL과 부른 날짜는 필수입니다.' },
        { status: 400 }
      );
    }

    // 날짜 형식 검증 및 변환
    let validSungDate: Date;
    try {
      let dateString = sungDate.toString().trim();
      
      // 다양한 날짜 형식 지원
      if (dateString.includes('T') || dateString.includes('Z')) {
        // ISO 8601 형식
        validSungDate = new Date(dateString);
      } else if (dateString.includes('.')) {
        // YY.MM.DD 또는 YYYY.MM.DD 형식 처리
        const parts = dateString.split('.');
        if (parts.length === 3) {
          let year = parseInt(parts[0]);
          const month = parseInt(parts[1]) - 1; // 월은 0부터 시작
          const day = parseInt(parts[2]);
          
          // 2자리 연도를 4자리로 변환 (25 → 2025, 99 → 1999)
          if (year < 100) {
            if (year <= 30) {
              year += 2000; // 00-30은 2000-2030
            } else {
              year += 1900; // 31-99는 1931-1999
            }
          }
          
          validSungDate = new Date(year, month, day);
        } else {
          throw new Error('Invalid dot format');
        }
      } else if (dateString.includes('-')) {
        // YYYY-MM-DD 형식
        validSungDate = new Date(dateString + 'T00:00:00');
      } else if (dateString.includes('/')) {
        // MM/DD/YYYY 또는 DD/MM/YYYY 형식
        validSungDate = new Date(dateString);
      } else {
        // 기타 형식 시도
        validSungDate = new Date(dateString);
      }
      
      // 유효한 날짜인지 확인
      if (isNaN(validSungDate.getTime())) {
        throw new Error('Invalid date format');
      }
      
      // 미래 날짜는 오늘로 제한
      const today = new Date();
      if (validSungDate > today) {
        validSungDate = today;
      }
    } catch (dateError) {
      console.error('날짜 변환 오류:', dateError, 'Original sungDate:', sungDate);
      return NextResponse.json(
        { error: `올바른 날짜 형식을 입력해주세요. 받은 값: ${sungDate}` },
        { status: 400 }
      );
    }

    // 유튜브 URL 검증
    if (!validateYouTubeUrl(videoUrl)) {
      return NextResponse.json(
        { error: '올바른 유튜브 URL을 입력해주세요.' },
        { status: 400 }
      );
    }

    // 비디오 ID와 썸네일 URL 추출
    const videoData = updateVideoData(videoUrl);
    if (!videoData) {
      return NextResponse.json(
        { error: '올바른 유튜브 URL을 입력해주세요.' },
        { status: 400 }
      );
    }

    // 중복 검사 (동일한 영상+시작시간±30초 중복 방지)
    const currentStartTime = startTime || 0;
    const existingVideo = await SongVideo.findOne({
      songId,
      videoId: videoData.videoId,
      startTime: {
        $gte: currentStartTime - 30,
        $lte: currentStartTime + 30
      }
    });

    if (existingVideo) {
      return NextResponse.json({
        success: false,
        error: '동일한 영상의 같은 시간대 클립이 이미 존재합니다.',
        existingVideo: {
          _id: existingVideo._id.toString(),
          description: existingVideo.description,
          sungDate: existingVideo.sungDate
        }
      }, { status: 409 }); // Conflict
    }

    // 새 영상 생성
    const newVideo = new SongVideo({
      songId,
      title: song.title,
      artist: song.artist,
      videoUrl,
      videoId: videoData.videoId,
      sungDate: validSungDate, // 검증된 날짜 사용
      description,
      startTime: startTime || 0,
      endTime,
      addedBy: session.user.userId,
      addedByName: session.user.displayName || session.user.name || session.user.channelName,
      isVerified: false,
      thumbnailUrl: videoData.thumbnailUrl,
    });

    await newVideo.save();

    // 곡 통계 업데이트 (효율적인 하이브리드 방식)
    try {
      // 로컬 시간 기준으로 날짜 문자열 생성 (UTC 변환 방지)
      const year = validSungDate.getFullYear();
      const month = String(validSungDate.getMonth() + 1).padStart(2, '0');
      const day = String(validSungDate.getDate()).padStart(2, '0');
      const sungDateString = `${year}-${month}-${day}`; // YYYY-MM-DD 형식
      
      // 요청 헤더에서 배치 업로드 여부 확인
      const isBatchUpload = request.headers.get('x-batch-upload') === 'true';
      
      if (isBatchUpload) {
        // 배치 업로드 시: 증가만 하고 정확한 계산은 배치 완료 후 수행
        const currentSong = await SongDetail.findById(songId);
        const updateData: any = { $inc: { sungCount: 1 } };
        
        // 마지막 부른 날짜는 더 최근 날짜로만 업데이트
        if (!currentSong?.lastSungDate || sungDateString > currentSong.lastSungDate) {
          updateData.$set = { lastSungDate: sungDateString };
        }
        
        await SongDetail.findByIdAndUpdate(songId, updateData);
      } else {
        // 일반 업로드 시: 정확한 개수로 계산 (단일 업로드는 성능 영향 미미)
        const actualClipCount = await SongVideo.countDocuments({ songId });
        
        // 현재 곡 정보를 가져와서 기존 마지막 부른 날짜와 비교
        const currentSong = await SongDetail.findById(songId);
        
        const updateData: any = {
          $set: { sungCount: actualClipCount }
        };
        
        // 마지막 부른 날짜는 더 최근 날짜로만 업데이트
        if (!currentSong?.lastSungDate || sungDateString > currentSong.lastSungDate) {
          updateData.$set.lastSungDate = sungDateString;
        }
        
        await SongDetail.findByIdAndUpdate(songId, updateData);
      }
    } catch (statsError) {
      console.error('곡 통계 업데이트 오류:', statsError);
      // 통계 업데이트 실패해도 라이브 클립 생성은 성공으로 처리
    }

    return NextResponse.json({
      success: true,
      video: {
        ...newVideo.toObject(),
        _id: newVideo._id.toString(),
      },
    }, { status: 201 });
  } catch (error) {
    console.error('영상 추가 오류:', error);
    return NextResponse.json(
      { error: '영상을 추가하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}