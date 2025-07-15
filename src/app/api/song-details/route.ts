import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import SongDetail from '@/models/SongDetail';

export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(request.url);
    const title = searchParams.get('title');
    const playlist = searchParams.get('playlist');
    const favorites = searchParams.get('favorites');
    
    if (title) {
      const songDetail = await SongDetail.findOne({ title });
      if (!songDetail) {
        return NextResponse.json({ error: 'Song detail not found' }, { status: 404 });
      }
      return NextResponse.json(songDetail);
    }
    
    let query = {};
    
    if (playlist) {
      query = { playlists: playlist };
    } else if (favorites === 'true') {
      query = { isFavorite: true };
    }
    
    const songDetails = await SongDetail.find(query).sort({ updatedAt: -1 });
    return NextResponse.json(songDetails);
    
  } catch (error) {
    console.error('Error fetching song details:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    const data = await request.json();
    const { title, ...songDetailData } = data;
    
    if (!title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }
    
    const existingSongDetail = await SongDetail.findOne({ title });
    if (existingSongDetail) {
      return NextResponse.json({ error: 'Song detail already exists' }, { status: 409 });
    }
    
    const songDetail = new SongDetail({
      title,
      ...songDetailData
    });
    
    await songDetail.save();
    return NextResponse.json(songDetail, { status: 201 });
    
  } catch (error) {
    console.error('Error creating song detail:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await dbConnect();
    
    const data = await request.json();
    const { title, ...updateData } = data;
    
    if (!title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }
    
    const songDetail = await SongDetail.findOneAndUpdate(
      { title },
      updateData,
      { new: true, upsert: true }
    );
    
    return NextResponse.json(songDetail);
    
  } catch (error) {
    console.error('Error updating song detail:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(request.url);
    const title = searchParams.get('title');
    
    if (!title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }
    
    const deletedSongDetail = await SongDetail.findOneAndDelete({ title });
    
    if (!deletedSongDetail) {
      return NextResponse.json({ error: 'Song detail not found' }, { status: 404 });
    }
    
    return NextResponse.json({ message: 'Song detail deleted successfully' });
    
  } catch (error) {
    console.error('Error deleting song detail:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}