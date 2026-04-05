import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { createInstance } from '../../src/instance';
import { retry_plugin } from '../../src/plugins/retry';
import { logger_plugin } from '../../src/plugins/logger';

const server = setupServer(
  http.get('https://api.example.com/flaky', () => {
    return HttpResponse.json({ error: 'retry' }, { status: 500 });
  }),
  http.get('https://api.example.com/users', () => {
    return HttpResponse.json([{ id: 1, name: 'Alice' }]);
  }),
);

beforeAll(() => server.listen());
afterAll(() => server.close());

describe('retry plugin', () => {
  it('respects maxRetries limit', async () => {
    const api = createInstance({ baseURL: 'https://api.example.com' });
    api.use(retry_plugin({
      maxRetries: 1,
      backoff: 'fixed',
      retryOn: [500],
      retryOnNetworkError: false,
    }));

    await expect(api.get('/flaky')).rejects.toMatchObject({ status: 500 });
  });
});

describe('logger plugin', () => {
  it('logs request info at debug level', async () => {
    const logs: string[] = [];
    const api = createInstance({ baseURL: 'https://api.example.com' });
    api.use(logger_plugin({
      level: 'debug',
      format: (config, response) => `[${config.method}] ${config.url} → ${response?.status}`,
      output: (msg) => logs.push(msg),
    }));

    await api.get('/users');
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0]).toContain('[GET]');
  });
});
