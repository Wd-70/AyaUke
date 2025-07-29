import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { hasPermission, Permission, UserRole } from '@/lib/permissions';
import SongDetailModel from '@/models/SongDetail';
import connectDB from '@/lib/mongodb';
import mongoose from 'mongoose';

export async function GET(request: NextRequest) {
  try {
    // 노래 조회 권한 체크
    const session = await getServerSession(authOptions);
    if (!session || !hasPermission(session.user.role as UserRole, Permission.SONGS_VIEW)) {
      return NextResponse.json(
        { success: false, error: '노래 조회 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    await connectDB();

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '100');
    const search = searchParams.get('search') || '';

    // 검색 조건 설정
    const query: Record<string, unknown> = {};
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { artist: { $regex: search, $options: 'i' } },
        { titleAlias: { $regex: search, $options: 'i' } },
        { artistAlias: { $regex: search, $options: 'i' } }
      ];
    }

    // 페이지네이션 계산
    const skip = (page - 1) * limit;

    // 데이터 조회
    const [songs, totalCount] = await Promise.all([
      SongDetailModel.find(query)
        .sort({ updatedAt: -1 }) // 최근 수정된 순으로 정렬
        .skip(skip)
        .limit(limit)
        .lean(),
      SongDetailModel.countDocuments(query)
    ]);

    return NextResponse.json({
      success: true,
      songs: songs,
      totalCount,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      hasMore: totalCount > page * limit
    });

  } catch (error) {
    console.error('MongoDB 조회 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Database 조회 중 오류가 발생했습니다.',
        songs: []
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // 노래 생성 권한 체크
    const session = await getServerSession(authOptions);
    if (!session || !hasPermission(session.user.role as UserRole, Permission.SONGS_CREATE)) {
      return NextResponse.json(
        { success: false, error: '노래 생성 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    await connectDB();
    const data = await request.json();

    // 새로운 곡 생성
    const newSong = new SongDetailModel(data);
    const savedSong = await newSong.save();

    return NextResponse.json({
      success: true,
      song: savedSong,
      message: '곡이 성공적으로 추가되었습니다.'
    });

  } catch (error: unknown) {
    console.error('곡 추가 오류:', error);
    
    // 중복 제목 에러 처리
    if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
      return NextResponse.json(
        {
          success: false,
          error: '이미 존재하는 곡 제목입니다.',
          field: 'title'
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: '곡 추가 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}