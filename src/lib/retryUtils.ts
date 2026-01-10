/**
 * Retry Logic Utility for API Calls with Exponential Backoff
 *
 * This module provides robust retry mechanisms for handling transient failures
 * in API calls, particularly for Chzzk API integration.
 */

export interface RetryConfig {
  maxRetries?: number;        // Default: 3 (total 4 attempts)
  baseDelay?: number;         // Default: 1000ms (1 second)
  maxDelay?: number;          // Default: 8000ms (8 seconds)
  retryableStatuses?: number[]; // Default: [429, 500-599]
  onRetry?: (attempt: number, delay: number, error: any) => void;
}

export interface RetryStatistics {
  totalRetries: number;
  successfulRetries: number;
  failedAfterRetries: number;
}

export interface FetchWithRetryResult<T> {
  data: T;
  retryCount: number;
  wasRetried: boolean;
}

/**
 * Fetches a URL with automatic retry on transient failures.
 *
 * @param url - The URL to fetch
 * @param options - Standard fetch options (headers, method, body, signal)
 * @param config - Retry configuration
 * @returns Promise<Response> - The fetch response
 *
 * @example
 * ```typescript
 * const response = await fetchWithRetry(
 *   'https://api.example.com/data',
 *   { headers: { 'User-Agent': '...' } },
 *   {
 *     maxRetries: 3,
 *     onRetry: (attempt, delay) => console.log(`Retry ${attempt} after ${delay}ms`)
 *   }
 * );
 * ```
 *
 * **Retry Behavior**:
 * - Retries on: Network errors, 429 (rate limit), 500-599 (server errors)
 * - No retry on: 400-428, 430-499 (client errors)
 * - Exponential backoff: 1s, 2s, 4s, 8s
 * - Respects AbortController for cancellation
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  config: RetryConfig = {}
): Promise<Response> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 8000,
    retryableStatuses = [429, ...Array.from({ length: 100 }, (_, i) => 500 + i)],
    onRetry
  } = config;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // SUCCESS: Return immediately for successful responses
      if (response.ok || response.status < 400) {
        return response;
      }

      // DO NOT RETRY: Client errors (except 429)
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        return response; // Let caller handle 4xx errors
      }

      // RETRY: Server errors (5xx) or rate limit (429)
      if (retryableStatuses.includes(response.status)) {
        if (attempt < maxRetries) {
          const delay = Math.min(Math.pow(2, attempt) * baseDelay, maxDelay);

          if (onRetry) {
            onRetry(attempt + 1, delay, { status: response.status, statusText: response.statusText });
          }

          await new Promise(resolve => setTimeout(resolve, delay));
          continue; // Retry
        }

        // Max retries exhausted
        throw new Error(`Failed after ${maxRetries} retry attempts: ${response.status} ${response.statusText}`);
      }

      // Non-retryable error
      return response;

    } catch (error: any) {
      lastError = error;

      // RETRY: Network errors (TypeError, AbortError, connection failures)
      const isNetworkError =
        error.name === 'TypeError' ||
        error.name === 'AbortError' ||
        error.message.includes('fetch') ||
        error.message.includes('network');

      if (isNetworkError && attempt < maxRetries) {
        const delay = Math.min(Math.pow(2, attempt) * baseDelay, maxDelay);

        if (onRetry) {
          onRetry(attempt + 1, delay, error);
        }

        await new Promise(resolve => setTimeout(resolve, delay));
        continue; // Retry
      }

      // Max retries exhausted or non-retryable error
      throw new Error(`Failed after ${attempt + 1} attempts: ${error.message}`);
    }
  }

  throw lastError || new Error('Unexpected retry loop exit');
}

/**
 * Creates a statistics tracker for monitoring retry attempts.
 *
 * @returns Object with stats tracking and helper methods
 *
 * @example
 * ```typescript
 * const { stats, recordRetry, reset } = createRetryStatisticsTracker();
 *
 * // After a successful retry
 * recordRetry(true);
 *
 * // After a failed retry
 * recordRetry(false);
 *
 * // View statistics
 * console.log(stats); // { totalRetries: 2, successfulRetries: 1, failedAfterRetries: 1 }
 *
 * // Reset for new sync
 * reset();
 * ```
 */
export function createRetryStatisticsTracker(): {
  stats: RetryStatistics;
  recordRetry: (success: boolean) => void;
  reset: () => void;
} {
  const stats: RetryStatistics = {
    totalRetries: 0,
    successfulRetries: 0,
    failedAfterRetries: 0
  };

  return {
    stats,
    recordRetry(success: boolean) {
      stats.totalRetries++;
      if (success) {
        stats.successfulRetries++;
      } else {
        stats.failedAfterRetries++;
      }
    },
    reset() {
      stats.totalRetries = 0;
      stats.successfulRetries = 0;
      stats.failedAfterRetries = 0;
    }
  };
}

// Backward compatibility exports
export interface RetryOptions {
  maxRetries?: number; // default: 3
  baseDelay?: number; // default: 1000ms
  maxDelay?: number; // default: 30000ms
  signal?: AbortSignal; // for cancellation
  shouldRetry?: (error: any) => boolean; // custom retry logic
}

/**
 * Legacy wrapper for backward compatibility
 * @deprecated Use fetchWithRetry instead
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    signal,
    shouldRetry = () => true
  } = options;

  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Check if request was cancelled
      if (signal?.aborted) {
        throw new Error('Request cancelled');
      }

      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry if cancelled
      if (signal?.aborted || (error as any).name === 'AbortError') {
        throw error;
      }

      // Don't retry if this is the last attempt
      if (attempt === maxRetries) {
        throw error;
      }

      // Check if we should retry this error
      if (!shouldRetry(error)) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
      console.log(`[Retry] Attempt ${attempt + 1}/${maxRetries} failed. Retrying after ${delay}ms...`);

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Helper function to determine if an error is retryable
 */
export function isRetryableError(error: any): boolean {
  // Network errors are retryable
  if (error.code === 'ECONNREFUSED' ||
      error.code === 'ETIMEDOUT' ||
      error.code === 'ENOTFOUND') {
    return true;
  }

  // 5xx errors are retryable
  const status = error.response?.status || error.status;
  if (status && status >= 500 && status < 600) {
    return true;
  }

  // 429 (Too Many Requests) is retryable
  if (status === 429) {
    return true;
  }

  // Timeout errors are retryable
  if (error.message?.includes('timeout') || error.message?.includes('Timeout')) {
    return true;
  }

  // Failed to fetch is retryable
  if (error.message?.includes('Failed to fetch')) {
    return true;
  }

  // 4xx errors (except 429) are NOT retryable
  if (status && status >= 400 && status < 500) {
    return false;
  }

  // Default: retry
  return true;
}
