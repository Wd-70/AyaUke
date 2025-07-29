import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { isSuperAdmin, UserRole } from '@/lib/permissions';
import dbConnect from '@/lib/mongodb';
import SongDetail from '@/models/SongDetail';

export async function POST(request: NextRequest) {
  try {
    // 최고관리자만 데이터 수정 가능
    const session = await getServerSession(authOptions);
    if (!session || !isSuperAdmin(session.user.role as UserRole)) {
      return NextResponse.json({
        success: false,
        error: '최고관리자 권한이 필요합니다. 이 API는 모든 곡 데이터를 수정합니다.'
      }, { status: 403 });
    }

    await dbConnect();
    
    // 모든 문서 가져오기
    const allSongs = await SongDetail.find({});
    console.log(`총 ${allSongs.length}곡을 수정합니다...`);
    
    const results = [];
    
    for (const song of allSongs) {
      try {
        // title과 artist 서로 바꾸기
        const originalTitle = song.title;
        const originalArtist = song.artist;
        
        await SongDetail.findByIdAndUpdate(song._id, {
          title: originalArtist,   // 기존 artist를 title로
          artist: originalTitle,   // 기존 title을 artist로
        });
        
        results.push({
          _id: song._id,
          before: { title: originalTitle, artist: originalArtist },
          after: { title: originalArtist, artist: originalTitle },
          success: true
        });
        
      } catch (error) {
        results.push({
          _id: song._id,
          error: error instanceof Error ? error.message : 'Unknown error',
          success: false
        });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    const failCount = results.length - successCount;
    
    return NextResponse.json({
      message: '데이터 수정 완료',
      total: allSongs.length,
      success: successCount,
      failed: failCount,
      sample: results.slice(0, 5) // 처음 5개만 샘플 표시
    });
    
  } catch (error) {
    console.error('Error fixing data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}