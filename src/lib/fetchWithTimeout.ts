/**
 * Fetches a resource with automatic timeout handling.
 *
 * @param url - The URL to fetch
 * @param options - Standard fetch options (method, headers, body, etc.)
 * @param timeout - Timeout in milliseconds (default: 30000ms = 30 seconds)
 * @returns Promise<Response> - The fetch response
 * @throws Error with descriptive message if request times out or fails
 *
 * @example
 * try {
 *   const response = await fetchWithTimeout('/api/data', { method: 'GET' });
 *   const data = await response.json();
 * } catch (error) {
 *   if (error.message.includes('timeout')) {
 *     // Handle timeout specifically
 *   }
 * }
 */
export async function fetchWithTimeout(
  url: string,
  options?: RequestInit,
  timeout: number = 30000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);

    // Detect AbortError by name
    if (error.name === 'AbortError') {
      throw new Error(
        `Request timeout: The request to ${url} took longer than ${timeout / 1000} seconds and was aborted.`
      );
    }

    // Re-throw other fetch errors
    throw error;
  }
}

/**
 * Convenience wrapper for JSON responses with timeout handling.
 *
 * @param url - The URL to fetch
 * @param options - Standard fetch options
 * @param timeout - Timeout in milliseconds (default: 30000ms)
 * @returns Promise<T> - Parsed JSON response
 */
export async function fetchJsonWithTimeout<T = any>(
  url: string,
  options?: RequestInit,
  timeout: number = 30000
): Promise<T> {
  const response = await fetchWithTimeout(url, options, timeout);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}
