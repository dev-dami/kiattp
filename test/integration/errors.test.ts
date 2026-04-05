import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { request, createInstance } from '../../src';

const server = setupServer(
  http.get('https://api.example.com/notfound', () => {
    return HttpResponse.json({ error: 'not found' }, { status: 404 });
  }),
  http.get('https://api.example.com/server-error', () => {
    return HttpResponse.json({ error: 'internal' }, { status: 500 });
  }),
  http.get('https://api.example.com/slow', async () => {
    await new Promise((r) => setTimeout(r, 5000));
    return HttpResponse.json({ ok: true });
  }),
);

beforeAll(() => server.listen());
afterAll(() => server.close());

describe('error handling', () => {
  it('throws HttpError with response on 404', async () => {
    try {
      await request('https://api.example.com/notfound');
      expect.fail('should have thrown');
    } catch (err: any) {
      expect(err.name).toBe('HttpError');
      expect(err.status).toBe(404);
      expect(err.response.data).toEqual({ error: 'not found' });
      expect(err.config).toBeDefined();
    }
  });

  it('throws HttpError with response on 500', async () => {
    try {
      await request('https://api.example.com/server-error');
      expect.fail('should have thrown');
    } catch (err: any) {
      expect(err.status).toBe(500);
      expect(err.response.data).toEqual({ error: 'internal' });
    }
  });

  it('throws on timeout', async () => {
    try {
      await request('https://api.example.com/slow', { timeout: 100 });
      expect.fail('should have thrown');
    } catch (err: any) {
      expect(err.name).toBe('AbortError');
    }
  });

  it('throws AbortError on cancellation', async () => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 10);

    try {
      await request('https://api.example.com/slow', { signal: controller.signal });
      expect.fail('should have thrown');
    } catch (err: any) {
      expect(err.name).toBe('AbortError');
    }
  });

  it('validateStatus can be customized', async () => {
    const api = createInstance({
      validateStatus: (status: number) => status < 500,
    });

    // 404 should not throw with custom validateStatus
    const res = await api.request('https://api.example.com/notfound');
    expect(res.status).toBe(404);
  });
});
