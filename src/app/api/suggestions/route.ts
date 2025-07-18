import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import connectMongoDB from '@/lib/mongodb';
import SongRequest from '@/models/SongRequest';
import { SongRequestSortOption, SongRequestFilters } from '@/types';

// GET: 노래 추천 목록 조회
export async function GET(request: NextRequest) {
  try {
    await connectMongoDB();
    
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const sort = (searchParams.get('sort') || 'latest') as SongRequestSortOption;
    const search = searchParams.get('search') || '';
    const genre = searchParams.get('genre') || '';
    const status = searchParams.get('status') || '';
    const promotedToSongbook = searchParams.get('promoted');

    // 필터링 조건 구성
    const filters: any = {};
    
    if (search) {
      filters.$or = [
        { title: { $regex: search, $options: 'i' } },
        { artist: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { searchTags: { $in: [new RegExp(search, 'i')] } }
      ];
    }
    
    if (genre) {
      filters.genre = genre;
    }
    
    if (status) {
      filters.status = status;
    }
    
    if (promotedToSongbook !== null) {
      filters.promotedToSongbook = promotedToSongbook === 'true';
    }

    // 정렬 조건 설정
    let sortOption: any = {};
    switch (sort) {
      case 'latest':
        sortOption = { submittedAt: -1 };
        break;
      case 'recommended':
        sortOption = { recommendationCount: -1, submittedAt: -1 };
        break;
      case 'viewed':
        sortOption = { viewCount: -1, submittedAt: -1 };
        break;
      case 'trending':
        // 추천수와 조회수를 복합적으로 고려한 인기순
        sortOption = { 
          $expr: { 
            $add: [
              { $multiply: ['$recommendationCount', 3] }, // 추천수에 가중치 3
              { $multiply: ['$viewCount', 1] }             // 조회수에 가중치 1
            ]
          }
        };
        break;
      case 'pending':
        filters.status = 'pending_approval';
        sortOption = { submittedAt: -1 };
        break;
      default:
        sortOption = { submittedAt: -1 };
    }

    const skip = (page - 1) * limit;

    const [requests, total] = await Promise.all([
      SongRequest.find(filters)
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .lean(),
      SongRequest.countDocuments(filters)
    ]);

    // 현재 유저의 추천 여부 확인
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    const requestsWithUserData = requests.map(request => ({
      ...request,
      id: request._id.toString(),
      isRecommendedByUser: userId ? request.recommendedBy.includes(userId) : false,
      submittedAt: request.submittedAt.toISOString(),
      createdAt: request.createdAt?.toISOString(),
      updatedAt: request.updatedAt?.toISOString(),
      promotedAt: request.promotedAt?.toISOString(),
      editHistory: request.editHistory.map(entry => ({
        ...entry,
        editedAt: entry.editedAt.toISOString()
      }))
    }));

    return NextResponse.json({
      requests: requestsWithUserData,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error('노래 추천 목록 조회 오류:', error);
    return NextResponse.json(
      { error: '노래 추천 목록을 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

// POST: 새로운 노래 추천 추가
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    await connectMongoDB();

    const data = await request.json();
    const { 
      title, 
      artist, 
      description, 
      lyrics, 
      searchTags,
      genre, 
      language,
      difficulty,
      duration,
      releaseYear,
      keyAdjustment,
      mrLinks,
      selectedMRIndex,
      originalTrackUrl,
      lyricsUrl
    } = data;

    // 필수 필드 검증
    if (!title || !artist) {
      return NextResponse.json(
        { error: '제목과 아티스트는 필수 입력 항목입니다.' },
        { status: 400 }
      );
    }

    // 중복 확인
    const existingSongRequest = await SongRequest.findOne({ title, artist });
    if (existingSongRequest) {
      return NextResponse.json(
        { error: '이미 등록된 곡입니다.' },
        { status: 400 }
      );
    }

    // 새 노래 추천 생성
    const newSongRequest = new SongRequest({
      title,
      artist,
      originalSubmitter: session.user.id,
      originalSubmitterName: session.user.name || session.user.channelName || '익명',
      description,
      lyrics,
      searchTags: searchTags || [],
      genre,
      language,
      difficulty,
      duration,
      releaseYear,
      keyAdjustment,
      mrLinks: mrLinks || [],
      selectedMRIndex: selectedMRIndex || 0,
      originalTrackUrl,
      lyricsUrl,
      editHistory: [{
        userId: session.user.id,
        userName: session.user.name || session.user.channelName || '익명',
        editedAt: new Date(),
        changes: '곡 최초 등록',
        fieldsChanged: ['title', 'artist']
      }]
    });

    const savedRequest = await newSongRequest.save();

    return NextResponse.json({
      message: '노래 추천이 성공적으로 등록되었습니다.',
      request: {
        ...savedRequest.toObject(),
        id: savedRequest._id.toString(),
        submittedAt: savedRequest.submittedAt.toISOString(),
        createdAt: savedRequest.createdAt?.toISOString(),
        updatedAt: savedRequest.updatedAt?.toISOString()
      }
    }, { status: 201 });

  } catch (error) {
    console.error('노래 추천 등록 오류:', error);
    return NextResponse.json(
      { error: '노래 추천 등록에 실패했습니다.' },
      { status: 500 }
    );
  }
}