import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import mongoose from 'mongoose';

// 백업용 컬렉션명 (이 컬렉션들은 백업/복원 대상에서 제외)
const BACKUP_COLLECTIONS = ['backups', 'backup_logs'];

interface BackupDocument {
  name: string;
  timestamp: Date;
  collections: Record<string, any[]>;
  metadata: {
    totalDocuments: number;
    totalCollections: number;
    version: string;
  };
}

export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    const db = mongoose.connection.db;
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');

    if (action === 'list-backups') {
      // 백업 목록 조회
      const backupsCollection = db?.collection('backups');
      const backups = await backupsCollection?.find({})
        .sort({ timestamp: -1 })
        .limit(20)
        .toArray();

      return NextResponse.json({
        success: true,
        backups: backups || [],
        count: backups?.length || 0
      });
    }

    if (action === 'list-collections') {
      // 현재 컬렉션 목록 조회 (백업용 컬렉션 제외)
      const collections = await db?.listCollections().toArray();
      const dataCollections = collections?.filter(col => 
        !BACKUP_COLLECTIONS.includes(col.name)
      ) || [];

      const collectionStats = [];
      for (const col of dataCollections) {
        const collection = db?.collection(col.name);
        const count = await collection?.countDocuments() || 0;
        collectionStats.push({
          name: col.name,
          count: count,
          type: col.type || 'collection'
        });
      }

      return NextResponse.json({
        success: true,
        collections: collectionStats,
        totalCollections: collectionStats.length,
        totalDocuments: collectionStats.reduce((sum, col) => sum + col.count, 0)
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid action parameter. Use: list-backups, list-collections'
    }, { status: 400 });

  } catch (error) {
    console.error('GET /test-db error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    const db = mongoose.connection.db;
    const body = await request.json();
    const { action, backupName } = body;

    if (action === 'backup') {
      // 전체 데이터베이스 백업 (백업용 컬렉션 제외)
      const collections = await db?.listCollections().toArray();
      const dataCollections = collections?.filter(col => 
        !BACKUP_COLLECTIONS.includes(col.name)
      ) || [];

      const backupData: Record<string, any[]> = {};
      let totalDocuments = 0;

      // 각 컬렉션의 모든 데이터 백업
      for (const col of dataCollections) {
        const collection = db?.collection(col.name);
        const documents = await collection?.find({}).toArray() || [];
        backupData[col.name] = documents;
        totalDocuments += documents.length;
      }

      // 백업 메타데이터 생성
      const timestamp = new Date();
      const name = backupName || `backup_${timestamp.toISOString().slice(0, 19).replace(/[:.]/g, '-')}`;
      
      const backupDocument: BackupDocument = {
        name,
        timestamp,
        collections: backupData,
        metadata: {
          totalDocuments,
          totalCollections: dataCollections.length,
          version: '1.0'
        }
      };

      // 백업 저장
      const backupsCollection = db?.collection('backups');
      await backupsCollection?.insertOne(backupDocument);

      // 백업 로그 저장
      const logsCollection = db?.collection('backup_logs');
      await logsCollection?.insertOne({
        action: 'backup_created',
        backupName: name,
        timestamp,
        metadata: backupDocument.metadata
      });

      return NextResponse.json({
        success: true,
        message: '백업이 성공적으로 생성되었습니다.',
        backup: {
          name,
          timestamp,
          metadata: backupDocument.metadata
        }
      });
    }

    if (action === 'restore') {
      const { backupName: restoreBackupName } = body;
      
      if (!restoreBackupName) {
        return NextResponse.json({
          success: false,
          error: 'backupName is required for restore action'
        }, { status: 400 });
      }

      // 백업 데이터 조회
      const backupsCollection = db?.collection('backups');
      const backup = await backupsCollection?.findOne({ name: restoreBackupName });

      if (!backup) {
        return NextResponse.json({
          success: false,
          error: `Backup '${restoreBackupName}' not found`
        }, { status: 404 });
      }

      const restoreResults = [];

      // 각 컬렉션 복원
      for (const [collectionName, documents] of Object.entries(backup.collections)) {
        try {
          const collection = db?.collection(collectionName);
          
          // 기존 데이터 삭제
          await collection?.deleteMany({});
          
          // 백업 데이터 삽입
          if (documents.length > 0) {
            await collection?.insertMany(documents);
          }

          restoreResults.push({
            collection: collectionName,
            success: true,
            restoredCount: documents.length
          });

        } catch (error) {
          restoreResults.push({
            collection: collectionName,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // 복원 로그 저장
      const logsCollection = db?.collection('backup_logs');
      await logsCollection?.insertOne({
        action: 'backup_restored',
        backupName: restoreBackupName,
        timestamp: new Date(),
        results: restoreResults
      });

      const successCount = restoreResults.filter(r => r.success).length;
      const totalCount = restoreResults.length;

      return NextResponse.json({
        success: true,
        message: `백업 복원 완료 (${successCount}/${totalCount} 컬렉션 성공)`,
        results: restoreResults,
        backup: {
          name: backup.name,
          originalTimestamp: backup.timestamp,
          metadata: backup.metadata
        }
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid action. Use: backup, restore'
    }, { status: 400 });

  } catch (error) {
    console.error('POST /test-db error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await dbConnect();
    const db = mongoose.connection.db;
    const body = await request.json();
    const { action, backupName } = body;

    if (action === 'delete-backup') {
      if (!backupName) {
        return NextResponse.json({
          success: false,
          error: 'backupName is required'
        }, { status: 400 });
      }

      const backupsCollection = db?.collection('backups');
      const result = await backupsCollection?.deleteOne({ name: backupName });

      if (result?.deletedCount === 0) {
        return NextResponse.json({
          success: false,
          error: `Backup '${backupName}' not found`
        }, { status: 404 });
      }

      // 삭제 로그 저장
      const logsCollection = db?.collection('backup_logs');
      await logsCollection?.insertOne({
        action: 'backup_deleted',
        backupName,
        timestamp: new Date()
      });

      return NextResponse.json({
        success: true,
        message: `백업 '${backupName}'이 삭제되었습니다.`
      });
    }

    if (action === 'clear-all-backups') {
      const backupsCollection = db?.collection('backups');
      const result = await backupsCollection?.deleteMany({});

      // 삭제 로그 저장
      const logsCollection = db?.collection('backup_logs');
      await logsCollection?.insertOne({
        action: 'all_backups_cleared',
        deletedCount: result?.deletedCount || 0,
        timestamp: new Date()
      });

      return NextResponse.json({
        success: true,
        message: `모든 백업이 삭제되었습니다. (${result?.deletedCount || 0}개)`
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid action. Use: delete-backup, clear-all-backups'
    }, { status: 400 });

  } catch (error) {
    console.error('DELETE /test-db error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}