import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { request } from '../../src/core/request';

const server = setupServer(
  http.get('https://api.example.com/users', () => {
    return HttpResponse.json([{ id: 1, name: 'Alice' }]);
  }),
  http.post('https://api.example.com/users', async ({ request: req }) => {
    const body = await req.json();
    return HttpResponse.json({ id: 2, ...body }, { status: 201 });
  }),
  http.get('https://api.example.com/text', () => {
    return HttpResponse.text('hello world');
  }),
  http.get('https://api.example.com/empty', () => {
    return new HttpResponse(null, { status: 204 });
  }),
  http.get('https://api.example.com/error', () => {
    return HttpResponse.json({ error: 'not found' }, { status: 404 });
  }),
);

beforeAll(() => server.listen());
afterAll(() => server.close());

describe('request', () => {
  it('performs a GET request and parses JSON', async () => {
    const res = await request('https://api.example.com/users');
    expect(res.status).toBe(200);
    expect(res.data).toEqual([{ id: 1, name: 'Alice' }]);
  });

  it('performs a POST request with JSON body', async () => {
    const res = await request('https://api.example.com/users', {
      method: 'POST',
      body: { name: 'Bob' },
    });
    expect(res.status).toBe(201);
    expect(res.data).toEqual({ id: 2, name: 'Bob' });
  });

  it('returns text for non-JSON responses', async () => {
    const res = await request('https://api.example.com/text');
    expect(res.data).toBe('hello world');
  });

  it('returns null for 204 No Content', async () => {
    const res = await request('https://api.example.com/empty');
    expect(res.status).toBe(204);
    expect(res.data).toBeNull();
  });

  it('throws HttpError on 4xx responses', async () => {
    await expect(request('https://api.example.com/error')).rejects.toMatchObject({
      name: 'HttpError',
      status: 404,
    });
  });

  it('includes response body in HttpError', async () => {
    try {
      await request('https://api.example.com/error');
      expect.fail('should have thrown');
    } catch (err: any) {
      expect(err.response.data).toEqual({ error: 'not found' });
    }
  });
});
