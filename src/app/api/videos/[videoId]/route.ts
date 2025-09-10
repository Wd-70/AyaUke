import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { connectToDatabase } from '@/lib/mongodb';
import SongVideo from '@/models/SongVideo';
import SongDetail from '@/models/SongDetail';
import { canManageSongs, UserRole } from '@/lib/permissions';
import { updateVideoData, validateYouTubeUrl } from '@/lib/youtube';

// GET: 특정 영상 정보 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    await connectToDatabase();
    
    const { videoId } = await params;
    
    const video = await SongVideo.findById(videoId).lean();
    if (!video) {
      return NextResponse.json(
        { error: '영상을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      video: {
        ...video,
        _id: video._id.toString(),
      },
    });
  } catch (error) {
    console.error('영상 조회 오류:', error);
    return NextResponse.json(
      { error: '영상을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// PUT: 영상 정보 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    await connectToDatabase();
    
    const { videoId } = await params;
    const body = await request.json();
    
    const video = await SongVideo.findById(videoId);
    if (!video) {
      return NextResponse.json(
        { error: '영상을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 권한 확인: 영상을 추가한 사용자 또는 관리자만 수정 가능
    // 마이그레이션 전후를 모두 지원 (ObjectId 또는 channelId)
    const isOwnerByUserId = video.addedBy.toString() === session.user.userId;
    const isOwnerByChannelId = video.addedBy.toString() === session.user.channelId;
    const isOwner = isOwnerByUserId || isOwnerByChannelId;
    const isAdmin = canManageSongs(session.user.role as UserRole);
    
    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: '수정 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 수정 가능한 필드들
    const { videoUrl, sungDate, description, startTime, endTime } = body;
    
    const updateData: any = {};
    
    if (videoUrl !== undefined) {
      // 유튜브 URL 검증
      if (!validateYouTubeUrl(videoUrl)) {
        return NextResponse.json(
          { error: '올바른 유튜브 URL을 입력해주세요.' },
          { status: 400 }
        );
      }
      
      // videoUrl이 변경되면 videoId와 thumbnailUrl도 함께 업데이트
      const videoData = updateVideoData(videoUrl);
      if (videoData) {
        updateData.videoUrl = videoUrl;
        updateData.videoId = videoData.videoId;
        updateData.thumbnailUrl = videoData.thumbnailUrl;
      } else {
        return NextResponse.json(
          { error: '올바른 유튜브 URL을 입력해주세요.' },
          { status: 400 }
        );
      }
    }
    
    if (sungDate !== undefined) {
      updateData.sungDate = new Date(sungDate);
    }
    
    if (description !== undefined) {
      updateData.description = description;
    }
    
    if (startTime !== undefined) {
      updateData.startTime = startTime;
    }
    
    if (endTime !== undefined) {
      updateData.endTime = endTime;
    }

    const updatedVideo = await SongVideo.findByIdAndUpdate(
      videoId,
      updateData,
      { new: true, runValidators: true }
    );

    // sungDate가 수정된 경우 해당 곡의 lastSungDate 재계산 (수정된 클립이 최신일 경우만)
    if (sungDate !== undefined && updatedVideo) {
      try {
        const songId = updatedVideo.songId;
        
        // 해당 곡의 모든 클립 중 가장 최신 날짜 찾기
        const latestClip = await SongVideo.findOne({ songId })
          .sort({ sungDate: -1 })
          .lean();
        
        // 수정된 클립이 해당 곡의 최신 클립인지 확인
        if (latestClip && latestClip._id.toString() === videoId) {
          // 로컬 시간 기준으로 날짜 문자열 생성 (UTC 변환 방지)
          const date = new Date(latestClip.sungDate);
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const sungDateString = `${year}-${month}-${day}`;
          
          // 곡의 lastSungDate 업데이트
          await SongDetail.findByIdAndUpdate(songId, {
            $set: { lastSungDate: sungDateString }
          });
          
          console.log(`📅 곡 ${songId}의 lastSungDate가 ${sungDateString}으로 업데이트되었습니다 (최신 클립 수정).`);
        } else {
          console.log(`📅 곡 ${songId}: 수정된 클립이 최신이 아니므로 lastSungDate를 업데이트하지 않습니다.`);
        }
      } catch (statsError) {
        console.error('곡 통계 업데이트 오류:', statsError);
        // 에러가 발생해도 클립 수정은 성공으로 처리
      }
    }

    return NextResponse.json({
      success: true,
      video: {
        ...updatedVideo.toObject(),
        _id: updatedVideo._id.toString(),
      },
    });
  } catch (error) {
    console.error('영상 수정 오류:', error);
    return NextResponse.json(
      { error: '영상을 수정하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// DELETE: 영상 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    await connectToDatabase();
    
    const { videoId } = await params;
    
    const video = await SongVideo.findById(videoId);
    if (!video) {
      return NextResponse.json(
        { error: '영상을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 권한 확인: 영상을 추가한 사용자 또는 관리자만 삭제 가능
    // 마이그레이션 전후를 모두 지원 (ObjectId 또는 channelId)
    const isOwnerByUserId = video.addedBy.toString() === session.user.userId;
    const isOwnerByChannelId = video.addedBy.toString() === session.user.channelId;
    const isOwner = isOwnerByUserId || isOwnerByChannelId;
    const isAdmin = canManageSongs(session.user.role as UserRole);
    
    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: '삭제 권한이 없습니다.' },
        { status: 403 }
      );
    }

    const songId = video.songId;
    await SongVideo.findByIdAndDelete(videoId);

    // 곡 통계 업데이트 (삭제 후 실제 클립 개수 재계산)
    try {
      const actualClipCount = await SongVideo.countDocuments({ songId });
      
      if (actualClipCount > 0) {
        // 남은 클립이 있으면 가장 최근 날짜 찾기
        const latestVideo = await SongVideo.findOne({ songId }).sort({ sungDate: -1 });
        const latestSungDate = latestVideo?.sungDate.toISOString().split('T')[0];
        
        await SongDetail.findByIdAndUpdate(songId, {
          $set: {
            sungCount: actualClipCount,
            lastSungDate: latestSungDate
          }
        });
      } else {
        // 클립이 모두 삭제되면 0으로 설정
        await SongDetail.findByIdAndUpdate(songId, {
          $set: {
            sungCount: 0,
            lastSungDate: null
          }
        });
      }
    } catch (statsError) {
      console.error('삭제 후 곡 통계 업데이트 오류:', statsError);
    }

    return NextResponse.json({
      success: true,
      message: '영상이 삭제되었습니다.',
    });
  } catch (error) {
    console.error('영상 삭제 오류:', error);
    return NextResponse.json(
      { error: '영상을 삭제하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}