import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { connectToDatabase } from '@/lib/mongodb';
import SongVideo from '@/models/SongVideo';
import SongDetail from '@/models/SongDetail';

export async function POST(request: NextRequest) {
  try {
    // 관리자 권한 확인
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    await connectToDatabase();

    // 모든 곡의 통계를 다시 계산
    const songs = await SongDetail.find({ status: { $ne: 'deleted' } });
    let processedCount = 0;
    let errorCount = 0;

    for (const song of songs) {
      try {
        // 해당 곡의 모든 라이브 클립 조회
        const videos = await SongVideo.find({ 
          songId: song._id.toString() 
        }).sort({ sungDate: -1 });

        if (videos.length > 0) {
          // 가장 최근 부른 날짜 찾기
          const latestVideo = videos[0];
          const latestSungDate = latestVideo.sungDate.toISOString().split('T')[0];

          // 통계 업데이트
          await SongDetail.findByIdAndUpdate(song._id, {
            $set: {
              sungCount: videos.length,
              lastSungDate: latestSungDate
            }
          });
        } else {
          // 라이브 클립이 없는 경우 0으로 설정
          await SongDetail.findByIdAndUpdate(song._id, {
            $set: {
              sungCount: 0,
              lastSungDate: null
            }
          });
        }
        
        processedCount++;
      } catch (error) {
        console.error(`곡 ${song.title} 통계 업데이트 오류:`, error);
        errorCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `통계 재계산 완료`,
      processedCount,
      errorCount,
      totalSongs: songs.length
    });

  } catch (error) {
    console.error('통계 재계산 오류:', error);
    return NextResponse.json(
      { error: '통계 재계산 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}