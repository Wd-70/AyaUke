import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  // /test-db 경로에 대한 접근 제한
  if (request.nextUrl.pathname.startsWith('/test-db')) {
    // 프로덕션 환경에서는 홈페이지로 리다이렉트
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/test-db/:path*'
};