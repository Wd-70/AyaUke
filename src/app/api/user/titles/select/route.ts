import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.channelId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { titleId } = await request.json();

    await dbConnect();
    
    const user = await User.findOne({ channelId: session.user.channelId });
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // titleId가 null이면 타이틀 해제
    if (titleId === null) {
      user.selectedTitle = null;
    } else {
      // 사용자가 해당 타이틀을 보유하고 있는지 확인
      const hasTitle = user.titles.some((title: any) => title.id === titleId);
      
      if (!hasTitle) {
        return NextResponse.json({ error: 'Title not found' }, { status: 404 });
      }

      user.selectedTitle = titleId;
    }

    await user.save();

    return NextResponse.json({ 
      success: true,
      selectedTitle: user.selectedTitle 
    });
  } catch (error) {
    console.error('타이틀 선택 실패:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}