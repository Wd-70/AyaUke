import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { getSortedRoutes } from 'next/dist/shared/lib/router/utils/sorted-routes';
vi.mock('@/lib/authOptions', () => ({ authOptions: {} }));
vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }));
vi.mock('@/shared/db/mongodb', () => ({ connectDB: vi.fn() }));
vi.mock('./clip-range.service', () => ({
  getRanges: vi.fn(), savePersonal: vi.fn(), propose: vi.fn(), evaluate: vi.fn(), withdraw: vi.fn(), publishOfficial: vi.fn(),
}));
import { getServerSession } from 'next-auth/next';
import * as service from './clip-range.service';
import { POST, GET } from '@/app/api/clips/[id]/range/route';
import { GET as batchGET } from '@/app/api/clips/ranges/route';
const clipId = '000000000000000000000001';
const owner = '000000000000000000000002';
const context = { params: Promise.resolve({ id: clipId }) };
const personal = { action: 'personal', sourceVersion: 0, range: { startTime: 100.1, endTime: 370 } };
const request = (body: unknown) => new NextRequest(`http://localhost/api/clips/${clipId}/range`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getServerSession).mockResolvedValue({ user: { userId: owner, role: 'user' } });
  vi.mocked(service.getRanges).mockResolvedValue([]);
});

describe('구간 API 접근 제어', () => {
  it('실제 클립 API 파일 경로에 동적 파라미터 이름 충돌이 없다', () => {
    const root = path.join(process.cwd(), 'src/app/api/clips');
    const routes = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) return routes(file);
      return entry.name === 'route.ts'
        ? ['/api/clips/' + path.relative(root, dir).split(path.sep).join('/')]
        : [];
    });
    const paths = routes(root);
    expect(paths).toContain('/api/clips/[id]/range');
    expect(() => getSortedRoutes(paths)).not.toThrow();
  });
  it('익명 사용자는 저장할 수 없다', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    expect((await POST(request(personal), context)).status).toBe(401);
    expect(service.savePersonal).not.toHaveBeenCalled();
  });
  it('개인 설정 소유자는 요청 본문이 아닌 세션에서 결정한다', async () => {
    const response = await POST(request({ ...personal, userId: 'other' }), context);
    expect(response.status).toBe(200);
    expect(service.savePersonal).toHaveBeenCalledWith(clipId, owner, 0, personal.range, false);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  });
  it('일반 사용자는 공식 값으로 등록하지 못한다', async () => {
    const response = await POST(request({ ...personal, action: 'publish', baseVersion: 0 }), context);
    expect(response.status).toBe(403);
    expect(service.publishOfficial).not.toHaveBeenCalled();
  });
  it('기존 검증 권한을 가진 관리자만 공식 저장한다', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { userId: owner, role: 'song_admin' } });
    expect((await POST(request({ ...personal, action: 'publish', baseVersion: 0 }), context)).status).toBe(200);
    expect(service.publishOfficial).toHaveBeenCalledWith(clipId, owner, 0, 0, personal.range, undefined);
  });
  it('범위 형식과 평가값, 과도한 일괄 조회를 검증한다', async () => {
    expect((await POST(request({ ...personal, range: { startTime: -1, endTime: 2 } }), context)).status).toBe(400);
    expect((await POST(request({ action: 'vote', proposalId: clipId, start: 3, end: 1 }), context)).status).toBe(400);
    const response = await batchGET(new NextRequest(`http://localhost/api/clips/ranges?ids=${Array(11).fill(clipId).join(',')}`), context);
    expect(response.status).toBe(400);
    expect(service.getRanges).not.toHaveBeenCalled();
  });
  it('일괄 조회도 개인 정보를 공용 캐시에 저장하지 않는다', async () => {
    const response = await batchGET(new NextRequest(`http://localhost/api/clips/ranges?ids=${clipId}`), context);
    expect(response.status).toBe(200);
    expect(service.getRanges).toHaveBeenCalledWith([clipId], owner);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  });
  it('없는 클립의 상세 조회는 404다', async () => {
    expect((await GET(new NextRequest(`http://localhost/api/clips/${clipId}/range`), context)).status).toBe(404);
  });
});
