/**
 * Unit tests for retry utility functions
 * @jest-environment node
 */

import { fetchWithRetry, createRetryStatisticsTracker } from '../retryUtils';

// Mock fetch globally
global.fetch = jest.fn();

describe('fetchWithRetry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockReset();
  });

  test('should succeed on first attempt', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: 'success' })
    });

    const response = await fetchWithRetry('https://api.test.com/data');
    expect(response.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('should retry on 429 status', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: false, status: 429, statusText: 'Too Many Requests' })
      .mockResolvedValueOnce({ ok: true, status: 200 });

    const response = await fetchWithRetry('https://api.test.com/data', {}, { maxRetries: 2 });
    expect(response.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test('should retry on 500 status', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Internal Server Error' })
      .mockResolvedValueOnce({ ok: true, status: 200 });

    const response = await fetchWithRetry('https://api.test.com/data', {}, { maxRetries: 2 });
    expect(response.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test('should NOT retry on 404 status', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 404, statusText: 'Not Found' });

    const response = await fetchWithRetry('https://api.test.com/data', {}, { maxRetries: 2 });
    expect(response.status).toBe(404);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('should exhaust retries and throw error', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500, statusText: 'Server Error' });

    await expect(
      fetchWithRetry('https://api.test.com/data', {}, { maxRetries: 2 })
    ).rejects.toThrow('Failed after 2 retry attempts');

    expect(global.fetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
  });

  test('should retry on network error', async () => {
    (global.fetch as jest.Mock)
      .mockRejectedValueOnce(new TypeError('Network request failed'))
      .mockResolvedValueOnce({ ok: true, status: 200 });

    const response = await fetchWithRetry('https://api.test.com/data', {}, { maxRetries: 2 });
    expect(response.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test('should call onRetry callback', async () => {
    const onRetry = jest.fn();
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: false, status: 429 })
      .mockResolvedValueOnce({ ok: true, status: 200 });

    await fetchWithRetry('https://api.test.com/data', {}, { maxRetries: 2, onRetry });

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(1, 1000, expect.any(Object));
  });

  test('should use exponential backoff delays', async () => {
    const delays: number[] = [];
    const onRetry = (attempt: number, delay: number) => delays.push(delay);

    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500 });

    await fetchWithRetry('https://api.test.com/data', {}, { maxRetries: 3, onRetry }).catch(() => {});

    expect(delays).toEqual([1000, 2000, 4000]); // 2^0 * 1000, 2^1 * 1000, 2^2 * 1000
  });
});

describe('createRetryStatisticsTracker', () => {
  test('should initialize with zero statistics', () => {
    const { stats } = createRetryStatisticsTracker();

    expect(stats.totalRetries).toBe(0);
    expect(stats.successfulRetries).toBe(0);
    expect(stats.failedAfterRetries).toBe(0);
  });

  test('should record successful retry', () => {
    const { stats, recordRetry } = createRetryStatisticsTracker();

    recordRetry(true);

    expect(stats.totalRetries).toBe(1);
    expect(stats.successfulRetries).toBe(1);
    expect(stats.failedAfterRetries).toBe(0);
  });

  test('should record failed retry', () => {
    const { stats, recordRetry } = createRetryStatisticsTracker();

    recordRetry(false);

    expect(stats.totalRetries).toBe(1);
    expect(stats.successfulRetries).toBe(0);
    expect(stats.failedAfterRetries).toBe(1);
  });

  test('should track multiple retries', () => {
    const { stats, recordRetry } = createRetryStatisticsTracker();

    recordRetry(false); // Failed
    recordRetry(true);  // Success
    recordRetry(true);  // Success
    recordRetry(false); // Failed

    expect(stats.totalRetries).toBe(4);
    expect(stats.successfulRetries).toBe(2);
    expect(stats.failedAfterRetries).toBe(2);
  });

  test('should reset statistics', () => {
    const { stats, recordRetry, reset } = createRetryStatisticsTracker();

    recordRetry(true);
    recordRetry(false);

    expect(stats.totalRetries).toBe(2);

    reset();

    expect(stats.totalRetries).toBe(0);
    expect(stats.successfulRetries).toBe(0);
    expect(stats.failedAfterRetries).toBe(0);
  });
});
