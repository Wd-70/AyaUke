/**
 * Error Transformer Utility
 * Converts technical error messages into user-friendly Korean messages
 */

export function transformError(error: any): string {
  console.error('[Error Details]:', error);

  // Handle AbortError (cancelled requests)
  if (error.name === 'AbortError') {
    return '요청이 취소되었습니다.';
  }

  // Network errors
  if (error.code === 'ECONNREFUSED') {
    return '서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.';
  }

  if (error.code === 'ENOTFOUND' || error.code === 'EAI_AGAIN') {
    return '네트워크 연결을 확인해주세요.';
  }

  if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
    return '요청 시간이 초과되었습니다. 네트워크 연결을 확인해주세요.';
  }

  // HTTP status errors
  if (error.response?.status || error.status) {
    const status = error.response?.status || error.status;

    switch (status) {
      case 400:
        return '잘못된 요청입니다. 입력 값을 확인해주세요.';
      case 401:
        return '인증이 필요합니다. 다시 로그인해주세요.';
      case 403:
        return '권한이 없습니다. 관리자에게 문의하세요.';
      case 404:
        return '요청한 리소스를 찾을 수 없습니다.';
      case 429:
        return 'API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.';
      case 500:
        return '서버 오류가 발생했습니다. 관리자에게 문의하세요.';
      case 502:
      case 503:
        return '서버가 일시적으로 사용 불가능합니다. 잠시 후 다시 시도해주세요.';
      case 504:
        return '서버 응답 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.';
      default:
        if (status >= 500) {
          return `서버 오류가 발생했습니다. (${status})`;
        }
        if (status >= 400) {
          return `클라이언트 오류가 발생했습니다. (${status})`;
        }
    }
  }

  // Parse HTTP status from message (e.g., "HTTP 404")
  const httpStatusMatch = error.message?.match(/HTTP (\d{3})/);
  if (httpStatusMatch) {
    const status = parseInt(httpStatusMatch[1]);
    if (status === 404) return '요청한 리소스를 찾을 수 없습니다.';
    if (status === 401 || status === 403) return '권한이 없습니다. 다시 로그인해주세요.';
    if (status >= 500) return `서버 오류가 발생했습니다. (${status})`;
    if (status >= 400) return `클라이언트 오류가 발생했습니다. (${status})`;
  }

  // MongoDB errors
  if (error.name === 'MongoError' || error.name === 'MongoServerError') {
    return '데이터베이스 오류가 발생했습니다. 관리자에게 문의하세요.';
  }

  // Chzzk API specific errors
  if (error.message?.includes('Chzzk API error: 400')) {
    return 'Chzzk API 요청이 거부되었습니다. 채널 ID와 요청 매개변수를 확인해주세요.';
  }

  if (error.message?.includes('Chzzk API error: 403')) {
    return 'Chzzk API 접근이 거부되었습니다. 인증 정보를 확인해주세요.';
  }

  if (error.message?.includes('Chzzk API error: 404')) {
    return '요청한 Chzzk 리소스를 찾을 수 없습니다. 채널이나 영상이 삭제되었을 수 있습니다.';
  }

  if (error.message?.includes('Chzzk API error: 429')) {
    return 'Chzzk API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.';
  }

  if (error.message?.includes('Chzzk API error: 5')) {
    return 'Chzzk 서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
  }

  if (error.message?.includes('Chzzk') || error.message?.includes('치지직')) {
    const originalMessage = error.message || '';
    return `치지직 API 오류: ${originalMessage}`;
  }

  // YouTube API errors
  if (error.message?.includes('YouTube') || error.message?.includes('유튜브')) {
    const originalMessage = error.message || '';
    return `유튜브 API 오류: ${originalMessage}`;
  }

  // Generic error message
  if (error.message) {
    // Check for common error patterns
    if (error.message.includes('Failed to fetch')) {
      return '네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.';
    }

    if (error.message.includes('Network request failed')) {
      return '네트워크 요청이 실패했습니다. 연결 상태를 확인해주세요.';
    }

    if (error.message.includes('JSON')) {
      return '서버 응답 형식이 올바르지 않습니다. 관리자에게 문의하세요.';
    }

    // Return the original message if it's user-friendly
    if (error.message.length < 100 && !error.message.includes('Error:')) {
      return error.message;
    }
  }

  // Fallback
  return '알 수 없는 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
}

export function transformChzzkSyncError(error: any): string {
  // Use the existing transformError function for Chzzk sync errors
  return transformError(error);
}

export function transformRetryError(error: any, retryCount: number): string {
  const baseMessage = transformChzzkSyncError(error); // Use existing transformer

  if (retryCount > 0) {
    return `${baseMessage} (Failed after ${retryCount} retry attempts)`;
  }

  return baseMessage;
}
