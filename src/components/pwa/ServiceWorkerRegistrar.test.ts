import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const effect = vi.hoisted(() => ({ cleanup: undefined as void | (() => void) }));
vi.mock('react', () => ({ useEffect: (run: () => void | (() => void)) => { effect.cleanup = run(); } }));
import ServiceWorkerRegistrar from './ServiceWorkerRegistrar';

describe('PWA service worker startup', () => {
  const register = vi.fn().mockResolvedValue({});
  beforeEach(() => {
    register.mockClear();
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubGlobal('window', new EventTarget());
    vi.stubGlobal('document', { readyState: 'complete' });
    vi.stubGlobal('navigator', { serviceWorker: { register } });
  });
  afterEach(() => {
    effect.cleanup?.();
    effect.cleanup = undefined;
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
  it('registers when hydration happens after window.load', () => {
    ServiceWorkerRegistrar();
    expect(register).toHaveBeenCalledWith('/sw.js');
    expect(register).toHaveBeenCalledTimes(1);
  });
  it('waits for load while the page is still loading', () => {
    vi.stubGlobal('document', { readyState: 'loading' });
    ServiceWorkerRegistrar();
    expect(register).not.toHaveBeenCalled();
    window.dispatchEvent(new Event('load'));
    expect(register).toHaveBeenCalledTimes(1);
  });
  it('removes the load listener on unmount', () => {
    vi.stubGlobal('document', { readyState: 'loading' });
    ServiceWorkerRegistrar();
    effect.cleanup?.();
    window.dispatchEvent(new Event('load'));
    expect(register).not.toHaveBeenCalled();
  });
  it('does not fail in browsers without service workers', () => {
    vi.stubGlobal('navigator', {});
    expect(() => ServiceWorkerRegistrar()).not.toThrow();
    expect(register).not.toHaveBeenCalled();
  });
});
