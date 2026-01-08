import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error(
    'Please define the MONGODB_URI environment variable inside .env.local'
  );
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var mongoose: MongooseCache;
}

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function dbConnect(): Promise<typeof mongoose> {
  if (cached.conn) {
    // console.log('🔄 기존 MongoDB 연결 재사용');
    return cached.conn;
  }

  if (!cached.promise) {
    // console.log('🚀 새로운 MongoDB 연결 시작...');
    // console.log('📍 MongoDB URI:', MONGODB_URI ? 'URI 설정됨' : 'URI 없음');
    
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 8000, // 8초로 증가
      connectTimeoutMS: 8000,
      socketTimeoutMS: 8000,
      // 재시도 옵션
      retryWrites: true,
      retryReads: true,
      maxPoolSize: 10,
      minPoolSize: 1,
      maxIdleTimeMS: 30000,
      // Heartbeat 옵션
      heartbeatFrequencyMS: 10000,
    };

    cached.promise = mongoose.connect(MONGODB_URI!, opts).then((mongoose) => {
      // console.log('✅ MongoDB 연결 성공!');
      return mongoose;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    console.error('❌ MongoDB 연결 실패:', e);
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export default dbConnect;
export { dbConnect as connectToDatabase };