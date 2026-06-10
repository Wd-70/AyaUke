import { NextResponse } from 'next/server';

/**
 * 모든 API 응답의 표준 봉투(envelope).
 * 성공: { success: true, data }
 * 실패: { success: false, error: { code, message } }
 */
export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ success: true, data } satisfies ApiResponse<T>, init);
}

export function fail(code: string, message: string, status = 400): NextResponse {
  return NextResponse.json(
    { success: false, error: { code, message } } satisfies ApiResponse<never>,
    { status },
  );
}
