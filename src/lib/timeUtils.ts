/**
 * Parse time string to seconds
 * Supports formats: HH:MM:SS, MM:SS, H:MM:SS, M:SS
 */
export function parseTimeToSeconds(timeStr: string): number {
  const colonHmsMatch = timeStr.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
  if (colonHmsMatch) {
    return parseInt(colonHmsMatch[1]) * 3600 + parseInt(colonHmsMatch[2]) * 60 + parseInt(colonHmsMatch[3]);
  }

  const colonMsMatch = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (colonMsMatch) {
    return parseInt(colonMsMatch[1]) * 60 + parseInt(colonMsMatch[2]);
  }

  return 0;
}

/**
 * Format seconds to HH:MM:SS or MM:SS
 */
export function formatSeconds(seconds: number): string {
  // Handle negative timestamps - clamp to 0:00
  // Negative values occur when YouTube video starts before Chzzk video (negative timeOffset)
  // Clamping to 0:00 provides clearest user experience
  if (seconds < 0) {
    return '0:00';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  } else {
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  }
}

/**
 * Format offset with +/- sign
 */
export function formatOffset(seconds: number): string {
  const sign = seconds >= 0 ? "+" : "-";
  const absSeconds = Math.abs(seconds);
  const minutes = Math.floor(absSeconds / 60);
  const secs = Math.floor(absSeconds % 60);
  return `${sign}${minutes}:${secs.toString().padStart(2, "0")}`;
}
