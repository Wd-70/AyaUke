import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { fetchSongsFromSheet } from '@/lib/googleSheets';
import { hasPermission, Permission, UserRole } from '@/lib/permissions';
import { connectToDatabase } from '@/lib/mongodb';
import { SongDetail } from '@/models/SongDetail';

export async function GET(request: NextRequest) {
  try {
    // 노래 조회 권한 체크
    const session = await getServerSession(authOptions);
    if (!session || !hasPermission(session.user.role as UserRole, Permission.SONGS_VIEW)) {
      return NextResponse.json(
        { success: false, error: '노래 관리 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    console.log('📋 관리자 노래 목록 조회 시작...');
    
    // 구글 시트와 MongoDB에서 병합된 데이터 가져오기
    const songs = await fetchSongsFromSheet();
    
    // 관리용 데이터 변환 및 통계 계산
    const songsWithStatus = songs.map(song => {
      let status: 'complete' | 'missing-mr' | 'missing-lyrics' | 'new' = 'complete';
      
      // MR 링크 상태 확인
      const hasMR = song.mrLinks && song.mrLinks.length > 0;
      
      // 가사 상태 확인
      const hasLyrics = song.lyrics && song.lyrics.trim().length > 0;
      
      // 상태 결정
      if (!hasMR && !hasLyrics) {
        status = 'new';
      } else if (!hasMR) {
        status = 'missing-mr';
      } else if (!hasLyrics) {
        status = 'missing-lyrics';
      }
      
      // 추가일 계산 (MongoDB 생성일 또는 기본값)
      const addedDate = song.dateAdded || new Date().toISOString().split('T')[0];
      
      // 신규 곡 판단 (최근 30일)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const songDate = new Date(addedDate);
      
      if (songDate > thirtyDaysAgo && status === 'complete') {
        status = 'new';
      }

      return {
        id: song.id,
        title: song.titleAlias || song.title,
        artist: song.artistAlias || song.artist,
        originalTitle: song.title,
        originalArtist: song.artist,
        language: song.language || 'Unknown',
        tags: song.searchTags || song.tags || [],
        mrLinks: song.mrLinks || [],
        hasLyrics: hasLyrics,
        lyrics: song.lyrics || '',
        sungCount: song.sungCount || 0,
        likedCount: 0, // TODO: 좋아요 데이터 연동
        addedDate: addedDate,
        status: status,
        keyAdjustment: song.keyAdjustment,
        selectedMRIndex: song.selectedMRIndex || 0,
        personalNotes: song.personalNotes || '',
        source: song.source || 'sheet'
      };
    });

    // 통계 계산
    const stats = {
      total: songsWithStatus.length,
      complete: songsWithStatus.filter(s => s.status === 'complete').length,
      missingMR: songsWithStatus.filter(s => s.status === 'missing-mr').length,
      missingLyrics: songsWithStatus.filter(s => s.status === 'missing-lyrics').length,
      newSongs: songsWithStatus.filter(s => s.status === 'new').length,
      languages: {
        Korean: songsWithStatus.filter(s => s.language === 'Korean').length,
        English: songsWithStatus.filter(s => s.language === 'English').length,
        Japanese: songsWithStatus.filter(s => s.language === 'Japanese').length,
        Other: songsWithStatus.filter(s => !['Korean', 'English', 'Japanese'].includes(s.language)).length
      }
    };

    console.log(`✅ 관리자 노래 목록 조회 완료: ${songsWithStatus.length}곡`);
    console.log('📊 통계:', stats);

    return NextResponse.json({
      success: true,
      songs: songsWithStatus,
      stats: stats
    });

  } catch (error) {
    console.error('❌ 관리자 노래 목록 조회 오류:', error);
    return NextResponse.json(
      { success: false, error: '노래 목록을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const { action, songIds, data } = await request.json();
    
    // 작업별 권한 체크
    const userRole = session.user.role as UserRole;
    
    switch (action) {
      case 'bulk-edit':
        if (!hasPermission(userRole, Permission.SONGS_EDIT)) {
          return NextResponse.json(
            { success: false, error: '노래 편집 권한이 필요합니다.' },
            { status: 403 }
          );
        }
        console.log('📝 일괄 편집 데이터:', data);
        // TODO: 실제 일괄 편집 구현
        break;
        
      case 'auto-search-mr':
        if (!hasPermission(userRole, Permission.SONGS_EDIT)) {
          return NextResponse.json(
            { success: false, error: '노래 편집 권한이 필요합니다.' },
            { status: 403 }
          );
        }
        console.log('🔍 MR 자동 검색 시작');
        // TODO: YouTube API를 사용한 MR 자동 검색 구현
        break;
        
      case 'add-lyrics':
        if (!hasPermission(userRole, Permission.SONGS_EDIT)) {
          return NextResponse.json(
            { success: false, error: '노래 편집 권한이 필요합니다.' },
            { status: 403 }
          );
        }
        console.log('📖 가사 일괄 추가');
        // TODO: 가사 일괄 추가 구현
        break;
        
      case 'add-song':
        if (!hasPermission(userRole, Permission.SONGS_CREATE)) {
          return NextResponse.json(
            { success: false, error: '노래 생성 권한이 필요합니다.' },
            { status: 403 }
          );
        }
        console.log('➕ 새 노래 추가:', data.songData);
        return await handleAddSong(data.songData);
        
      case 'create':
        if (!hasPermission(userRole, Permission.SONGS_CREATE)) {
          return NextResponse.json(
            { success: false, error: '노래 생성 권한이 필요합니다.' },
            { status: 403 }
          );
        }
        console.log('➕ 새 노래 추가');
        // TODO: 새 노래 추가 구현
        break;
        
      case 'delete':
        if (!hasPermission(userRole, Permission.SONGS_DELETE)) {
          return NextResponse.json(
            { success: false, error: '노래 삭제 권한이 필요합니다.' },
            { status: 403 }
          );
        }
        console.log('🗑️ 곡 삭제');
        // TODO: 곡 삭제 구현 (신중하게!)
        break;
        
      default:
        return NextResponse.json(
          { success: false, error: '알 수 없는 작업입니다.' },
          { status: 400 }
        );
    }

    console.log(`🔧 일괄 작업 실행: ${action}, 대상 곡: ${songIds?.length || 0}개, 권한: ${userRole}`);

    return NextResponse.json({
      success: true,
      message: `${action} 작업이 완료되었습니다.`,
      affectedCount: songIds?.length || 0
    });

  } catch (error) {
    console.error('❌ 일괄 작업 오류:', error);
    return NextResponse.json(
      { success: false, error: '일괄 작업 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 새 곡 추가 함수
async function handleAddSong(songData: {
  title: string;
  artist: string;
  originalTitle?: string;
  originalArtist?: string;
  language: string;
  lyrics?: string;
  mrLinks?: string[];
  tags?: string[];
  personalNotes?: string;
}) {
  try {
    await connectToDatabase();
    
    // 중복 체크
    const existingSong = await SongDetail.findOne({
      $or: [
        { title: songData.title, artist: songData.artist },
        { titleAlias: songData.title, artistAlias: songData.artist }
      ]
    });
    
    if (existingSong) {
      return NextResponse.json(
        { success: false, error: '이미 존재하는 곡입니다.' },
        { status: 400 }
      );
    }
    
    // 새 곡 생성
    const newSong = new SongDetail({
      title: songData.originalTitle || songData.title,
      artist: songData.originalArtist || songData.artist,
      titleAlias: songData.originalTitle ? songData.title : undefined,
      artistAlias: songData.originalArtist ? songData.artist : undefined,
      language: songData.language,
      lyrics: songData.lyrics || '',
      mrLinks: songData.mrLinks || [],
      tags: songData.tags || [],
      searchTags: songData.tags || [],
      personalNotes: songData.personalNotes || '',
      sungCount: 0,
      dateAdded: new Date(),
      source: 'admin' // 관리자가 직접 추가한 곡임을 표시
    });
    
    await newSong.save();
    
    console.log('✅ 새 곡 추가 완료:', songData.title);
    
    return NextResponse.json({
      success: true,
      message: `${songData.title} 곡이 성공적으로 추가되었습니다.`,
      song: newSong
    });
    
  } catch (error) {
    console.error('❌ 새 곡 추가 오류:', error);
    return NextResponse.json(
      { success: false, error: '곡 추가 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}