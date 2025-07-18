import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import connectMongoDB from '@/lib/mongodb';
import SongRequest from '@/models/SongRequest';

// POST: 노래 추천 토글
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    await connectMongoDB();

    const songRequest = await SongRequest.findById(params.id);
    if (!songRequest) {
      return NextResponse.json(
        { error: '노래 추천을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const userId = session.user.id;
    const isCurrentlyRecommended = songRequest.recommendedBy.includes(userId);

    if (isCurrentlyRecommended) {
      // 추천 취소
      songRequest.recommendedBy = songRequest.recommendedBy.filter(id => id !== userId);
      songRequest.recommendationCount = Math.max(0, songRequest.recommendationCount - 1);
    } else {
      // 추천 추가
      songRequest.recommendedBy.push(userId);
      songRequest.recommendationCount += 1;
    }

    await songRequest.save();

    return NextResponse.json({
      message: isCurrentlyRecommended ? '추천이 취소되었습니다.' : '추천이 추가되었습니다.',
      recommendationCount: songRequest.recommendationCount,
      isRecommended: !isCurrentlyRecommended
    });

  } catch (error) {
    console.error('추천 토글 오류:', error);
    return NextResponse.json(
      { error: '추천 처리에 실패했습니다.' },
      { status: 500 }
    );
  }
}