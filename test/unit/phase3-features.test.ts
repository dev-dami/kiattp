import { describe, it, expect, afterEach } from 'vitest';
import { request, createInstance, MemoryCookieJar } from '../../src';

describe('Phase 3 Advanced Features', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('1. Custom adapter functions', async () => {
    let capturedConfig: any;
    const customAdapter = async (config: any) => {
      capturedConfig = config;
      return {
        status: 200,
        statusText: 'OK',
        headers: { 'x-custom-adapter': 'true' },
        body: JSON.stringify({ message: 'from custom adapter' }),
      };
    };

    const res = await request<{ message: string }>('https://custom.test/api', {
      adapter: customAdapter,
    });

    expect(capturedConfig.url).toBe('https://custom.test/api');
    expect(res.status).toBe(200);
    expect(res.headers['x-custom-adapter']).toBe('true');
    expect(res.data.message).toBe('from custom adapter');
  });

  it('2. Shortcut auth object (Basic Auth)', async () => {
    let authHeader = '';

    globalThis.fetch = (async (url: string | URL | Request, init?: any) => {
      authHeader = init?.headers?.authorization || init?.headers?.Authorization || '';
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as typeof fetch;

    await request('https://api.test/protected', {
      auth: { username: 'admin', password: 'secretpassword' },
    });

    const expectedEncoded = Buffer.from('admin:secretpassword').toString('base64');
    expect(authHeader).toBe(`Basic ${expectedEncoded}`);
  });

  it('3. CookieJar persistence', async () => {
    const jar = new MemoryCookieJar();

    globalThis.fetch = (async (url: string | URL | Request, init?: any) => {
      const sentCookies = init?.headers?.cookie || '';
      if (String(url).includes('/login')) {
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'set-cookie': 'session_id=abc123xyz; Path=/; Domain=api.test' },
        });
      }
      return new Response(JSON.stringify({ echoedCookies: sentCookies }), { status: 200 });
    }) as typeof fetch;

    const instance = createInstance({ jar });

    // Step 1: Login receives Set-Cookie
    await instance.post('https://api.test/login');
    expect(jar.getCookieString('https://api.test/profile')).toBe('session_id=abc123xyz');

    // Step 2: Next request automatically sends Cookie header
    const profileRes = await instance.get<any>('https://api.test/profile');
    expect(profileRes.data.echoedCookies).toBe('session_id=abc123xyz');
  });

  it('4. Preset paramSerializer styles (repeat, brackets, indices, comma)', async () => {
    let capturedUrl = '';

    globalThis.fetch = (async (url: string | URL | Request) => {
      capturedUrl = String(url);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as typeof fetch;

    const params = { ids: [10, 20], tag: 'active' };

    // repeat
    await request('https://api.test/items', { params, paramsSerializer: 'repeat' });
    expect(capturedUrl).toBe('https://api.test/items?ids=10&ids=20&tag=active');

    // brackets
    await request('https://api.test/items', { params, paramsSerializer: 'brackets' });
    expect(capturedUrl).toBe('https://api.test/items?ids%5B%5D=10&ids%5B%5D=20&tag=active');

    // indices
    await request('https://api.test/items', { params, paramsSerializer: 'indices' });
    expect(capturedUrl).toBe('https://api.test/items?ids%5B0%5D=10&ids%5B1%5D=20&tag=active');

    // comma
    await request('https://api.test/items', { params, paramsSerializer: 'comma' });
    expect(capturedUrl).toBe('https://api.test/items?ids=10%2C20&tag=active');
  });

  it('5. HTTP Retry-After header parsing in retries', async () => {
    let attempts = 0;
    const timestamps: number[] = [];

    globalThis.fetch = (async () => {
      attempts++;
      timestamps.push(Date.now());
      if (attempts === 1) {
        return new Response('Rate limited', {
          status: 429,
          headers: { 'Retry-After': '0.1' }, // 100ms
        });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as typeof fetch;

    const { retry_plugin } = await import('../../src/plugins/retry');
    const instance = createInstance();
    instance.use(retry_plugin({ maxRetries: 2 }));

    const res = await instance.get('https://api.test/rate-limited');
    expect(res.status).toBe(200);
    expect(attempts).toBe(2);
    const gap = timestamps[1] - timestamps[0];
    expect(gap).toBeGreaterThanOrEqual(80); // ~100ms delay from Retry-After
  });
});
