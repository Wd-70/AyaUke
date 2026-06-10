/**
 * @deprecated 새 코드는 '@/shared/db/mongodb'의 connectDB를 사용하세요.
 * 기존 import 경로 호환을 위한 re-export 심 — 점진적 이전 후 삭제 예정.
 */
import { connectDB } from '@/shared/db/mongodb';

export default connectDB;
export { connectDB as connectToDatabase, connectDB };
