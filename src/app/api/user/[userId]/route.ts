import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import User from '@/models/User';

/**
 * GET: 특정 User ObjectId로 사용자 정보 조회 (닉네임 확인용)
 * 
 * 보안 정책:
 * - 인증 불필요 (공개 정보 조회)
 * - User ObjectId만 파라미터로 받음
 * - 닉네임 등 기본 정보만 반환
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    await connectToDatabase();
    
    const { userId } = await params;
    console.log('🔍 사용자 조회 시도:', userId);
    
    // ObjectId 유효성 검사
    if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
      return NextResponse.json(
        { 
          success: false, 
          message: '잘못된 사용자 ID 형식입니다.',
          userId 
        },
        { status: 400 }
      );
    }
    
    // 사용자 정보 조회
    const user = await User.findById(userId).lean();
    console.log('👤 조회 결과:', user ? '발견' : '없음');
    
    if (!user) {
      console.log('❌ 사용자 없음:', userId);
      return NextResponse.json(
        { 
          success: false, 
          message: '사용자를 찾을 수 없습니다.',
          userId 
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        _id: user._id.toString(),
        channelId: user.channelId,
        channelName: user.channelName,
        displayName: user.displayName,
        profileImageUrl: user.profileImageUrl
      }
    });

  } catch (error) {
    console.error('사용자 정보 조회 오류:', error);
    return NextResponse.json(
      { 
        error: '사용자 정보를 조회하는 중 오류가 발생했습니다.',
        success: false 
      },
      { status: 500 }
    );
  }
}