import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { axios } from '../../src/axios';

const server = setupServer(
  http.get('https://api.example.com/users', () => {
    return HttpResponse.json([{ id: 1 }]);
  }),
  http.post('https://api.example.com/users', async ({ request: req }) => {
    const body = await req.json();
    return HttpResponse.json({ id: 2, ...body }, { status: 201 });
  }),
  http.get('https://api.example.com/slow', async () => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return HttpResponse.json([{ id: 1 }]);
  }),
);

beforeAll(() => server.listen());
afterAll(() => server.close());

describe('axios compatibility', () => {
  it('axios.get() works like axios', async () => {
    const res = await axios.get('https://api.example.com/users');
    expect(res.data).toEqual([{ id: 1 }]);
    expect(res.status).toBe(200);
  });

  it('axios.post() with data works like axios', async () => {
    const res = await axios.post('https://api.example.com/users', { name: 'Bob' });
    expect(res.status).toBe(201);
    expect(res.data).toEqual({ id: 2, name: 'Bob' });
  });

  it('axios.create() returns an instance with baseURL', async () => {
    const api = axios.create({ baseURL: 'https://api.example.com' });
    const res = await api.get('/users');
    expect(res.data).toEqual([{ id: 1 }]);
  });

  it('isAxiosError returns true for axios errors', async () => {
    try {
      await axios.get('https://api.example.com/notfound');
    } catch (err: any) {
      expect(axios.isAxiosError(err)).toBe(true);
    }
  });

  it('interceptors work on axios instance', async () => {
    const api = axios.create({ baseURL: 'https://api.example.com' });
    api.interceptors.request.use((config) => {
      config.headers!['X-Intercepted'] = 'true';
      return config;
    });

    const res = await api.get('/users');
    expect(res.config.headers).toHaveProperty('x-intercepted', 'true');
  });

  it('CancelToken works for cancellation', async () => {
    const source = axios.CancelToken.source();
    setTimeout(() => source.cancel('test cancel'), 10);

    await expect(
      axios.get('https://api.example.com/slow', { cancelToken: source.token }),
    ).rejects.toThrow('test cancel');
  });

  it('axios.all() works', async () => {
    const results = await axios.all([
      axios.get('https://api.example.com/users'),
      axios.get('https://api.example.com/users'),
    ]);
    expect(results).toHaveLength(2);
  });
});
