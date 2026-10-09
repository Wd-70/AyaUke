import { afterEach, describe, expect, it, vi } from 'vitest';
import { saveWorkflowItem, workflowRequest } from './workflow-client';

afterEach(() => vi.unstubAllGlobals());

describe('workflow persistence', () => {
  it('rejects HTTP and application errors instead of reporting success', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: false, error: { message: '저장 실패' } }))));
    await expect(workflowRequest('/test')).rejects.toThrow('Unauthorized');
    await expect(workflowRequest('/test')).rejects.toThrow('저장 실패');
  });

  it('preserves an explicit null end time in the save request', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true })));
    vi.stubGlobal('fetch', fetch);
    await workflowRequest('/test', { method: 'PATCH', body: JSON.stringify({ data: { endTime: null } }) });
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ data: { endTime: null } });
  });

  it('serializes edits for one item and only marks the final response as latest', async () => {
    let finishFirst!: (response: Response) => void;
    const fetch = vi.fn()
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { finishFirst = resolve; }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: { item: { id: 'ordered', endTimeSeconds: 320 } } })));
    vi.stubGlobal('fetch', fetch);
    const first = saveWorkflowItem('ordered', { matchedSongId: 'song' });
    const second = saveWorkflowItem('ordered', { startTimeSeconds: 20, endTimeSeconds: 320 });
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    finishFirst(new Response(JSON.stringify({ success: true, data: { item: { id: 'ordered', endTimeSeconds: 300 } } })));
    expect(await first).toMatchObject({ latest: false });
    expect(await second).toEqual({ latest: true, item: { id: 'ordered', endTimeSeconds: 320 } });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('returns the server-calculated end time, not the old song default', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: true, data: { item: { id: 'matched', matchedSongId: 'song', startTimeSeconds: 10, endTimeSeconds: 250, duration: 240 } },
    }))));
    expect((await saveWorkflowItem('matched', { matchedSongId: 'song' })).item.endTimeSeconds).toBe(250);
  });

  it('continues queued saves after a rejected request', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: { item: { id: 'retry', customDescription: 'saved' } } }))));
    const first = saveWorkflowItem('retry', { customDescription: 'failed' });
    const second = saveWorkflowItem('retry', { customDescription: 'saved' });
    await expect(first).rejects.toThrow('offline');
    expect(await second).toMatchObject({ latest: true, item: { customDescription: 'saved' } });
  });
});
