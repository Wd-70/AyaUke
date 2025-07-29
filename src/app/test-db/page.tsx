import { redirect } from 'next/navigation';

export default function TestDBPage() {
  // 기존 test-db 페이지는 관리자 페이지로 이전되었습니다
  redirect('/admin');
}