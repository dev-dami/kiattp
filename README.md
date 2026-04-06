# kiattp

<div align="center">

[![npm version](https://img.shields.io/npm/v/kiattp.svg?color=007EC6)](https://www.npmjs.com/package/kiattp)
[![bundle size](https://img.shields.io/bundlephobia/minzip/kiattp?color=58A6FF)](https://bundlephobia.com/package/kiattp)
[![CI](https://github.com/dev-dami/kiattp/actions/workflows/ci.yml/badge.svg)](https://github.com/dev-dami/kiattp/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/kiattp?color=green)](LICENSE)
[![node](https://img.shields.io/node/v/kiattp)](https://nodejs.org)
[![downloads](https://img.shields.io/npm/dm/kiattp)](https://www.npmjs.com/package/kiattp)

</div>

> **A zero-dependency, fast, lightweight HTTP client.** 4× faster than Axios, ~3.7KB gzipped, zero dependencies.

```bash
npm install kiattp
```

No postinstall scripts · No dependency tree to audit · Zero runtime deps

-----

## Quick Start

```typescript
import { get, post, createInstance } from 'kiattp';

const users = await get<User[]>('https://api.example.com/users');
const user = await post<User>('https://api.example.com/users', { body: { name: 'Alice' } });

const api = createInstance({
  baseURL: 'https://api.example.com',
  headers: { Authorization: 'Bearer token' },
});

const data = await api.get<User[]>('/users');
```

## Axios Compatibility

Drop-in replacement via `kiattp/axios` — no code changes required:

```typescript
import { axios } from 'kiattp/axios';

const res = await axios.get('https://api.example.com/users');
const api = axios.create({ baseURL: 'https://api.example.com' });

// CancelToken, isCancel, isAxiosError, all, spread — all supported
const source = axios.CancelToken.source();
axios.get('/slow', { cancelToken: source.token });
source.cancel('Cancelled');
```

See [full Axios compat reference](#axios-compat-reference) below.

## Subpath Exports

Import only what you need to keep your bundle minimal:

```typescript
// Node.js http adapter (no fetch)
import { httpAdapter } from 'kiattp/http';

// Individual plugins
import { retry_plugin } from 'kiattp/plugins/retry';
import { logger_plugin } from 'kiattp/plugins/logger';
import { timeout_plugin } from 'kiattp/plugins/timeout';

// Full entry (re-exports everything)
import { get, createInstance } from 'kiattp';

// Axios compatibility layer
import { axios } from 'kiattp/axios';
```

## Plugins

```typescript
import { createInstance, retry_plugin, logger_plugin, timeout_plugin } from 'kiattp';

const api = createInstance({ baseURL: 'https://api.example.com' });

api.use(retry_plugin({ maxRetries: 3, backoff: 'exponential', jitter: true }));
api.use(logger_plugin({ level: 'info' }));
api.use(timeout_plugin({ timeout: 10_000 }));
```

## Interceptors

```typescript
// Request interceptors
api.interceptors.request.use((config) => {
  config.headers['authorization'] = 'Bearer ' + getToken();
  return config;
});

// Response interceptors
api.interceptors.response.use((res) => {
  console.log(`${res.status} ${res.config.url}`);
  return res;
});

// Error interceptors
api.interceptors.response.use(
  (res) => res,
  (error) => {
    console.error(`Request failed: ${error.message}`);
    return error;
  },
);
```

## Transforms

```typescript
// Transform request before serialization
api.interceptors.request.use((config) => {
  config.headers['x-request-id'] = crypto.randomUUID();
  return config;
});

// Transform response after parsing
api.interceptors.response.use((res) => {
  res.data = sanitize(res.data);
  return res;
});
```

## Progress & Binary

```typescript
// Upload progress
await post('/upload', {
  body: formData,
  onUploadProgress: ({ loaded, total }) => console.log(`${loaded}/${total}`),
});

// Download progress
await get('/file.pdf', {
  responseType: 'blob',
  onDownloadProgress: ({ loaded, total }) => console.log(`${loaded}/${total}`),
});

// Binary responses
const blob   = await get<Blob>('/file.pdf',   { responseType: 'blob' });
const buffer = await get<ArrayBuffer>('/data', { responseType: 'arraybuffer' });
const stream = await get<ReadableStream>('/large', { responseType: 'stream' });
```

## Error Handling

```typescript
try {
  await get('/users');
} catch (err) {
  if (err.isAxiosError) {
    console.error(`HTTP ${err.status}: ${err.statusText}`);
    console.error(err.response?.data);
  }
}

// Custom status validation
await get('/maybe-found', { validateStatus: (s) => s < 500 });
```

## Per-Instance Adapter

```typescript
// Force Node.js http adapter (supports proxy, maxRedirects)
const api = createInstance({ adapter: 'http' });

// Force fetch adapter
const browser = createInstance({ adapter: 'fetch' });
```

-----

## API Reference

### Methods

|Function                   |Description                       |
|---------------------------|----------------------------------|
|`get(url, config?)`        |GET request                       |
|`post(url, config?)`       |POST request                      |
|`put(url, config?)`        |PUT request                       |
|`patch(url, config?)`      |PATCH request                     |
|`del(url, config?)`        |DELETE request                    |
|`head / options / request` |Standard HTTP methods             |
|`createInstance(defaults?)`|Scoped client with preset defaults|

### Config

|Option              |Type                                                                                |Description                                                                 |
|--------------------|------------------------------------------------------------------------------------|----------------------------------------------------------------------------|
|`baseURL`           |`string`                                                                            |Prepended to relative paths. Trailing/leading slashes handled automatically.|
|`params`            |`Record<string, string | number | boolean | null | undefined>`                      |Query params — null/undefined skipped                                       |
|`paramsSerializer`  |`(params: Record<string, unknown>) => string`                                       |Custom query string builder                                                 |
|`headers`           |`Record<string, string>`                                                            |Deep-merged with instance defaults; call-time wins                          |
|`body`              |`string | FormData | URLSearchParams | Blob | ArrayBuffer | ReadableStream | object`|Auto-serialized                                                             |
|`timeout`           |`number`                                                                            |Milliseconds                                                                |
|`signal`            |`AbortSignal`                                                                       |Cancellation                                                                |
|`responseType`      |`'json' | 'text' | 'blob' | 'arraybuffer' | 'stream'`                               |Default: `json`                                                             |
|`validateStatus`    |`(status: number) => boolean`                                                       |Default: 200–299                                                            |
|`adapter`           |`'fetch' | 'http'`                                                                  |Force a specific transport; defaults to `fetch` when available              |
|`credentials`       |`RequestCredentials`                                                                |Browser only — `include`, `same-origin`, `omit`                             |
|`maxContentLength`  |`number`                                                                            |Reject responses larger than this (bytes)                                   |
|`decompress`        |`boolean`                                                                           |Auto-decompress gzip/deflate/br (Node.js http adapter)                      |
|`xsrfCookieName`    |`string`                                                                            |CSRF cookie name for XSRF header injection (browser only)                   |
|`xsrfHeaderName`    |`string`                                                                            |CSRF header name (default: `X-XSRF-TOKEN`)                                  |
|`transformRequest`  |`TransformFn[]`                                                                     |Functions run before body serialization                                     |
|`transformResponse` |`TransformFn[]`                                                                     |Functions run after response parsing                                        |
|`onUploadProgress`  |`(e: ProgressEvent) => void`                                                        |`{ loaded, total?, bytes }`                                                 |
|`onDownloadProgress`|`(e: ProgressEvent) => void`                                                        |`{ loaded, total?, bytes }`                                                 |
|`maxRedirects`      |`number`                                                                            |Node.js http adapter only                                                   |
|`proxy`             |`ProxyConfig`                                                                       |`{ host, port, protocol?, auth? }` — http adapter only                      |

### Response Shape

```typescript
interface Response<T> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  config: Config;
}
```

-----

## Axios Compat Reference

|Method                                                |Notes                               |
|------------------------------------------------------|------------------------------------|
|`axios.get/post/put/patch/delete/head/options/request`|Full parity                         |
|`axios.create(defaults?)`                             |Maps to `createInstance`            |
|`axios.all(promises)`                                 |`Promise.all` alias                 |
|`axios.spread(fn)`                                    |Spread array args to callback       |
|`axios.CancelToken.source()`                          |Maps to `AbortController` internally|
|`axios.isCancel(err)`                                 |Cancellation type guard             |
|`axios.isAxiosError(err)`                             |HTTP error type guard               |

-----

## Benchmarks

See [BENCHMARK.md](./BENCHMARK.md) — MSW mock server, Node.js 18+.

|            |ops/sec|Mean   |p99    |Size (gzipped)|
|------------|-------|-------|-------|--------------|
|**kiattp**  |~4,000 |0.25ms |0.80ms |~3.7KB        |
|**axios**   |~940   |1.07ms |4.83ms |~14KB         |
|native fetch|~6,100 |0.16ms |0.32ms |0KB           |

- kiattp is **~4× faster than Axios** and **~1.5× slower than native fetch**
- The ~0.09ms overhead vs fetch pays for config normalization, interceptors, and error handling

-----

## License

MIT