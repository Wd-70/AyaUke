import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import SongVideo from '@/models/SongVideo';
import User from '@/models/User';

/**
 * PATCH: 라이브 클립 업로더 닉네임 동기화
 * 
 * 보안 정책:
 * - 인증 불필요 (누구나 호출 가능)
 * - 클립 ID만 파라미터로 받음
 * - 서버에서 업로더 정보를 다시 조회하여 검증
 * - 닉네임이 실제로 변경된 경우에만 업데이트
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    await connectToDatabase();
    
    const { videoId } = await params;
    
    // 1. 클립 정보 조회
    const video = await SongVideo.findById(videoId);
    if (!video) {
      return NextResponse.json(
        { error: '클립을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 2. 업로더의 현재 정보 조회 (ObjectId로 조회)
    const currentUser = await User.findById(video.addedBy);
    if (!currentUser) {
      return NextResponse.json(
        { 
          success: false, 
          message: '업로더 정보를 찾을 수 없습니다. 사용자가 탈퇴했을 수 있습니다.',
          updated: false 
        },
        { status: 200 }
      );
    }

    // 3. 닉네임 변경 여부 확인 (displayName 우선, 없으면 channelName)
    const currentNickname = currentUser.displayName || currentUser.channelName;
    const storedNickname = video.addedByName;

    if (currentNickname === storedNickname) {
      return NextResponse.json({
        success: true,
        message: '닉네임이 동일합니다. 업데이트가 필요하지 않습니다.',
        updated: false,
        currentNickname,
        storedNickname
      });
    }

    // 4. 닉네임이 변경된 경우 업데이트
    video.addedByName = currentNickname;
    await video.save();

    console.log(`✅ 클립 ${videoId} 업로더 닉네임 동기화: "${storedNickname}" → "${currentNickname}"`);

    return NextResponse.json({
      success: true,
      message: '업로더 닉네임이 성공적으로 동기화되었습니다.',
      updated: true,
      previousNickname: storedNickname,
      currentNickname: currentNickname,
      videoId: video._id.toString()
    });

  } catch (error) {
    console.error('업로더 닉네임 동기화 오류:', error);
    return NextResponse.json(
      { 
        error: '업로더 닉네임 동기화 중 오류가 발생했습니다.',
        updated: false 
      },
      { status: 500 }
    );
  }
}