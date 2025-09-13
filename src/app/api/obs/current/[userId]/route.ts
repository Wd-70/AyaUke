import { NextRequest, NextResponse } from 'next/server';
import { activeOBSUsers } from '@/lib/obsState';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    // OBS 상태 조회 (메모리 기반, DB 연결 불필요)
    const obsState = activeOBSUsers.get(userId);

    if (!obsState) {
      return NextResponse.json({ 
        active: false,
        message: 'No active OBS session'
      }, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
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
        'Expires': '0'
      }
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