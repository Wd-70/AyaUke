/**
 * 타임라인 댓글 파싱 — 순수 함수만 (DB/네트워크 없음).
 * 치지직/유튜브 댓글에서 타임스탬프를 감지·추출·변환한다.
 */

// 주의: 전역(g) 플래그 정규식을 test()에 재사용하면 lastIndex가 남아
// 호출마다 결과가 달라진다. 감지용 패턴은 g 없이 정의한다.
const DETECTION_PATTERNS = [
  /(\d{1,2}):(\d{2}):(\d{2})/, // 1:23:45
  /(\d{1,2}):(\d{2})/, // 3:45
  /(\d{1,2})분(\d{2})초/, // 3분45초
  /@(\d{1,2}):(\d{2}):(\d{2})/, // @1:23:45
  /@(\d{1,2}):(\d{2})/, // @3:45
  /\b(\d{1,2})분\b/, // 3분
  /\b(\d+)초\b/, // 45초
];

/** 댓글에 타임스탬프가 포함되어 있는가 */
export function isTimelineComment(content: string): boolean {
  return DETECTION_PATTERNS.some((pattern) => pattern.test(content));
}

/** 댓글에서 타임스탬프 문자열들을 추출 (긴 패턴 우선, 중복 제거) */
export function extractTimestamps(content: string): string[] {
  const priorityPatterns = [
    /(\d{1,2}):(\d{2}):(\d{2})/g, // 1:23:45
    /@(\d{1,2}):(\d{2}):(\d{2})/g, // @1:23:45
    /(\d{1,2}):(\d{2})/g, // 3:45
    /@(\d{1,2}):(\d{2})/g, // @3:45
    /(\d{1,2})분(\d{2})초/g, // 3분45초
    /\b(\d{1,2})분\b/g, // 3분
    /\b(\d+)초\b/g, // 45초
  ];

  const timestamps: string[] = [];
  for (const pattern of priorityPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      timestamps.push(match[0]);
    }
  }
  return [...new Set(timestamps)];
}

/** "H:MM:SS" | "MM:SS" | "123" | "X분Y초" | "X분" | "X초" → 초 */
export function parseTimeToSeconds(timeParam: string): number {
  const colonHmsMatch = timeParam.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
  if (colonHmsMatch) {
    return parseInt(colonHmsMatch[1]) * 3600 + parseInt(colonHmsMatch[2]) * 60 + parseInt(colonHmsMatch[3]);
  }

  const colonMsMatch = timeParam.match(/^(\d{1,2}):(\d{2})$/);
  if (colonMsMatch) {
    return parseInt(colonMsMatch[1]) * 60 + parseInt(colonMsMatch[2]);
  }

  if (/^\d+$/.test(timeParam)) {
    return parseInt(timeParam);
  }

  const minSecMatch = timeParam.match(/(\d+)분(\d+)초/);
  if (minSecMatch) {
    return parseInt(minSecMatch[1]) * 60 + parseInt(minSecMatch[2]);
  }

  const minMatch = timeParam.match(/(\d+)분/);
  if (minMatch) {
    return parseInt(minMatch[1]) * 60;
  }

  const secMatch = timeParam.match(/(\d+)초/);
  if (secMatch) {
    return parseInt(secMatch[1]);
  }

  return 0;
}

/**
 * 초 → "H:MM:SS" 또는 "M:SS".
 * 음수(유튜브 영상이 치지직보다 먼저 시작해 offset이 음수인 경우)는 0:00으로 클램프.
 */
export function formatSeconds(seconds: number): string {
  if (seconds < 0) return '0:00';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * 타임라인 댓글의 각 줄 머리 타임스탬프에 offset(초)을 더해 유튜브 기준으로 변환.
 * 줄 시작이 타임스탬프가 아니면 그대로 둔다.
 */
export function convertCommentTimestamps(content: string, timeOffset: number): string {
  return content
    .split('\n')
    .map((line) => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return line;

      // 줄 시작 타임스탬프: H:MM:SS 우선, 그 다음 MM:SS
      const match = trimmedLine.match(/^(\d{1,2}:\d{2}:\d{2})/) ?? trimmedLine.match(/^(\d{1,2}:\d{2})/);
      if (!match) return trimmedLine;

      const originalTime = match[1];
      const newTimestamp = formatSeconds(parseTimeToSeconds(originalTime) + timeOffset);
      return trimmedLine.replace(originalTime, newTimestamp);
    })
    .join('\n');
}
