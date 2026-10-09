import type { WorkflowItem } from './types';

export async function workflowRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const result = await response.json().catch(() => null);
  if (!response.ok || !result || result.success === false) {
    throw new Error(result?.error?.message || (typeof result?.error === 'string' ? result.error : '요청에 실패했습니다. 다시 시도해주세요.'));
  }
  return result as T;
}

// 같은 항목의 연속 입력은 입력 순서대로 저장한다.
const pending = new Map<string, Promise<{ data: { item: WorkflowItem } }>>();
export async function saveWorkflowItem(id: string, body: Record<string, unknown>) {
  const task = (pending.get(id) ?? Promise.resolve()).catch(() => {}).then(() =>
    workflowRequest<{ data: { item: WorkflowItem } }>(`/api/admin/clip-workflow/item/${encodeURIComponent(id)}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }),
  );
  pending.set(id, task);
  try {
    const result = await task;
    return { item: result.data.item, latest: pending.get(id) === task };
  } finally {
    if (pending.get(id) === task) pending.delete(id);
  }
}
