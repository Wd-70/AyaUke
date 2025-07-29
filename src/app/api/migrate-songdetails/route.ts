import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { isSuperAdmin, UserRole } from '@/lib/permissions'
import dbConnect from '@/lib/mongodb'
import mongoose from 'mongoose'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    // 최고관리자만 마이그레이션 실행 가능
    if (!session || !isSuperAdmin(session.user.role as UserRole)) {
      return NextResponse.json({ error: '최고관리자 권한이 필요합니다.' }, { status: 403 })
    }

    await dbConnect()
    const db = mongoose.connection.db

    // 1. 기존 컬렉션 확인
    const collections = await db.listCollections().toArray()
    const hasOldCollection = collections.some(c => c.name === 'songdetails')
    const hasNewCollection = collections.some(c => c.name === 'songdetails')

    console.log('컬렉션 상태:', { hasOldCollection, hasNewCollection })

    if (!hasOldCollection) {
      return NextResponse.json({ 
        message: 'Old collection (songdetails) not found',
        status: 'no_migration_needed'
      })
    }

    // 2. 기존 데이터 복사 (새 컬렉션이 없거나 비어있는 경우만)
    if (!hasNewCollection) {
      console.log('새 컬렉션 생성 및 데이터 복사 시작...')
      
      const oldCollection = db.collection('songdetails')
      const newCollection = db.collection('songdetails')
      
      // 데이터 복사
      const documents = await oldCollection.find({}).toArray()
      if (documents.length > 0) {
        await newCollection.insertMany(documents)
        console.log(`${documents.length}개 문서 복사 완료`)
      }

      // 인덱스 복사
      const indexes = await oldCollection.indexes()
      for (const index of indexes) {
        if (index.name !== '_id_') {
          const { name, ...indexSpec } = index
          try {
            await newCollection.createIndex(indexSpec.key, {
              ...indexSpec,
              name: index.name
            })
          } catch (error) {
            console.log(`인덱스 생성 실패: ${index.name}`, error)
          }
        }
      }

      return NextResponse.json({
        message: `Migration completed: ${documents.length} documents copied`,
        status: 'migration_completed',
        documentsCount: documents.length
      })
    } else {
      // 기존 새 컬렉션이 있는 경우 문서 수만 확인
      const oldCount = await db.collection('songdetails').countDocuments()
      const newCount = await db.collection('songdetails').countDocuments()
      
      return NextResponse.json({
        message: 'Both collections exist',
        status: 'both_exist',
        oldCollectionCount: oldCount,
        newCollectionCount: newCount
      })
    }

  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json({ 
      error: 'Migration failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}

// 마이그레이션 상태 확인
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !isSuperAdmin(session.user.role as UserRole)) {
      return NextResponse.json({ error: '최고관리자 권한이 필요합니다.' }, { status: 403 })
    }

    await dbConnect()
    const db = mongoose.connection.db

    const collections = await db.listCollections().toArray()
    const hasOldCollection = collections.some(c => c.name === 'songdetails')
    const hasNewCollection = collections.some(c => c.name === 'songdetails')

    let oldCount = 0
    let newCount = 0

    if (hasOldCollection) {
      oldCount = await db.collection('songdetails').countDocuments()
    }
    if (hasNewCollection) {
      newCount = await db.collection('songdetails').countDocuments()
    }

    return NextResponse.json({
      hasOldCollection,
      hasNewCollection,
      oldCollectionCount: oldCount,
      newCollectionCount: newCount,
      migrationNeeded: hasOldCollection && !hasNewCollection
    })

  } catch (error) {
    console.error('Status check error:', error)
    return NextResponse.json({ error: 'Status check failed' }, { status: 500 })
  }
}