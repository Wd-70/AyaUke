import { NextRequest, NextResponse } from 'next/server';
import { activeOBSUsers } from '../../create/route';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    // OBS 상태 조회
    const obsState = activeOBSUsers.get(userId);
    
    // 디버그: 가끔 필요시에만 사용
    // console.log(`🔍 OBS 상태 조회: ${userId}`, { found: !!obsState });

    if (!obsState) {
      return NextResponse.json({ 
        active: false,
        message: 'No active OBS session'
      });
    }

    return NextResponse.json({
      active: true,
      currentSong: obsState.currentSong,
      createdAt: obsState.createdAt
    });

  } catch (error) {
    console.error('OBS 상태 조회 오류:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// CORS 헤더 추가 (OBS 브라우저 소스용)
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}