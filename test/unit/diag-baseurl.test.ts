import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { axios } from '../../src/axios';

let capturedUrl = '';

const server = setupServer(
  http.all('*', ({ request: req }) => {
    capturedUrl = req.url;
    return HttpResponse.json({ token: 'abc' });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterAll(() => server.close());

describe('baseURL diagnostic', () => {
  it('axios.create({ baseURL: /api }) - request URL with leading slash', async () => {
    capturedUrl = '';
    const client = axios.create({ baseURL: '/api' });
    try {
      await client.post('/auth/login', { email: 'test@test.com', password: 'test' });
      console.log('Request succeeded, URL:', capturedUrl);
    } catch (e: any) {
      console.log('Request error:', e.message, e.name);
      console.log('Captured URL:', capturedUrl);
    }
    // This test is for diagnostics only
    expect(true).toBe(true);
  });
});
