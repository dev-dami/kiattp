import { describe, it, expect, vi, afterEach } from 'vitest';
import { createInstance } from '../../src/instance';

describe('baseURL + leading slash path (relative baseURL)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not double-prefix baseURL when path starts with /', async () => {
    const capturedUrls: string[] = [];

    // Spy on global fetch to capture the URL actually used
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      capturedUrls.push(url);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }));

    const instance = createInstance({ baseURL: '/api' });
    await instance.post('/auth/login', { body: { email: 'test@test.com' } });

    expect(capturedUrls).toHaveLength(1);
    // Should be /api/auth/login, NOT /api/api/auth/login
    expect(capturedUrls[0]).toBe('/api/auth/login');
  });

  it('does not double-prefix baseURL when path does not start with /', async () => {
    const capturedUrls: string[] = [];

    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      capturedUrls.push(url);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }));

    const instance = createInstance({ baseURL: '/api' });
    await instance.get('users');

    expect(capturedUrls).toHaveLength(1);
    expect(capturedUrls[0]).toBe('/api/users');
  });
});
