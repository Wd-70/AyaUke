import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { isSuperAdmin, UserRole } from '@/lib/permissions';
import dbConnect from '@/lib/mongodb';
import mongoose from 'mongoose';

// 백업용 컬렉션명 (이 컬렉션들은 백업/복원 대상에서 제외)
const BACKUP_COLLECTIONS = ['backups', 'backup_logs'];

interface BackupDocument {
  _id?: string;
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
    // 최고관리자 권한 체크
    const session = await getServerSession(authOptions);
    if (!session || !isSuperAdmin(session.user.role as UserRole)) {
      return NextResponse.json({
        success: false,
        error: '최고관리자 권한이 필요합니다.'
      }, { status: 403 });
    }

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
    // 최고관리자 권한 체크
    const session = await getServerSession(authOptions);
    if (!session || !isSuperAdmin(session.user.role as UserRole)) {
      return NextResponse.json({
        success: false,
        error: '최고관리자 권한이 필요합니다.'
      }, { status: 403 });
    }

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
      const dateStr = timestamp.toISOString().slice(0, 19).replace(/[:.]/g, '-').replace('T', '_');
      const name = backupName ? `${dateStr}_${backupName}` : `${dateStr}_backup`;
      
      const backupsCollection = db?.collection('backups');
      
      // 메인 백업 문서 먼저 생성 (메타데이터만)
      const backupDocument: BackupDocument = {
        name,
        timestamp,
        collections: {}, // 빈 객체로 설정
        metadata: {
          totalDocuments,
          totalCollections: dataCollections.length,
          totalChunks: 0, // 나중에 업데이트
          version: '2.0' // 새 버전으로 표시
        }
      };

      // 메인 백업 문서 저장하고 _id 얻기
      const backupResult = await backupsCollection?.insertOne(backupDocument);
      const backupId = backupResult?.insertedId?.toString();

      if (!backupId) {
        throw new Error('백업 문서 생성에 실패했습니다.');
      }

      // 백업을 더 작은 청크로 분할하여 저장
      const MAX_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB 제한 (더 안전하게)
      const chunks: any[] = [];
      let chunkIndex = 0;

      for (const [collectionName, documents] of Object.entries(backupData)) {
        const documentsArray = documents as any[];
        
        // 컬렉션이 비어있으면 건너뛰기
        if (documentsArray.length === 0) {
          chunks.push({
            backupId,
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
              backupId,
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
            backupId,
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

      // 메인 백업 문서의 청크 수 업데이트
      await backupsCollection?.updateOne(
        { _id: backupResult.insertedId },
        { $set: { 'metadata.totalChunks': chunks.length } }
      );

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
          _id: backupId,
          name,
          timestamp,
          metadata: { ...backupDocument.metadata, totalChunks: chunks.length }
        }
      });
    }

    if (action === 'upload') {
      const { backupData } = body;
      
      if (!backupData) {
        return NextResponse.json({
          success: false,
          error: 'backupData is required for upload action'
        }, { status: 400 });
      }

      try {
        // 업로드된 백업 데이터 파싱
        const uploadedBackup = typeof backupData === 'string' ? JSON.parse(backupData) : backupData;
        
        if (!uploadedBackup.backup) {
          return NextResponse.json({
            success: false,
            error: '유효하지 않은 백업 파일입니다.'
          }, { status: 400 });
        }

        const backup = uploadedBackup.backup;
        const backupsCollection = db?.collection('backups');

        // 새로운 백업 이름 생성 (중복 방지, 날짜/시간 접두사 추가)
        const timestamp = new Date();
        const dateStr = timestamp.toISOString().slice(0, 19).replace(/[:.]/g, '-').replace('T', '_');
        let uploadName = `${dateStr}_${backup.name}_업로드`;
        let counter = 1;
        while (await backupsCollection?.findOne({ name: uploadName })) {
          uploadName = `${dateStr}_${backup.name}_업로드_${counter}`;
          counter++;
        }

        // 백업 데이터 저장 (청크 방식으로 분할)
        const collections = backup.collections || {};
        let totalDocuments = 0;
        
        // 총 문서 수 계산
        for (const documents of Object.values(collections)) {
          totalDocuments += (documents as any[]).length;
        }

        // 메인 백업 문서 먼저 생성
        const uploadedBackupDocument: BackupDocument = {
          name: uploadName,
          timestamp: new Date(backup.timestamp || timestamp),
          collections: {},
          metadata: {
            totalDocuments,
            totalCollections: Object.keys(collections).length,
            totalChunks: 0, // 나중에 업데이트
            version: backup.metadata?.version || '2.0',
            ...backup.metadata
          }
        };

        const uploadResult = await backupsCollection?.insertOne(uploadedBackupDocument);
        const uploadBackupId = uploadResult?.insertedId?.toString();

        if (!uploadBackupId) {
          throw new Error('업로드 백업 문서 생성에 실패했습니다.');
        }

        const MAX_CHUNK_SIZE = 5 * 1024 * 1024;
        const chunks: any[] = [];
        let chunkIndex = 0;

        // 각 컬렉션을 청크로 분할
        for (const [collectionName, documents] of Object.entries(collections)) {
          const documentsArray = documents as any[];

          if (documentsArray.length === 0) {
            chunks.push({
              backupId: uploadBackupId,
              name: `${uploadName}_chunk_${chunkIndex}`,
              timestamp: new Date(backup.timestamp || timestamp),
              chunkIndex,
              isChunk: true,
              collections: { [collectionName]: [] }
            });
            chunkIndex++;
            continue;
          }

          const collectionSize = JSON.stringify(documentsArray).length;
          
          if (collectionSize > MAX_CHUNK_SIZE) {
            const batchSize = Math.max(1, Math.floor(documentsArray.length * MAX_CHUNK_SIZE / collectionSize));
            
            for (let i = 0; i < documentsArray.length; i += batchSize) {
              const batch = documentsArray.slice(i, i + batchSize);
              chunks.push({
                backupId: uploadBackupId,
                name: `${uploadName}_chunk_${chunkIndex}`,
                timestamp: new Date(backup.timestamp || timestamp),
                chunkIndex,
                isChunk: true,
                collections: { [collectionName]: batch },
                partialCollection: true,
                partInfo: { 
                  collectionName, 
                  partIndex: Math.floor(i / batchSize),
                  totalParts: Math.ceil(documentsArray.length / batchSize)
                }
              });
              chunkIndex++;
            }
          } else {
            chunks.push({
              backupId: uploadBackupId,
              name: `${uploadName}_chunk_${chunkIndex}`,
              timestamp: new Date(backup.timestamp || timestamp),
              chunkIndex,
              isChunk: true,
              collections: { [collectionName]: documentsArray }
            });
            chunkIndex++;
          }
        }

        // 청크들 저장
        for (const chunk of chunks) {
          await backupsCollection?.insertOne(chunk);
        }

        // 메인 백업 문서의 청크 수 업데이트
        await backupsCollection?.updateOne(
          { _id: uploadResult.insertedId },
          { $set: { 'metadata.totalChunks': chunks.length } }
        );

        // 업로드 로그 저장
        const logsCollection = db?.collection('backup_logs');
        await logsCollection?.insertOne({
          action: 'backup_uploaded',
          backupName: uploadName,
          uploadedBackupId: uploadBackupId,
          originalBackupId: backup._id,
          timestamp: new Date(),
          metadata: { ...uploadedBackupDocument.metadata, totalChunks: chunks.length }
        });

        return NextResponse.json({
          success: true,
          message: '백업이 성공적으로 업로드되었습니다.',
          backup: {
            _id: uploadBackupId,
            name: uploadName,
            timestamp: uploadedBackupDocument.timestamp,
            metadata: { ...uploadedBackupDocument.metadata, totalChunks: chunks.length }
          }
        });

      } catch (error) {
        console.error('백업 업로드 파싱 오류:', error);
        return NextResponse.json({
          success: false,
          error: '백업 파일 형식이 올바르지 않습니다.'
        }, { status: 400 });
      }
    }

    if (action === 'restore') {
      const { backupName: restoreBackupName, downloadOnly } = body;
      
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
        
        // 모든 청크 데이터 수집 (backupId로 검색)
        const allChunks = await backupsCollection?.find({ 
          backupId: backup._id?.toString(),
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

      // downloadOnly가 true이면 데이터만 반환하고 복원하지 않음
      if (downloadOnly) {
        return NextResponse.json({
          success: true,
          backup: {
            _id: backup._id,
            name: backup.name,
            timestamp: backup.timestamp,
            metadata: backup.metadata,
            collections: allBackupData
          }
        });
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
          _id: backup._id,
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
    // 최고관리자 권한 체크
    const session = await getServerSession(authOptions);
    if (!session || !isSuperAdmin(session.user.role as UserRole)) {
      return NextResponse.json({
        success: false,
        error: '최고관리자 권한이 필요합니다.'
      }, { status: 403 });
    }

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
      
      // 메인 백업 문서 찾기
      const backupToDelete = await backupsCollection?.findOne({ name: backupName });
      
      if (!backupToDelete) {
        return NextResponse.json({
          success: false,
          error: `Backup '${backupName}' not found`
        }, { status: 404 });
      }

      // 관련 청크들도 삭제 (backupId로 검색)
      const chunkResult = await backupsCollection?.deleteMany({
        backupId: backupToDelete._id?.toString(),
        isChunk: true
      });

      // 메인 백업 문서 삭제
      const result = await backupsCollection?.deleteOne({ _id: backupToDelete._id });

      // 삭제 로그 저장
      const logsCollection = db?.collection('backup_logs');
      await logsCollection?.insertOne({
        action: 'backup_deleted',
        backupName,
        deletedChunks: chunkResult?.deletedCount || 0,
        timestamp: new Date()
      });

      return NextResponse.json({
        success: true,
        message: `백업 '${backupName}'이 삭제되었습니다. (청크 ${chunkResult?.deletedCount || 0}개 포함)`
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