import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import connectMongoDB from '@/lib/mongodb';
import SongRequest from '@/models/SongRequest';
import SongDetail from '@/models/SongDetail';
import { canManageSongs } from '@/lib/permissions';

// POST: 노래 추천을 노래책으로 승격
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    // 관리자 권한 확인
    if (!canManageSongs(session.user.role)) {
      return NextResponse.json(
        { error: '노래 관리 권한이 없습니다.' },
        { status: 403 }
      );
    }

    await connectMongoDB();

    const songRequest = await SongRequest.findById(params.id);
    if (!songRequest) {
      return NextResponse.json(
        { error: '노래 추천을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 이미 승격된 곡인지 확인
    if (songRequest.promotedToSongbook) {
      return NextResponse.json(
        { error: '이미 노래책에 편입된 곡입니다.' },
        { status: 400 }
      );
    }

    // 노래책에 동일한 곡이 있는지 확인
    const existingSong = await SongDetail.findOne({
      title: songRequest.title,
      artist: songRequest.artist
    });

    if (existingSong) {
      return NextResponse.json(
        { error: '노래책에 이미 동일한 곡이 존재합니다.' },
        { status: 400 }
      );
    }

    // 노래책에 추가할 데이터 구성
    const songDetailData = {
      title: songRequest.title,
      artist: songRequest.artist,
      titleAlias: songRequest.title, // 기본값으로 원제목 사용
      artistAlias: songRequest.artist, // 기본값으로 원아티스트 사용
      language: songRequest.language,
      lyrics: songRequest.lyrics,
      searchTags: songRequest.searchTags || [],
      keyAdjustment: songRequest.keyAdjustment,
      mrLinks: songRequest.mrLinks || [],
      selectedMRIndex: songRequest.selectedMRIndex || 0,
      personalNotes: songRequest.description, // 추천 설명을 개인 메모로 사용
      // 추가 필드들
      genre: songRequest.genre,
      difficulty: songRequest.difficulty,
      duration: songRequest.duration,
      releaseYear: songRequest.releaseYear,
      originalTrackUrl: songRequest.originalTrackUrl,
      lyricsUrl: songRequest.lyricsUrl
    };

    // 노래책에 추가
    const newSongDetail = new SongDetail(songDetailData);
    const savedSongDetail = await newSongDetail.save();

    // 추천 곡 상태 업데이트
    songRequest.promotedToSongbook = true;
    songRequest.promotedAt = new Date();
    songRequest.promotedBy = session.user.id;
    songRequest.songbookId = savedSongDetail._id.toString();
    songRequest.status = 'approved';

    // 편집 이력 추가
    songRequest.editHistory.push({
      userId: session.user.id,
      userName: session.user.name || session.user.channelName || '관리자',
      editedAt: new Date(),
      changes: '노래책으로 승격',
      fieldsChanged: ['status', 'promotedToSongbook']
    });

    await songRequest.save();

    return NextResponse.json({
      message: '노래가 성공적으로 노래책에 편입되었습니다.',
      songbookId: savedSongDetail._id.toString(),
      songRequest: {
        ...songRequest.toObject(),
        id: songRequest._id.toString(),
        promotedAt: songRequest.promotedAt?.toISOString(),
        editHistory: songRequest.editHistory.map(entry => ({
          ...entry,
          editedAt: entry.editedAt.toISOString()
        }))
      }
    });

  } catch (error) {
    console.error('노래책 승격 오류:', error);
    return NextResponse.json(
      { error: '노래책 승격에 실패했습니다.' },
      { status: 500 }
    );
  }
}