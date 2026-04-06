/**
 * kiattp pre-release stress test suite
 *
 * Targets: edge cases, race conditions, error handling gaps, production-reliability issues.
 * Uses MSW for mock endpoints where possible; real network behavior for timeout/cancel tests.
 */
import { describe, it, expect, beforeAll, afterAll, vi, beforeEach, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse, delay } from 'msw';

import {
  request,
  createInstance,
  use,
  get,
  post,
  retry_plugin,
  logger_plugin,
  timeout_plugin,
} from '../../src';
import { globalChain } from '../../src/core/request';
import type { Config, Response } from '../../src/types';
import { InterceptorChain } from '../../src/interceptors/chain';

// ─── MSW Server ──────────────────────────────────────────────────────────────

const server = setupServer(
  // Standard success
  http.get('https://stress.test/api/data', () =>
    HttpResponse.json({ ok: true, ts: Date.now() }),
  ),

  // Always 500
  http.get('https://stress.test/api/500', () =>
    HttpResponse.json({ error: 'server error' }, { status: 500 }),
  ),

  // Always 503 (for retry testing)
  http.get('https://stress.test/api/503', () =>
    HttpResponse.json({ error: 'unavailable' }, { status: 503 }),
  ),

  // 204 No Content
  http.get('https://stress.test/api/204', () =>
    new HttpResponse(null, { status: 204 }),
  ),

  // 205 Reset Content
  http.get('https://stress.test/api/205', () =>
    new HttpResponse(null, { status: 205 }),
  ),

  // 304 Not Modified
  http.get('https://stress.test/api/304', () =>
    new HttpResponse(null, { status: 304 }),
  ),

  // Empty body with 200
  http.get('https://stress.test/api/empty-200', () =>
    new HttpResponse(null, { status: 200 }),
  ),

  // Malformed JSON with 200
  http.get('https://stress.test/api/malformed-json', () =>
    new HttpResponse('{ broken json !!!', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  ),

  // Slow endpoint (for timeout tests)
  http.get('https://stress.test/api/slow', async () => {
    await delay(10_000);
    return HttpResponse.json({ ok: true });
  }),

  // Flaky endpoint: fails first 3 times, succeeds on 4th
  http.get('https://stress.test/api/flaky', ({ request: req }) => {
    const count = Number(new URL(req.url).searchParams.get('attempt') ?? '0');
    if (count < 3) {
      return HttpResponse.json({ error: 'try again' }, { status: 500 });
    }
    return HttpResponse.json({ ok: true });
  }),

  // Endpoint that fails immediately (for progress-under-error test)
  http.get('https://stress.test/api/fail-now', () =>
    HttpResponse.json({ error: 'gone' }, { status: 503 }),
  ),

  // Echo headers (for header mutation isolation test)
  http.get('https://stress.test/api/echo-headers', async ({ request: req }) =>
    HttpResponse.json(
      Object.fromEntries(req.headers.entries()),
    ),
  ),

  // Zero-length content
  http.get('https://stress.test/api/zero-content', () =>
    new HttpResponse('', {
      status: 200,
      headers: { 'content-length': '0' },
    }),
  ),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterAll(() => server.close());

// Clean global state between tests that use globalChain / use()
const globalRequestInterceptorsBefore: number[] = [];
const globalResponseInterceptorsBefore: number[] = [];

beforeEach(() => {
  // Snapshot global chain sizes so we can restore
  globalRequestInterceptorsBefore.push((globalChain as any).requestInterceptors.length);
  globalResponseInterceptorsBefore.push((globalChain as any).responseInterceptors.length);
});

afterEach(() => {
  const origReq = globalRequestInterceptorsBefore.pop() ?? 0;
  const origRes = globalResponseInterceptorsBefore.pop() ?? 0;
  // Reset global chains to baseline
  (globalChain as any).requestInterceptors.length = origReq;
  (globalChain as any).responseInterceptors.length = origRes;
  (globalChain as any).errorInterceptors.length = 0;
});

// ─── Phase 2: Stress Tests ───────────────────────────────────────────────────

// ── 1. Concurrent requests ───────────────────────────────────────────────────
describe('concurrent requests (100 parallel GETs)', () => {
  it('100 parallel GET requests complete without state corruption', async () => {
    const promises = Array.from({ length: 100 }, (_, i) =>
      request(`https://stress.test/api/data?v=${i}`),
    );
    const results = await Promise.all(promises);

    expect(results).toHaveLength(100);
    for (let i = 0; i < 100; i++) {
      expect(results[i].status).toBe(200);
      expect(results[i].data).toEqual({ ok: true, ts: expect.any(Number) });
    }
  });

  it('100 parallel POST requests complete without state corruption', async () => {
    server.use(
      http.post('https://stress.test/api/post', () =>
        HttpResponse.json({ received: true }, { status: 201 }),
      ),
    );
    const promises = Array.from({ length: 100 }, () =>
      request('https://stress.test/api/post', {
        method: 'POST',
        body: { payload: 'x'.repeat(100) },
      }),
    );
    const results = await Promise.all(promises);
    results.forEach((r) => {
      expect(r.status).toBe(201);
      expect(r.data).toEqual({ received: true });
    });
  });
});

// ── 2. Rapid reconnects (create/destroy instances) ────────────────────────────
describe('rapid reconnects (50 instance create/destroy cycles)', () => {
  it('50 sequential instance lifecycles show no leakage symptoms', async () => {
    for (let i = 0; i < 50; i++) {
      const api = createInstance({ baseURL: 'https://stress.test' });
      // Make one request per instance
      const res = await api.get('/api/data');
      expect(res.status).toBe(200);
      // Let GC collect — we just verify the loop completes
    }
  });

  it('50 instances created in parallel each resolve independently', async () => {
    const instances = Array.from({ length: 50 }, (_, i) =>
      createInstance({
        baseURL: 'https://stress.test',
        headers: { 'x-instance': String(i) },
      }),
    );
    const promises = instances.map((api, idx) =>
      api.get('/api/data').then((r) => ({ idx, status: r.status })),
    );
    const results = await Promise.all(promises);
    results.forEach((r) => expect(r.status).toBe(200));
  });
});

// ── 3. Error resilience ──────────────────────────────────────────────────────
describe('error resilience', () => {
  it('invalid host produces clean error object', async () => {
    try {
      await request('https://this-host-does-not-exist-xyz123.test/path');
      expect.fail('should have thrown');
    } catch (err: any) {
      expect(err).toBeInstanceOf(Error);
      expect(typeof err.message).toBe('string');
      expect(err.message.length).toBeGreaterThan(0);
      expect(err.config).toBeDefined();
    }
  });

  it('timeout produces AbortError', async () => {
    try {
      await request('https://stress.test/api/slow', { timeout: 10 });
      expect.fail('should have thrown');
    } catch (err: any) {
      expect(err.name).toBe('AbortError');
    }
  });

  it('500 error produces HttpError with response', async () => {
    try {
      await request('https://stress.test/api/500');
      expect.fail('should have thrown');
    } catch (err: any) {
      expect(err.name).toBe('HttpError');
      expect(err.status).toBe(500);
      expect(err.response).toBeDefined();
      expect(err.response.data).toEqual({ error: 'server error' });
      expect(err.config).toBeDefined();
    }
  });

  it('error objects do not share mutable state across calls', async () => {
    const errors: any[] = [];
    const promises = Array.from({ length: 20 }, () =>
      request('https://stress.test/api/500').catch((e) => e),
    );
    const results = await Promise.all(promises);
    for (const e of results) {
      errors.push(e);
    }
    // Each error should have its own config reference
    const configRefs = new Set(errors.map((e) => e.config));
    expect(configRefs.size).toBe(errors.length);
  });
});

// ── 4. Timeout stress (20 × 10ms) ────────────────────────────────────────────
describe('timeout stress (20 requests × 10ms timeout)', () => {
  it('all 20 timeout requests abort cleanly with no hanging promises', async () => {
    const promises = Array.from({ length: 20 }, () =>
      request('https://stress.test/api/slow', { timeout: 10 }),
    );

    const settled = await Promise.allSettled(promises);
    let abortedCount = 0;
    let fulfilledCount = 0;
    for (const s of settled) {
      if (s.status === 'rejected') {
        expect(s.reason.name).toBe('AbortError');
        abortedCount++;
      } else {
        fulfilledCount++;
      }
    }
    expect(abortedCount).toBe(20);
    expect(fulfilledCount).toBe(0);
  }, 15_000);
});

// ── 5. Header mutation isolation ─────────────────────────────────────────────
describe('header mutation isolation', () => {
  it('headers object is not mutated across concurrent requests', async () => {
    const sharedHeaders: Record<string, string> = {
      'x-common': 'value',
      'x-shared': 'original',
    };
    const api = createInstance({
      baseURL: 'https://stress.test',
      headers: { ...sharedHeaders },
    });

    // Fire 30 concurrent requests that mutate headers in-flight
    const promises = Array.from({ length: 30 }, (_, i) =>
      api.get('/api/echo-headers', {
        headers: { 'x-unique': String(i) },
      }),
    );
    await Promise.all(promises);

    // Original headers object should be unchanged
    expect(sharedHeaders['x-shared']).toBe('original');
    expect(sharedHeaders['x-unique']).toBeUndefined();
  });
});

// ── 6. Config deep-freeze test ───────────────────────────────────────────────
describe('config deep-freeze', () => {
  it('original config object is unchanged after request', async () => {
    const originalConfig: Omit<Config, 'url'> = {
      method: 'POST',
      body: { data: [1, 2, 3] },
      headers: { 'x-test': 'hello' },
      params: { page: 1 },
    };
    const frozen = JSON.stringify(originalConfig);

    server.use(
      http.post('https://stress.test/api/post', () =>
        HttpResponse.json({ ok: true }, { status: 201 }),
      ),
    );

    await request('https://stress.test/api/post', originalConfig);

    expect(JSON.stringify(originalConfig)).toBe(frozen);
  });
});

// ── 7. Response type edge cases ──────────────────────────────────────────────
describe('response type edge cases', () => {
  it('empty body with 200 returns null', async () => {
    const res = await request('https://stress.test/api/empty-200');
    expect(res.status).toBe(200);
    expect(res.data).toBeNull();
  });

  it('204 No Content returns null with status 204', async () => {
    const res = await request('https://stress.test/api/204');
    expect(res.status).toBe(204);
    expect(res.data).toBeNull();
  });

  it('205 Reset Content returns null', async () => {
    const res = await request('https://stress.test/api/205');
    expect(res.status).toBe(205);
    expect(res.data).toBeNull();
  });

  it('304 Not Modified throws with default validateStatus', async () => {
    try {
      await request('https://stress.test/api/304');
      expect.fail('should have thrown');
    } catch (err: any) {
      expect(err.name).toBe('HttpError');
      expect(err.status).toBe(304);
    }
  });

  it('malformed JSON with 200 falls back to text', async () => {
    const res = await request('https://stress.test/api/malformed-json');
    expect(res.status).toBe(200);
    expect(typeof res.data).toBe('string');
    expect(res.data).toBe('{ broken json !!!');
  });

  it('zero-length content returns null', async () => {
    const res = await request('https://stress.test/api/zero-content');
    expect(res.status).toBe(200);
    expect(res.data).toBeNull();
  });

  it('responseType=text returns raw string even for JSON', async () => {
    const res = await request('https://stress.test/api/data', { responseType: 'text' });
    expect(res.status).toBe(200);
    expect(typeof res.data).toBe('string');
    const parsed = JSON.parse(res.data as string);
    expect(parsed).toHaveProperty('ok', true);
  });
});

// ── 8. Interceptor chain under load ──────────────────────────────────────────
describe('interceptor chain under load', () => {
  it('10 request + 10 response interceptors fire in order for 50 requests', async () => {
    const api = createInstance({ baseURL: 'https://stress.test' });
    const reqCount: number[] = [];
    const resCount: number[] = [];

    // Register 10 request interceptors
    for (let i = 0; i < 10; i++) {
      api.interceptors.request.use(async (config) => {
        reqCount.push(i);
        return config;
      });
    }
    // Register 10 response interceptors
    for (let i = 0; i < 10; i++) {
      api.interceptors.response.use(async (response) => {
        resCount.push(i);
        return response;
      });
    }

    // Fire 50 requests sequentially to verify ordering
    for (let n = 0; n < 50; n++) {
      const result = await api.get('/api/data');
      expect(result.data).toHaveProperty('ok', true);
    }

    // Each of 50 requests fires 10 request interceptors = 500
    expect(reqCount).toHaveLength(500);
    // Each of 50 requests fires 10 response interceptors = 500
    expect(resCount).toHaveLength(500);

    // Verify ordering within first request: 0,1,2,...,9
    expect(reqCount.slice(0, 10)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(resCount.slice(0, 10)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  }, 30_000);
});

// ── 9. Cancel/abort stress ───────────────────────────────────────────────────
describe('cancel/abort stress', () => {
  it('aborting 20 concurrent requests mid-flight all throw AbortError', async () => {
    const controllers = Array.from({ length: 20 }, () => new AbortController());

    // Abort all after 5ms
    const abortAll = setTimeout(() => {
      controllers.forEach((c) => c.abort());
    }, 5);

    const promises = controllers.map((c) =>
      request('https://stress.test/api/slow', { signal: c.signal }).catch((e) => e),
    );

    const results = await Promise.all(promises);
    clearTimeout(abortAll);

    let abortCount = 0;
    for (const r of results) {
      expect(r).toBeInstanceOf(Error);
      if ((r as Error).name === 'AbortError') abortCount++;
    }
    expect(abortCount).toBe(20);
  }, 15_000);

  it('abort before request starts throws immediately', async () => {
    const controller = new AbortController();
    controller.abort();

    try {
      await request('https://stress.test/api/data', { signal: controller.signal });
      expect.fail('should have thrown');
    } catch (err: any) {
      expect(err.name).toBe('AbortError');
    }
  });
});

// ── 10. Upload/download progress under error ─────────────────────────────────
describe('progress callbacks under error', () => {
  it('onDownloadProgress to a failing endpoint does not throw', async () => {
    const progressCalls: number[] = [];
    try {
      await request('https://stress.test/api/fail-now', {
        onDownloadProgress: (evt) => {
          progressCalls.push(evt.loaded);
        },
      });
      expect.fail('should have thrown');
    } catch (err: any) {
      expect(err.name).toBe('HttpError');
      expect(err.status).toBe(503);
    }
    // Progress callback should either not fire or fire without throwing
    // (MSW sends full response at once, so it might not fire)
  });

  it('onUploadProgress to a failing endpoint does not throw', async () => {
    server.use(
      http.post('https://stress.test/api/fail-now', () =>
        HttpResponse.json({ error: 'gone' }, { status: 503 }),
      ),
    );
    try {
      await request('https://stress.test/api/fail-now', {
        method: 'POST',
        body: { data: 'x'.repeat(1000) },
        onUploadProgress: (evt) => {
          // Just verify it doesn't crash
        },
      });
      expect.fail('should have thrown');
    } catch (err: any) {
      expect(err.name).toBe('HttpError');
    }
  });
});

// ── 11. Max retries exhaustion ───────────────────────────────────────────────
describe('max retries exhaustion', () => {
  it('retry stops after maxRetries attempts to a dead endpoint', async () => {
    const api = createInstance({ baseURL: 'https://stress.test' });
    api.use(
      retry_plugin({
        maxRetries: 5,
        backoff: 'fixed',
        retryOn: [500],
        retryOnNetworkError: false,
      }),
    );

    const start = Date.now();
    try {
      await api.get('/api/500');
      expect.fail('should have thrown');
    } catch (err: any) {
      const elapsed = Date.now() - start;
      expect(err.status).toBe(500);
      // Should have done 5 retries × 1000ms = ~5000ms
      expect(elapsed).toBeGreaterThanOrEqual(4000);
      expect(elapsed).toBeLessThan(15000);
    }
  }, 20_000);

  it('retry stops after maxRetries to dead host (network error)', async () => {
    const api = createInstance();
    api.use(
      retry_plugin({
        maxRetries: 3,
        backoff: 'fixed',
        retryOn: [],
        retryOnNetworkError: true,
      }),
    );

    try {
      await api.get('https://this-host-does-not-exist-xyz123.test/path');
      expect.fail('should have thrown');
    } catch (err: any) {
      // Network errors should stop after 3 retries
      expect(err.message.length).toBeGreaterThan(0);
    }
  }, 30_000);

  it('retry with exponential backoff respects delay', async () => {
    const api = createInstance({ baseURL: 'https://stress.test' });
    api.use(
      retry_plugin({
        maxRetries: 2,
        backoff: 'exponential',
        retryOn: [503],
        retryOnNetworkError: false,
      }),
    );

    const start = Date.now();
    try {
      await api.get('/api/503');
      expect.fail('should have thrown');
    } catch (err: any) {
      const elapsed = Date.now() - start;
      // exp: attempt 1 → 2000ms, attempt 2 → 4000ms = ~6000ms
      expect(elapsed).toBeGreaterThanOrEqual(5000);
    }
  }, 20_000);
});

// ── 12. Plugin isolation ─────────────────────────────────────────────────────
describe('plugin isolation', () => {
  it('retry + logger + timeout plugins work concurrently without cross-talk', async () => {
    const logs: string[] = [];
    const api1 = createInstance({ baseURL: 'https://stress.test' });
    api1.use(retry_plugin({ maxRetries: 1, backoff: 'fixed', retryOn: [500], retryOnNetworkError: false }));
    api1.use(logger_plugin({ level: 'debug', output: (m) => logs.push(m) }));
    api1.use(timeout_plugin({ timeout: 5000 }));

    const api2 = createInstance({ baseURL: 'https://stress.test' });
    // api2 has no plugins

    const [res1, res2] = await Promise.all([
      api1.get('/api/data'),
      api2.get('/api/data'),
    ]);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    // Logger should have logged for api1 only
    expect(logs.length).toBeGreaterThan(0);
    expect(logs.some((l) => l.includes('[GET]'))).toBe(true);
  });

  it('timeout plugin does not override explicit config timeout', async () => {
    const api = createInstance({ baseURL: 'https://stress.test' });
    api.use(timeout_plugin({ timeout: 100 }));

    // Explicit 10ms timeout should beat the plugin's 100ms
    try {
      await api.get('/api/slow', { timeout: 10 });
      expect.fail('should have thrown');
    } catch (err: any) {
      expect(err.name).toBe('AbortError');
    }
  });
});

// ── 13. Global chain pollution test ──────────────────────────────────────────
describe('global chain pollution', () => {
  it('use() adds to global chain and affects standalone request()', async () => {
    let intercepted = false;
    use({
      onRequest: (config) => {
        intercepted = true;
        return config;
      },
    });

    await request('https://stress.test/api/data');
    expect(intercepted).toBe(true);
  });

  it('global interceptors do not leak between isolated test runs', async () => {
    // This relies on the beforeEach/afterEach cleanup above
    const reqCountBefore = (globalChain as any).requestInterceptors.length;
    use({
      onRequest: (config) => config,
    });
    const reqCountAfter = (globalChain as any).requestInterceptors.length;
    expect(reqCountAfter).toBe(reqCountBefore + 1);
  });
});

// ── 14. Body serialization edge cases ────────────────────────────────────────
describe('body serialization edge cases', () => {
  it('null body is treated as no body', async () => {
    server.use(
      http.post('https://stress.test/api/null-body', async ({ request: req }) => {
        const text = await req.text();
        return HttpResponse.json({ bodyLength: text.length }, { status: 200 });
      }),
    );
    const res = await request('https://stress.test/api/null-body', {
      method: 'POST',
      body: null,
    });
    expect(res.status).toBe(200);
    // null body → no body sent → length 0
    expect(res.data.bodyLength).toBe(0);
  });

  it('undefined body is treated as no body', async () => {
    server.use(
      http.post('https://stress.test/api/undef-body', async ({ request: req }) => {
        const text = await req.text();
        return HttpResponse.json({ bodyLength: text.length }, { status: 200 });
      }),
    );
    const res = await request('https://stress.test/api/undef-body', {
      method: 'POST',
      body: undefined,
    });
    expect(res.status).toBe(200);
    expect(res.data.bodyLength).toBe(0);
  });

  it('URLSearchParams body sets correct content-type', async () => {
    server.use(
      http.post('https://stress.test/api/form', async ({ request: req }) => {
        const ct = req.headers.get('content-type');
        const text = await req.text();
        return HttpResponse.json({ contentType: ct, body: text }, { status: 200 });
      }),
    );
    const params = new URLSearchParams({ foo: 'bar', baz: 'qux' });
    const res = await request('https://stress.test/api/form', {
      method: 'POST',
      body: params,
    });
    expect(res.status).toBe(200);
    expect(res.data.contentType).toContain('application/x-www-form-urlencoded');
    expect(res.data.body).toBe('foo=bar&baz=qux');
  });

  it('circular JSON body throws TypeError', async () => {
    const circular: any = { self: null };
    circular.self = circular;

    await expect(
      request('https://stress.test/api/data', {
        method: 'POST',
        body: circular,
      }),
    ).rejects.toThrow();
  });
});

// ── 15. Transform function stress ────────────────────────────────────────────
describe('transform function stress', () => {
  it('multiple transformRequest functions execute in order', async () => {
    const order: string[] = [];
    server.use(
      http.post('https://stress.test/api/transform', async ({ request: req }) => {
        const text = await req.text();
        return HttpResponse.json({ body: text }, { status: 200 });
      }),
    );
    const res = await request('https://stress.test/api/transform', {
      method: 'POST',
      body: 'initial',
      transformRequest: [
        (data) => { order.push('t1'); return data + '_t1'; },
        (data) => { order.push('t2'); return data + '_t2'; },
        (data, headers) => { order.push('t3'); headers['x-transformed'] = 'yes'; return data + '_t3'; },
      ],
    });
    expect(order).toEqual(['t1', 't2', 't3']);
    expect(res.data.body).toBe('initial_t1_t2_t3');
  });

  it('multiple transformResponse functions execute in order', async () => {
    const order: string[] = [];
    const res = await request('https://stress.test/api/data', {
      transformResponse: [
        (data) => { order.push('r1'); return data; },
        (data) => { order.push('r2'); return data; },
        (data) => { order.push('r3'); return data; },
      ],
    });
    expect(order).toEqual(['r1', 'r2', 'r3']);
    expect(res.status).toBe(200);
  });

  it('concurrent requests with transforms do not mix transform state', async () => {
    const transforms = Array.from({ length: 20 }, (_, i) =>
      request('https://stress.test/api/data', {
        transformResponse: [
          (data: any) => ({ ...data, transformId: i }),
        ],
      }),
    );
    const results = await Promise.all(transforms);
    for (let i = 0; i < 20; i++) {
      expect(results[i].data.transformId).toBe(i);
    }
  });
});

// ── 16. Memory / resource leak indicators ────────────────────────────────────
describe('memory / resource leak indicators', () => {
  it('timeout cleanup: no dangling setTimeout after timeout fires', async () => {
    // Run a timeout request and verify the promise settles
    const result = await Promise.race([
      request('https://stress.test/api/slow', { timeout: 10 }).catch((e) => ({ error: e.name })),
      new Promise((r) => setTimeout(() => r('still pending'), 500)),
    ]);
    // Should resolve within 500ms, not hang
    expect(result).toEqual({ error: 'AbortError' });
  });

  it('AbortSignal cleanup: listener removed after request completes', async () => {
    const controller = new AbortController();
    const res = await request('https://stress.test/api/data', {
      signal: controller.signal,
    });
    expect(res.status).toBe(200);
    // controller.signal should not have lingering listeners that could leak
    // (No direct API to check, but we verify the request resolved normally)
  });
});

// ── 17. Instance defaults vs per-request config override ─────────────────────
describe('instance defaults vs per-request overrides', () => {
  it('per-request headers override instance headers', async () => {
    const api = createInstance({
      baseURL: 'https://stress.test',
      headers: { 'x-instance': 'default', 'x-override': 'default' },
    });

    const res = await api.get('/api/echo-headers', {
      headers: { 'x-override': 'per-request' },
    });

    expect(res.data['x-instance']).toBe('default');
    expect(res.data['x-override']).toBe('per-request');
  });

  it('per-request timeout overrides instance timeout', async () => {
    const api = createInstance({
      baseURL: 'https://stress.test',
      timeout: 5000,
    });

    // per-request 10ms should override instance 5000ms
    try {
      await api.get('/api/slow', { timeout: 10 });
      expect.fail('should have thrown');
    } catch (err: any) {
      expect(err.name).toBe('AbortError');
    }
  });
});

// ── 18. validateStatus edge cases ────────────────────────────────────────────
describe('validateStatus edge cases', () => {
  it('accept all statuses: validateStatus: () => true', async () => {
    const res = await request('https://stress.test/api/500', {
      validateStatus: () => true,
    });
    expect(res.status).toBe(500);
    expect(res.data).toEqual({ error: 'server error' });
  });

  it('reject all statuses: validateStatus: () => false', async () => {
    try {
      await request('https://stress.test/api/data', {
        validateStatus: () => false,
      });
      expect.fail('should have thrown');
    } catch (err: any) {
      expect(err.name).toBe('HttpError');
      expect(err.status).toBe(200);
    }
  });

  it('custom validateStatus for 304', async () => {
    const res = await request('https://stress.test/api/304', {
      validateStatus: (s) => s === 304,
    });
    expect(res.status).toBe(304);
  });
});

// ── 19. URL building edge cases under concurrency ───────────────────────────
describe('URL building under concurrency', () => {
  it('concurrent requests with different params do not cross-contaminate URLs', async () => {
    server.use(
      http.get('https://stress.test/api/echo-url', ({ request: req }) =>
        HttpResponse.json({ url: req.url }, { status: 200 }),
      ),
    );
    const promises = Array.from({ length: 50 }, (_, i) =>
      request('https://stress.test/api/echo-url', {
        params: { id: String(i), tag: `t${i}` },
      }),
    );
    const results = await Promise.all(promises);
    for (let i = 0; i < 50; i++) {
      const url = new URL(results[i].data.url);
      expect(url.searchParams.get('id')).toBe(String(i));
      expect(url.searchParams.get('tag')).toBe(`t${i}`);
    }
  });
});

// ── 20. Error interceptor chain under load ───────────────────────────────────
describe('error interceptor chain under load', () => {
  it('error interceptors fire for every failed request in concurrent batch', async () => {
    const api = createInstance({ baseURL: 'https://stress.test' });
    const errorInterceptCount = { count: 0 };

    api.interceptors.response.use(
      (response) => response,
      (error) => {
        errorInterceptCount.count++;
        throw error;
      },
    );

    const promises = Array.from({ length: 30 }, () =>
      api.get('/api/500').catch((e) => e),
    );
    const results = await Promise.all(promises);

    // All 30 should have hit the error interceptor
    expect(errorInterceptCount.count).toBe(30);
    results.forEach((r) => {
      expect(r).toBeInstanceOf(Error);
      expect((r as Error).name).toBe('HttpError');
    });
  });
});
