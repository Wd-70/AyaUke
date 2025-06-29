import { redirect } from 'next/navigation';
import TestDBClient from './TestDBClient';

export default function TestDBPage() {
  // 서버 사이드에서 프로덕션 환경 차단
  if (process.env.NODE_ENV === 'production') {
    redirect('/');
  }

  return <TestDBClient />;
}