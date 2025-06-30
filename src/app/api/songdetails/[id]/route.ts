import { NextRequest, NextResponse } from 'next/server';
import SongDetailModel from '@/models/SongDetail';
import connectDB from '@/lib/mongodb';
import mongoose from 'mongoose';

interface Params {
  params: {
    id: string;
  };
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    await connectDB();
    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 ID입니다.' },
        { status: 400 }
      );
    }

    const song = await SongDetailModel.findById(id).lean();

    if (!song) {
      return NextResponse.json(
        { success: false, error: '곡을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      song
    });

  } catch (error) {
    console.error('곡 조회 오류:', error);
    return NextResponse.json(
      { success: false, error: '곡 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    await connectDB();
    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 ID입니다.' },
        { status: 400 }
      );
    }

    const data = await request.json();
    
    const updatedSong = await SongDetailModel.findByIdAndUpdate(
      id,
      data,
      { 
        new: true, 
        runValidators: true,
        lean: true
      }
    );

    if (!updatedSong) {
      return NextResponse.json(
        { success: false, error: '곡을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      song: updatedSong,
      message: '곡이 성공적으로 수정되었습니다.'
    });

  } catch (error: unknown) {
    console.error('곡 수정 오류:', error);
    
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
        error: '곡 수정 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    await connectDB();
    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 ID입니다.' },
        { status: 400 }
      );
    }

    const deletedSong = await SongDetailModel.findByIdAndDelete(id);

    if (!deletedSong) {
      return NextResponse.json(
        { success: false, error: '곡을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '곡이 성공적으로 삭제되었습니다.',
      deletedId: id
    });

  } catch (error) {
    console.error('곡 삭제 오류:', error);
    return NextResponse.json(
      { success: false, error: '곡 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}