import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { connectToDatabase } from '@/lib/mongodb';
import SongVideo from '@/models/SongVideo';
import { canManageSongs, UserRole } from '@/lib/permissions';

// PUT: 영상 검증 (관리자 전용)
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

    // 관리자 권한 확인
    if (!canManageSongs(session.user.role as UserRole)) {
      return NextResponse.json(
        { error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    await connectToDatabase();
    
    const { videoId } = await params;
    const body = await request.json();
    const { isVerified } = body;
    
    if (typeof isVerified !== 'boolean') {
      return NextResponse.json(
        { error: 'isVerified 값이 올바르지 않습니다.' },
        { status: 400 }
      );
    }

    const video = await SongVideo.findById(videoId);
    if (!video) {
      return NextResponse.json(
        { error: '영상을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 검증 정보 업데이트
    const updateData: any = {
      isVerified,
    };

    if (isVerified) {
      updateData.verifiedBy = session.user.channelId;
      updateData.verifiedAt = new Date();
    } else {
      updateData.verifiedBy = undefined;
      updateData.verifiedAt = undefined;
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
      message: isVerified ? '영상이 검증되었습니다.' : '영상 검증이 해제되었습니다.',
    });
  } catch (error) {
    console.error('영상 검증 오류:', error);
    return NextResponse.json(
      { error: '영상 검증 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}