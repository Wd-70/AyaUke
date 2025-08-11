import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { activeOBSUsers } from '@/lib/obsState';

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // OBS 상태 삭제
    const deleted = activeOBSUsers.delete(session.user.userId);

    console.log(`OBS 상태 삭제: ${session.user.userId} - ${deleted ? '성공' : '이미 없음'}`);

    return NextResponse.json({ 
      success: true,
      deleted: deleted
    });

  } catch (error) {
    console.error('OBS 상태 삭제 오류:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}