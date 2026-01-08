import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { isSuperAdmin, UserRole } from '@/lib/permissions';
import { connectToDatabase } from '@/lib/mongodb';
import SongVideo from '@/models/SongVideo';
import User from '@/models/User';

/**
 * POST: SongVideo 스키마 마이그레이션
 * addedBy 필드를 channelId에서 User ObjectId로 변경
 * 
 * 보안: 최고관리자만 접근 가능
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !isSuperAdmin(session.user.role as UserRole)) {
      return NextResponse.json(
        { error: '최고관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    await connectToDatabase();
    
    console.log('🔄 SongVideo 스키마 마이그레이션 시작');
    
    // 1. 모든 SongVideo 조회 (channelId가 저장된 상태)
    const videos = await SongVideo.find({}).lean();
    console.log(`📊 총 ${videos.length}개 비디오 발견`);
    
    let migratedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];
    
    for (const video of videos) {
      try {
        // addedBy가 이미 ObjectId 형태인지 확인
        if (video.addedBy && video.addedBy.toString().match(/^[0-9a-fA-F]{24}$/)) {
          console.log(`✅ 비디오 ${video._id}: 이미 ObjectId 형태`);
          continue;
        }
        
        // channelId로 User 찾기
        const user = await User.findOne({ channelId: video.addedBy }).lean();
        
        if (!user) {
          const errorMsg = `❌ 비디오 ${video._id}: 사용자 ${video.addedBy} 찾을 수 없음`;
          console.log(errorMsg);
          errors.push(errorMsg);
          errorCount++;
          continue;
        }
        
        // addedBy를 User ObjectId로 업데이트
        await SongVideo.findByIdAndUpdate(video._id, {
          addedBy: user._id
        });
        
        console.log(`✅ 비디오 ${video._id}: ${video.addedBy} → ${user._id}`);
        migratedCount++;
        
      } catch (error) {
        const errorMsg = `❌ 비디오 ${video._id} 마이그레이션 실패: ${error}`;
        console.error(errorMsg);
        errors.push(errorMsg);
        errorCount++;
      }
    }
    
    console.log('🎯 마이그레이션 완료');
    console.log(`✅ 성공: ${migratedCount}개`);
    console.log(`❌ 실패: ${errorCount}개`);
    
    return NextResponse.json({
      success: true,
      message: 'SongVideo 스키마 마이그레이션 완료',
      statistics: {
        total: videos.length,
        migrated: migratedCount,
        errors: errorCount,
        errorDetails: errors
      }
    });

  } catch (error) {
    console.error('마이그레이션 오류:', error);
    return NextResponse.json(
      { 
        error: '마이그레이션 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}