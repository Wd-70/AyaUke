import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { fetchSongDetailsFromMongo } from '@/lib/googleSheets';
import { hasPermission, Permission, UserRole } from '@/lib/permissions';
import dbConnect from '@/lib/mongodb';
import SongDetail from '@/models/SongDetail';

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

    
    // MongoDB에서 곡 데이터 직접 가져오기 (구글시트 제외)
    const { songDetails } = await fetchSongDetailsFromMongo();
    
    // SongDetail을 Song 형태로 변환하여 관리용 데이터 생성
    const songs = songDetails.map(detail => ({
      id: detail._id.toString(),
      title: detail.title,
      artist: detail.artist,
      titleAlias: detail.titleAlias,
      artistAlias: detail.artistAlias,
      language: detail.language || 'Korean',
      mrLinks: detail.mrLinks || [],
      lyrics: detail.lyrics || '',
      personalNotes: detail.personalNotes || '',
      tags: detail.searchTags || [],
      keyAdjustment: detail.keyAdjustment, // 키 조절 데이터 추가
      selectedMRIndex: detail.selectedMRIndex || 0, // 선택된 MR 인덱스 추가
      createdAt: detail.createdAt,
      updatedAt: detail.updatedAt,
      source: 'mongodb' as const
    }));
    
    // 관리용 데이터 변환 및 통계 계산
    const songsWithStatus = songs.map(song => {
      let status: 'complete' | 'missing-mr' | 'missing-lyrics' | 'incomplete' = 'complete';
      
      // MR 링크 상태 확인
      const hasMR = song.mrLinks && song.mrLinks.length > 0;
      
      // 가사 상태 확인
      const hasLyrics = song.lyrics && song.lyrics.trim().length > 0;
      
      // 상태 결정
      if (!hasMR && !hasLyrics) {
        status = 'incomplete';
      } else if (!hasMR) {
        status = 'missing-mr';
      } else if (!hasLyrics) {
        status = 'missing-lyrics';
      }

      return {
        id: song.id,
        title: song.titleAlias || song.title, // 별칭이 있으면 별칭 사용
        artist: song.artistAlias || song.artist, // 별칭이 있으면 별칭 사용
        originalTitle: song.title,
        originalArtist: song.artist,
        language: song.language || 'Unknown',
        tags: song.tags || [],
        mrLinks: song.mrLinks || [],
        hasLyrics: hasLyrics,
        lyrics: song.lyrics || '',
        sungCount: 0, // TODO: 부른 횟수 데이터 연동
        likedCount: 0, // TODO: 좋아요 데이터 연동
        addedDate: song.createdAt || new Date(),
        status: status,
        keyAdjustment: song.keyAdjustment, // MongoDB에서 실제 키 조절 데이터 사용
        selectedMRIndex: song.selectedMRIndex || 0, // MongoDB에서 실제 선택된 MR 인덱스 사용
        personalNotes: song.personalNotes || '',
        source: 'mongodb'
      };
    });

    // 통계 계산
    const stats = {
      total: songsWithStatus.length,
      complete: songsWithStatus.filter(s => s.status === 'complete').length,
      missingMR: songsWithStatus.filter(s => s.status === 'missing-mr' || s.status === 'incomplete').length, // MR 없음 + 미완성
      missingLyrics: songsWithStatus.filter(s => s.status === 'missing-lyrics' || s.status === 'incomplete').length, // 가사 없음 + 미완성
      incomplete: songsWithStatus.filter(s => s.status === 'incomplete').length,
      languages: {
        Korean: songsWithStatus.filter(s => s.language === 'Korean').length,
        English: songsWithStatus.filter(s => s.language === 'English').length,
        Japanese: songsWithStatus.filter(s => s.language === 'Japanese').length,
        Chinese: songsWithStatus.filter(s => s.language === 'Chinese').length,
        Other: songsWithStatus.filter(s => !['Korean', 'English', 'Japanese', 'Chinese'].includes(s.language)).length
      }
    };

    console.log(`📊 관리자 목록: MongoDB에서 ${songsWithStatus.length}곡 로드`);

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

    const body = await request.json();
    const { action, songIds, data, songData } = body;
    
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
        return await handleBulkEdit(songIds, data);
        
      case 'add-tags':
        if (!hasPermission(userRole, Permission.SONGS_EDIT)) {
          return NextResponse.json(
            { success: false, error: '노래 편집 권한이 필요합니다.' },
            { status: 403 }
          );
        }
        return await handleAddTags(songIds, data);
        
      case 'edit-song':
        if (!hasPermission(userRole, Permission.SONGS_EDIT)) {
          return NextResponse.json(
            { success: false, error: '노래 편집 권한이 필요합니다.' },
            { status: 403 }
          );
        }
        return await handleEditSong(songIds[0], data);
        
      case 'auto-search-mr':
        if (!hasPermission(userRole, Permission.SONGS_EDIT)) {
          return NextResponse.json(
            { success: false, error: '노래 편집 권한이 필요합니다.' },
            { status: 403 }
          );
        }
        // TODO: YouTube API를 사용한 MR 자동 검색 구현
        break;
        
      case 'add-lyrics':
        if (!hasPermission(userRole, Permission.SONGS_EDIT)) {
          return NextResponse.json(
            { success: false, error: '노래 편집 권한이 필요합니다.' },
            { status: 403 }
          );
        }
        // TODO: 가사 일괄 추가 구현
        break;
        
      case 'add-song':
        if (!hasPermission(userRole, Permission.SONGS_CREATE)) {
          return NextResponse.json(
            { success: false, error: '노래 생성 권한이 필요합니다.' },
            { status: 403 }
          );
        }
        return await handleAddSong(songData);
        
      case 'create':
        if (!hasPermission(userRole, Permission.SONGS_CREATE)) {
          return NextResponse.json(
            { success: false, error: '노래 생성 권한이 필요합니다.' },
            { status: 403 }
          );
        }
        // TODO: 새 노래 추가 구현
        break;
        
      case 'delete-songs':
        if (!hasPermission(userRole, Permission.SONGS_DELETE)) {
          return NextResponse.json(
            { success: false, error: '노래 삭제 권한이 필요합니다.' },
            { status: 403 }
          );
        }
        return await handleDeleteSongs(songIds, session.user.channelId, data?.reason);
        
      case 'delete':
        if (!hasPermission(userRole, Permission.SONGS_DELETE)) {
          return NextResponse.json(
            { success: false, error: '노래 삭제 권한이 필요합니다.' },
            { status: 403 }
          );
        }
        // TODO: 곡 삭제 구현 (신중하게!)
        break;
        
      default:
        return NextResponse.json(
          { success: false, error: '알 수 없는 작업입니다.' },
          { status: 400 }
        );
    }


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
  language: string;
  lyrics?: string;
  mrLinks?: string[];
  tags?: string[];
}) {
  try {
    await dbConnect();
    
    // 중복 체크 (제목+아티스트 복합 unique이므로 둘 다 확인)
    const existingSong = await SongDetail.findOne({
      title: songData.title,
      artist: songData.artist
    });
    
    if (existingSong) {
      return NextResponse.json(
        { success: false, error: '같은 제목과 아티스트의 곡이 이미 존재합니다.' },
        { status: 400 }
      );
    }
    
    // MR 링크를 올바른 형식으로 변환
    const mrLinks = songData.mrLinks?.map(url => ({ url })) || [];
    
    // 새 곡 생성
    const newSong = new SongDetail({
      title: songData.title,
      artist: songData.artist,
      language: songData.language,
      lyrics: songData.lyrics || '',
      mrLinks: mrLinks,
      searchTags: songData.tags || [],
      personalNotes: '',
      sungCount: 0,
      // 새 필드들 (명시적으로 설정)
      status: 'active',
      sourceType: 'admin'
    });
    
    await newSong.save();
    
    console.log(`✅ 새 곡 추가: ${songData.title}`);
    
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

// 일괄 편집 함수
async function handleBulkEdit(songIds: string[], editData: {
  artist?: string;
  keyAdjustment?: number;
  language?: string;
}) {
  try {
    await dbConnect();
    
    if (!songIds || songIds.length === 0) {
      return NextResponse.json(
        { success: false, error: '편집할 곡을 선택해주세요.' },
        { status: 400 }
      );
    }
    
    if (!editData || Object.keys(editData).length === 0) {
      return NextResponse.json(
        { success: false, error: '변경할 정보를 입력해주세요.' },
        { status: 400 }
      );
    }
    
    let modifiedCount = 0;
    
    // 아티스트 필드가 있는 경우 각 곡별로 처리 (alias 로직 때문에)
    if (editData.artist) {
      // 선택된 곡들 조회
      const songs = await SongDetail.find({
        _id: { $in: songIds },
        status: { $ne: 'deleted' }
      });
      
      for (const song of songs) {
        const updateFields: any = {
          updatedAt: new Date()
        };
        
        // 아티스트 alias 로직
        if (editData.artist === song.artist) {
          // 입력된 아티스트가 원본과 같으면 alias 제거
          updateFields.artistAlias = null;
        } else {
          // 입력된 아티스트가 원본과 다르면 alias로 설정
          updateFields.artistAlias = editData.artist;
        }
        
        // 키 조절 필드 처리
        if (editData.keyAdjustment !== undefined) {
          if (editData.keyAdjustment === 999) {
            // 특수값 999는 null로 설정 (키 조절 해제)
            updateFields.keyAdjustment = null;
          } else {
            updateFields.keyAdjustment = editData.keyAdjustment;
          }
        }
        
        if (editData.language) {
          updateFields.language = editData.language;
        }
        
        // 개별 곡 업데이트
        const result = await SongDetail.updateOne(
          { _id: song._id },
          { $set: updateFields }
        );
        
        if (result.modifiedCount > 0) {
          modifiedCount++;
        }
      }
    } else {
      // 아티스트 필드가 없는 경우 기존 방식 사용
      const updateFields: any = {};
      
      if (editData.keyAdjustment !== undefined) {
        if (editData.keyAdjustment === 999) {
          // 특수값 999는 null로 설정 (키 조절 해제)
          updateFields.keyAdjustment = null;
        } else {
          updateFields.keyAdjustment = editData.keyAdjustment;
        }
      }
      
      if (editData.language) {
        updateFields.language = editData.language;
      }
      
      updateFields.updatedAt = new Date();
      
      const result = await SongDetail.updateMany(
        {
          _id: { $in: songIds },
          status: { $ne: 'deleted' }
        },
        {
          $set: updateFields
        }
      );
      
      modifiedCount = result.modifiedCount;
    }
    
    if (modifiedCount > 0) {
      console.log(`✏️ ${modifiedCount}곡 일괄 편집 완료`);
    }
    
    return NextResponse.json({
      success: true,
      message: `${modifiedCount}곡이 일괄 수정되었습니다.`,
      affectedCount: modifiedCount
    });
    
  } catch (error) {
    console.error('❌ 일괄 편집 오류:', error);
    return NextResponse.json(
      { success: false, error: '일괄 편집 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 개별 곡 편집 함수
async function handleEditSong(songId: string, editData: {
  title?: string;
  artist?: string;
  language?: string;
  keyAdjustment?: number | null;
  lyrics?: string;
  mrLinks?: any[];
  tags?: string[];
  selectedMRIndex?: number;
}) {
  try {
    await dbConnect();
    
    if (!songId) {
      return NextResponse.json(
        { success: false, error: '편집할 곡을 선택해주세요.' },
        { status: 400 }
      );
    }
    
    if (!editData || Object.keys(editData).length === 0) {
      return NextResponse.json(
        { success: false, error: '변경할 정보를 입력해주세요.' },
        { status: 400 }
      );
    }
    
    // 곡 조회
    const song = await SongDetail.findOne({
      _id: songId,
      status: { $ne: 'deleted' }
    });
    
    if (!song) {
      return NextResponse.json(
        { success: false, error: '곡을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }
    
    // 업데이트할 필드 구성
    const updateFields: any = {
      updatedAt: new Date()
    };
    
    // 제목 업데이트
    if (editData.title) {
      updateFields.title = editData.title;
    }
    
    // 아티스트 업데이트 (alias 로직 적용)
    if (editData.artist !== undefined) {
      if (editData.artist === song.artist) {
        // 입력된 아티스트가 원본과 같으면 alias 제거
        updateFields.artistAlias = null;
      } else {
        // 입력된 아티스트가 원본과 다르면 alias로 설정
        updateFields.artistAlias = editData.artist;
      }
    }
    
    // 언어 업데이트
    if (editData.language) {
      updateFields.language = editData.language;
    }
    
    // 키 조절 업데이트
    if (editData.keyAdjustment !== undefined) {
      updateFields.keyAdjustment = editData.keyAdjustment;
    }
    
    // 가사 업데이트
    if (editData.lyrics !== undefined) {
      updateFields.lyrics = editData.lyrics;
    }
    
    // MR 링크 업데이트
    if (editData.mrLinks !== undefined) {
      updateFields.mrLinks = editData.mrLinks;
    }
    
    // 선택된 MR 인덱스 업데이트
    if (editData.selectedMRIndex !== undefined) {
      updateFields.selectedMRIndex = editData.selectedMRIndex;
    }
    
    // 태그 업데이트
    if (editData.tags !== undefined) {
      updateFields.searchTags = editData.tags;
    }
    
    // 업데이트 실행
    const result = await SongDetail.updateOne(
      { _id: songId },
      { $set: updateFields }
    );
    
    if (result.modifiedCount > 0) {
      console.log(`✏️ 곡 편집 완료: ${song.title}`);
    }
    
    return NextResponse.json({
      success: true,
      message: `곡이 성공적으로 수정되었습니다.`,
      affectedCount: result.modifiedCount
    });
    
  } catch (error) {
    console.error('❌ 개별 곡 편집 오류:', error);
    return NextResponse.json(
      { success: false, error: '곡 편집 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 태그 추가 함수
async function handleAddTags(songIds: string[], tagData: {
  tags: string[];
}) {
  try {
    await dbConnect();
    
    if (!songIds || songIds.length === 0) {
      return NextResponse.json(
        { success: false, error: '태그를 추가할 곡을 선택해주세요.' },
        { status: 400 }
      );
    }
    
    if (!tagData?.tags || tagData.tags.length === 0) {
      return NextResponse.json(
        { success: false, error: '추가할 태그를 입력해주세요.' },
        { status: 400 }
      );
    }
    
    // 기존 태그에 새 태그 추가 ($addToSet으로 중복 방지)
    const result = await SongDetail.updateMany(
      {
        _id: { $in: songIds },
        status: { $ne: 'deleted' }
      },
      {
        $addToSet: {
          searchTags: { $each: tagData.tags }
        },
        $set: {
          updatedAt: new Date()
        }
      }
    );
    
    if (result.modifiedCount > 0) {
      console.log(`🏷️ ${result.modifiedCount}곡에 태그 추가 완료`);
    }
    
    return NextResponse.json({
      success: true,
      message: `${result.modifiedCount}곡에 태그가 추가되었습니다.`,
      affectedCount: result.modifiedCount
    });
    
  } catch (error) {
    console.error('❌ 태그 추가 오류:', error);
    return NextResponse.json(
      { success: false, error: '태그 추가 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 곡 삭제 함수 (소프트 삭제)
async function handleDeleteSongs(songIds: string[], deletedBy: string, reason?: string) {
  try {
    await dbConnect();
    
    if (!songIds || songIds.length === 0) {
      return NextResponse.json(
        { success: false, error: '삭제할 곡을 선택해주세요.' },
        { status: 400 }
      );
    }
    
    // 존재하는 곡들 확인
    const existingSongs = await SongDetail.find({
      _id: { $in: songIds },
      status: { $ne: 'deleted' }
    });
    
    if (existingSongs.length === 0) {
      return NextResponse.json(
        { success: false, error: '삭제할 수 있는 곡이 없습니다.' },
        { status: 400 }
      );
    }
    
    // 소프트 삭제 실행
    const result = await SongDetail.updateMany(
      {
        _id: { $in: songIds },
        status: { $ne: 'deleted' }
      },
      {
        $set: {
          status: 'deleted',
          deletedAt: new Date(),
          deletedBy: deletedBy,
          deleteReason: reason || '관리자에 의한 삭제'
        }
      }
    );
    
    if (result.modifiedCount > 0) {
      console.log(`🗑️ ${result.modifiedCount}곡 삭제`);
    }
    
    return NextResponse.json({
      success: true,
      message: `${result.modifiedCount}곡이 삭제되었습니다.`,
      affectedCount: result.modifiedCount
    });
    
  } catch (error) {
    console.error('❌ 곡 삭제 오료:', error);
    return NextResponse.json(
      { success: false, error: '곡 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}