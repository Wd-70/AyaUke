import type { MvWork } from './types';

/**
 * 클립 shareId → MV 작품. MV는 곡마다 손으로 연출한 코드라 레포에 커밋해 관리한다
 * (DB에 코드를 넣고 실행하지 않는다). 작품 코드는 무거우므로 동적 import.
 */
const REGISTRY: Record<string, () => Promise<MvWork>> = {
  z1baTcmHs8WJ: () => import('./works/samurai-heart').then((m) => m.default),
};

export function hasMv(shareId: string): boolean {
  return shareId in REGISTRY;
}

export function loadMv(shareId: string): Promise<MvWork> | null {
  const load = REGISTRY[shareId];
  return load ? load() : null;
}
