import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { connectToDatabase } from '@/lib/mongodb';
import SongVideo from '@/models/SongVideo';
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

    await SongVideo.findByIdAndDelete(videoId);

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