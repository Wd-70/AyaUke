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

    // 중복 영상 확인
    const existingVideo = await SongVideo.findOne({ songId, videoUrl });
    if (existingVideo) {
      return NextResponse.json(
        { error: '이미 등록된 영상입니다.' },
        { status: 409 }
      );
    }

    // 새 영상 생성
    const newVideo = new SongVideo({
      songId,
      title: song.title,
      artist: song.artist,
      videoUrl,
      videoId: videoData.videoId,
      sungDate: new Date(sungDate),
      description,
      startTime: startTime || 0,
      endTime,
      addedBy: session.user.userId,
      addedByName: session.user.displayName || session.user.name || session.user.channelName,
      isVerified: false,
      thumbnailUrl: videoData.thumbnailUrl,
    });

    await newVideo.save();

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