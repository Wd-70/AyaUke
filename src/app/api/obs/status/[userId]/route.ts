import { NextRequest, NextResponse } from 'next/server';
import { activeOBSUsers } from '@/lib/obsState';

// 세션 없이 순수 메모리 기반 조회 (초고속)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;

  if (!userId) {
    return NextResponse.json({ error: 'User ID required' }, { status: 400 });
  }


  // 메모리에서 직접 조회 (DB 연결, 세션 확인 없음)
  const obsState = activeOBSUsers.get(userId);

  if (!obsState) {
    return NextResponse.json({ 
      active: false,
      message: 'No active OBS session'
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Access-Control-Allow-Origin': '*',
      }
    });
  }

  return NextResponse.json({
    active: true,
    currentSong: obsState.currentSong,
    createdAt: obsState.createdAt
  }, {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache', 
      'Expires': '0',
      'Access-Control-Allow-Origin': '*',
    }
  });
}

// CORS 지원
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