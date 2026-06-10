import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import dbConnect from '@/shared/db/mongodb';
import User from '@/models/User';

export async function GET() {
  try {
    console.log('🔍 타이틀 API 호출 시작');
    const session = await getServerSession(authOptions);
    console.log('🔍 세션 정보:', { channelId: session?.user?.channelId });
    
    if (!session?.user?.channelId) {
      console.log('❌ 세션 없음 또는 channelId 없음');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔗 MongoDB 연결 시도');
    await dbConnect();
    console.log('✅ MongoDB 연결 성공');
    
    console.log('👤 사용자 조회 시도:', session.user.channelId);
    const user = await User.findOne({ channelId: session.user.channelId }).lean();
    console.log('👤 조회된 사용자:', { 
      found: !!user, 
      titlesCount: user?.titles?.length || 0,
      selectedTitle: user?.selectedTitle 
    });
    
    if (!user) {
      console.log('❌ 사용자를 찾을 수 없음');
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const result = {
      titles: user.titles || [],
      selectedTitle: user.selectedTitle || null,
    };
    console.log('✅ 타이틀 정보 반환:', { 
      titlesCount: result.titles.length, 
      selectedTitle: result.selectedTitle 
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('❌ 타이틀 조회 실패:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}