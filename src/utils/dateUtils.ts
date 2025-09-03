export function parseOriginalDateString(originalDateString?: string, fallbackSungDate?: string | Date): string {
  // originalDateString이 있으면 파싱
  if (originalDateString) {
    const match = originalDateString.match(/(\d{2})\.(\d{1,2})\.(\d{1,2})/);
    if (match) {
      const year = parseInt(match[1]);
      const month = parseInt(match[2]);
      const day = parseInt(match[3]);
      // 2000년대로 가정 (25 -> 2025)
      const fullYear = year < 50 ? 2000 + year : 1900 + year;
      return `${fullYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }
  
  // originalDateString이 없으면 기존 sungDate 사용 (하위 호환성)
  if (fallbackSungDate) {
    try {
      const date = new Date(fallbackSungDate);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    } catch (error) {
      console.warn('Failed to parse fallback date:', fallbackSungDate);
    }
  }
  
  return new Date().toISOString().split('T')[0];
}

export function formatOriginalDateForDisplay(originalDateString?: string, fallbackSungDate?: string | Date): string {
  // originalDateString이 있으면 파싱
  if (originalDateString) {
    const match = originalDateString.match(/(\d{2})\.(\d{1,2})\.(\d{1,2})/);
    if (match) {
      const year = parseInt(match[1]);
      const month = parseInt(match[2]);
      const day = parseInt(match[3]);
      const fullYear = year < 50 ? 2000 + year : 1900 + year;
      return `${fullYear}. ${month}. ${day}.`;
    }
    return originalDateString;
  }
  
  // originalDateString이 없으면 기존 sungDate 사용 (하위 호환성)
  if (fallbackSungDate) {
    try {
      const date = new Date(fallbackSungDate);
      if (!isNaN(date.getTime())) {
        // 기존 한국어 형식으로 표시 (2025. 4. 20.)
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        return `${year}. ${month}. ${day}.`;
      }
    } catch (error) {
      console.warn('Failed to parse fallback date:', fallbackSungDate);
    }
  }
  
  return '날짜 없음';
}