import { describe, bench } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { get } from '../src';
import axios from 'axios';

const server = setupServer(
  http.get('https://api.example.com/users', () => {
    return HttpResponse.json([{ id: 1, name: 'Alice' }]);
  }),
);

server.listen({ onUnhandledRequest: 'bypass' });

describe('latency: kiattp vs axios vs native fetch', () => {
  bench('kiattp get()', async () => {
    await get('https://api.example.com/users');
  });

  bench('axios.get()', async () => {
    await axios.get('https://api.example.com/users');
  });

  bench('native fetch()', async () => {
    await fetch('https://api.example.com/users');
  });
});
