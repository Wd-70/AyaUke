import { NextRequest, NextResponse } from 'next/server';
import connectMongoDB from '@/lib/mongodb';
import SongRequest from '@/models/SongRequest';

// GET: 노래 추천 통계 조회
export async function GET(request: NextRequest) {
  try {
    await connectMongoDB();

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalRequests,
      weeklyNewRequests,
      totalRecommendations,
      pendingPromotions,
      activeContributors
    ] = await Promise.all([
      // 총 곡 수
      SongRequest.countDocuments(),
      
      // 이번 주 새로 추가된 곡 수
      SongRequest.countDocuments({
        submittedAt: { $gte: oneWeekAgo }
      }),
      
      // 총 추천 수
      SongRequest.aggregate([
        {
          $group: {
            _id: null,
            totalRecommendations: { $sum: '$recommendationCount' }
          }
        }
      ]).then(result => result[0]?.totalRecommendations || 0),
      
      // 승격 대기 중인 곡 수
      SongRequest.countDocuments({
        status: 'pending_approval'
      }),
      
      // 활성 기여자 수 (최근 한 달 내 편집한 사용자 수)
      SongRequest.aggregate([
        {
          $match: {
            'editHistory.editedAt': { 
              $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) 
            }
          }
        },
        {
          $unwind: '$editHistory'
        },
        {
          $match: {
            'editHistory.editedAt': { 
              $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) 
            }
          }
        },
        {
          $group: {
            _id: '$editHistory.userId'
          }
        },
        {
          $count: 'uniqueContributors'
        }
      ]).then(result => result[0]?.uniqueContributors || 0)
    ]);

    return NextResponse.json({
      totalRequests,
      weeklyNewRequests,
      totalRecommendations,
      pendingPromotions,
      activeContributors
    });

  } catch (error) {
    console.error('통계 조회 오류:', error);
    return NextResponse.json(
      { error: '통계 정보를 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}