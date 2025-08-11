import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { activeOBSUsers, OBSUserState } from '@/lib/obsState';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { currentSong } = body;

    if (!currentSong || !currentSong.title || !currentSong.artist) {
      return NextResponse.json({ error: 'Missing song information' }, { status: 400 });
    }


    // 기존 데이터가 있으면 에러 반환 (먼저 삭제해야 함)
    if (activeOBSUsers.has(session.user.userId)) {
      return NextResponse.json({ 
        error: 'OBS already active. Please delete existing state first.' 
      }, { status: 409 });
    }

    // OBS 상태 생성
    const obsState: OBSUserState = {
      userId: session.user.userId,
      currentSong: {
        title: currentSong.title,
        artist: currentSong.artist
      },
      createdAt: new Date()
    };

    activeOBSUsers.set(session.user.userId, obsState);

    console.log(`OBS 상태 생성: ${session.user.userId} - ${currentSong.artist} - ${currentSong.title}`);

    return NextResponse.json({ 
      success: true,
      obsUrl: `/obs/overlay/${session.user.userId}`
    });

  } catch (error) {
    console.error('OBS 상태 생성 오류:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

