/**
 * 서버측 도메인 에러 계층.
 * 서비스/도메인 코드는 AppError를 던지고, withApi가 표준 응답으로 변환한다.
 */
export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number = 400,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  constructor(message = '입력 값이 올바르지 않습니다.') {
    super('VALIDATION', message, 400);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = '로그인이 필요합니다.') {
    super('UNAUTHORIZED', message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = '권한이 없습니다.') {
    super('FORBIDDEN', message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message = '요청한 리소스를 찾을 수 없습니다.') {
    super('NOT_FOUND', message, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message = '이미 존재하는 데이터입니다.') {
    super('CONFLICT', message, 409);
  }
}

/**
 * 알 수 없는 에러를 [code, message, status]로 매핑한다.
 * mongoose 관련 에러는 사용자 친화적 한국어 메시지로 변환.
 */
export function mapError(error: unknown): { code: string; message: string; status: number } {
  if (error instanceof AppError) {
    return { code: error.code, message: error.message, status: error.status };
  }

  if (error instanceof Error) {
    switch (error.name) {
      case 'ValidationError': // mongoose validation
        return { code: 'VALIDATION', message: '입력 값이 올바르지 않습니다.', status: 400 };
      case 'CastError': // 잘못된 ObjectId 등
        return { code: 'VALIDATION', message: '잘못된 형식의 식별자입니다.', status: 400 };
      case 'MongoServerError':
        if ((error as { code?: number }).code === 11000) {
          return { code: 'CONFLICT', message: '이미 존재하는 데이터입니다.', status: 409 };
        }
        return { code: 'DB_ERROR', message: '데이터베이스 오류가 발생했습니다.', status: 500 };
    }
  }

  console.error('[API] Unhandled error:', error);
  return { code: 'INTERNAL', message: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.', status: 500 };
}
