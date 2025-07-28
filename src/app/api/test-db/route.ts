import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import mongoose from 'mongoose';

// 백업용 컬렉션명 (이 컬렉션들은 백업/복원 대상에서 제외)
const BACKUP_COLLECTIONS = ['backups', 'backup_logs'];

interface BackupDocument {
  name: string;
  timestamp: Date;
  collections: Record<string, unknown[]>;
  metadata: {
    totalDocuments: number;
    totalCollections: number;
    totalChunks?: number;
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
      // 백업 목록 조회 (청크 파일 제외)
      const backupsCollection = db?.collection('backups');
      const backups = await backupsCollection?.find({ 
        isChunk: { $ne: true }  // 청크가 아닌 메인 백업만 조회
      })
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

      const backupData: Record<string, unknown[]> = {};
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
      
      const backupsCollection = db?.collection('backups');
      
      // 백업을 더 작은 청크로 분할하여 저장
      const MAX_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB 제한 (더 안전하게)
      const chunks: any[] = [];
      let chunkIndex = 0;

      for (const [collectionName, documents] of Object.entries(backupData)) {
        const documentsArray = documents as any[];
        
        // 컬렉션이 비어있으면 건너뛰기
        if (documentsArray.length === 0) {
          chunks.push({
            name: `${name}_chunk_${chunkIndex}`,
            timestamp,
            chunkIndex,
            isChunk: true,
            collections: { [collectionName]: [] }
          });
          chunkIndex++;
          continue;
        }

        // 큰 컬렉션은 문서 단위로 분할
        const collectionSize = JSON.stringify(documentsArray).length;
        
        if (collectionSize > MAX_CHUNK_SIZE) {
          console.log(`큰 컬렉션 분할: ${collectionName} (${Math.round(collectionSize / 1024 / 1024)}MB)`);
          
          // 문서를 작은 배치로 나누기
          const batchSize = Math.max(1, Math.floor(documentsArray.length * MAX_CHUNK_SIZE / collectionSize));
          
          for (let i = 0; i < documentsArray.length; i += batchSize) {
            const batch = documentsArray.slice(i, i + batchSize);
            chunks.push({
              name: `${name}_chunk_${chunkIndex}`,
              timestamp,
              chunkIndex,
              isChunk: true,
              collections: { [collectionName]: batch },
              partialCollection: true, // 부분 컬렉션 표시
              partInfo: { 
                collectionName, 
                partIndex: Math.floor(i / batchSize),
                totalParts: Math.ceil(documentsArray.length / batchSize)
              }
            });
            chunkIndex++;
          }
        } else {
          // 작은 컬렉션은 그대로 저장
          chunks.push({
            name: `${name}_chunk_${chunkIndex}`,
            timestamp,
            chunkIndex,
            isChunk: true,
            collections: { [collectionName]: documentsArray }
          });
          chunkIndex++;
        }
      }

      // 각 청크를 개별 문서로 저장
      for (const chunk of chunks) {
        await backupsCollection?.insertOne(chunk);
      }

      // 메인 백업 문서 (메타데이터만)
      const backupDocument: BackupDocument = {
        name,
        timestamp,
        collections: {}, // 빈 객체로 설정
        metadata: {
          totalDocuments,
          totalCollections: dataCollections.length,
          totalChunks: chunks.length,
          version: '2.0' // 새 버전으로 표시
        }
      };

      // 메인 백업 문서 저장
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
      let allBackupData: { [key: string]: any[] } = {};

      // 버전 2.0 백업 (청크 방식)인지 확인
      if (backup.metadata?.version === '2.0' && backup.metadata?.totalChunks > 0) {
        console.log(`청크 방식 백업 복원 시작: ${backup.metadata.totalChunks}개 청크`);
        
        // 모든 청크 데이터 수집
        const allChunks = await backupsCollection?.find({ 
          name: { $regex: `^${restoreBackupName}_chunk_` }, 
          isChunk: true 
        }).toArray();

        console.log(`총 ${allChunks?.length || 0}개 청크 발견`);

        if (allChunks) {
          for (const chunk of allChunks) {
            if (chunk.collections) {
              // 청크의 컬렉션 데이터를 통합
              for (const [collectionName, documents] of Object.entries(chunk.collections)) {
                if (!allBackupData[collectionName]) {
                  allBackupData[collectionName] = [];
                }
                allBackupData[collectionName].push(...(documents as any[]));
              }
            }
          }
        }
      } else {
        // 기존 방식 백업 (v1.0)
        allBackupData = backup.collections;
      }

      // 각 컬렉션 복원
      for (const [collectionName, documents] of Object.entries(allBackupData)) {
        const typedDocuments = documents as mongoose.mongo.OptionalId<mongoose.mongo.Document>[];
        try {
          const collection = db?.collection(collectionName);
          
          // 기존 데이터 삭제
          await collection?.deleteMany({});
          
          // 백업 데이터 삽입
          if (typedDocuments.length > 0) {
            await collection?.insertMany(typedDocuments);
          }

          restoreResults.push({
            collection: collectionName,
            success: true,
            restoredCount: typedDocuments.length
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