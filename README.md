# kiattp

A zero-dependency, fast, lightweight HTTP client library for Node.js and browsers.

## Features

- **Zero dependencies** — uses native `fetch` or `http`/`https`
- **Tree-shakeable** — import only what you need
- **Interceptor system** — request/response transformation
- **Plugin architecture** — retry, timeout, logging
- **Progress callbacks** — track upload and download progress
- **Binary responses** — blob, arraybuffer, and stream support
- **Axios compatible** — drop-in replacement via `kiattp/axios`
- **~2.4KB gzipped** — core bundle

## Installation

```bash
npm install kiattp
```

## Quick Start

```typescript
import { get, post, createInstance } from 'kiattp';

// Simple requests
const users = await get<User[]>('https://api.example.com/users');
const user = await post<User>('https://api.example.com/users', { body: { name: 'Alice' } });

// Instance with defaults
const api = createInstance({
  baseURL: 'https://api.example.com',
  headers: { Authorization: 'Bearer token' },
});

const data = await api.get<User[]>('/users');
```

## Base URL Merging

When using `baseURL` with relative paths, the library handles edge cases automatically:

```typescript
const api = createInstance({ baseURL: 'https://api.example.com/api/v1/' });

// Trailing slash is handled: https://api.example.com/api/v1/users
await api.get('users');

// Leading slash on relative path is handled: https://api.example.com/api/v1/users
await api.get('/users');

// Absolute URLs override baseURL entirely: https://other.com/endpoint
await api.get('https://other.com/endpoint');
```

## Header Deep Merging

Instance-level headers are preserved and merged with call-time headers (call-time wins on conflict):

```typescript
const api = createInstance({
  headers: { 'x-api-key': 'secret', 'x-version': '1.0' },
});

// Sends both x-api-key and x-request-id
await api.get('/users', { headers: { 'x-request-id': 'abc' } });
```

## Request Body Types

The `body` option supports multiple types with automatic serialization:

| Type | Behavior |
|------|----------|
| `string` | Sent as-is |
| `FormData` | Sent as multipart (no Content-Type set; browser sets boundary) |
| `URLSearchParams` | Sent as `application/x-www-form-urlencoded` |
| `Blob` / `ArrayBuffer` / `ArrayBufferView` | Sent as binary |
| `ReadableStream` | Sent as streaming body |
| Plain objects / arrays | Serialized as JSON with `application/json` header |

```typescript
// FormData upload
const fd = new FormData();
fd.append('file', fileInput.files[0]);
await post('/upload', { body: fd });

// Binary data
const buffer = new ArrayBuffer(1024);
await post('/binary', { body: buffer });
```

## Axios Compatibility

```typescript
import { axios } from 'kiattp/axios';

// Axios-style API
const res = await axios.get('https://api.example.com/users');
const user = await axios.post('https://api.example.com/users', { name: 'Alice' });

// Create instance with defaults
const api = axios.create({ baseURL: 'https://api.example.com' });

// Request cancellation with CancelToken
const source = axios.CancelToken.source();
axios.get('/slow-request', { cancelToken: source.token });
source.cancel('Operation cancelled');

// Check for cancellation
try {
  await api.get('/data');
} catch (err) {
  if (axios.isCancel(err)) {
    console.log('Request cancelled:', err.message);
  }
}

// Type guard for axios errors
if (axios.isAxiosError(err)) {
  console.log(err.status, err.response?.data);
}

// Helpers
const [users, posts] = await axios.all([
  axios.get('/users'),
  axios.get('/posts'),
]);
```

| Method | Signature |
|--------|-----------|
| `axios.get(url, config?)` | Standard GET |
| `axios.post(url, data?, config?)` | POST with data body |
| `axios.put(url, data?, config?)` | PUT with data body |
| `axios.patch(url, data?, config?)` | PATCH with data body |
| `axios.delete(url, config?)` | Standard DELETE |
| `axios.head(url, config?)` | Standard HEAD |
| `axios.options(url, config?)` | Standard OPTIONS |
| `axios.request(url, config?)` | Generic request |
| `axios.create(defaults?)` | New instance |
| `axios.all(promises)` | `Promise.all` alias |
| `axios.spread(callback)` | Spread array args to callback |
| `axios.isCancel(err)` | Check if error is cancellation |
| `axios.isAxiosError(err)` | Type guard for HTTP errors |

> **Note:** In axios-style methods (`post`, `put`, `patch`), the `data` parameter is mapped to the `body` config option internally.

## Progress Tracking

Track upload and download progress with callbacks:

```typescript
import { post } from 'kiattp';

const fd = new FormData();
fd.append('file', largeFile);

await post('/upload', {
  body: fd,
  onUploadProgress: ({ loaded, total, bytes }) => {
    const pct = total ? Math.round((loaded / total) * 100) : '?';
    console.log(`Upload: ${pct}% (${loaded}/${total} bytes)`);
  },
  onDownloadProgress: ({ loaded, total, bytes }) => {
    console.log(`Downloaded ${bytes} bytes (${loaded}/${total})`);
  },
});
```

The `ProgressEvent` object contains:
- `loaded` — total bytes transferred so far
- `total` — total size (if available from `Content-Length` header)
- `bytes` — bytes in the latest chunk

## Binary Response Types

Download files and binary data with the `responseType` option:

```typescript
import { get } from 'kiattp';

// Download as Blob (browser)
const blob = await get<Blob>('/file.pdf', { responseType: 'blob' });

// Download as ArrayBuffer
const buffer = await get<ArrayBuffer>('/data.bin', { responseType: 'arraybuffer' });

// Stream response (advanced, Node.js)
const stream = await get<ReadableStream>('/large-file', { responseType: 'stream' });

// Plain text
const text = await get<string>('/readme.txt', { responseType: 'text' });
```

## Interceptors

Transform requests and responses globally:

```typescript
const api = createInstance({ baseURL: 'https://api.example.com' });

// Request interceptor — add auth header
api.interceptors.request.use((config) => {
  config.headers['authorization'] = 'Bearer ' + getToken();
  return config;
});

// Response interceptor — unwrap data
api.interceptors.response.use((response) => {
  console.log(`${response.status} ${response.config.url}`);
  return response;
});
```

> **Note:** Plugin `onError` hooks are not yet functional. A warning is emitted if a plugin provides `onError`.

## Error Handling

Failed requests throw an `HttpError` with response details:

```typescript
import { get } from 'kiattp';

try {
  const res = await get('/users');
} catch (err) {
  if (err.isAxiosError) {
    console.error(`HTTP ${err.status}: ${err.statusText}`);
    console.error(err.response?.data); // Response body
    console.error(err.config.url);     // Request URL
  }
}
```

Customize which status codes are considered errors:

```typescript
await get('/maybe-found', {
  validateStatus: (status) => status < 500, // Only 5xx are errors
});
```

## Plugins

The library ships with built-in plugins. Import them from the main entry point:

```typescript
import { createInstance, retry_plugin, logger_plugin, timeout_plugin } from 'kiattp';

const api = createInstance({ baseURL: 'https://api.example.com' });

// Retry with exponential backoff
api.use(retry_plugin({ maxRetries: 3, backoff: 'exponential' }));

// Request/response logging
api.use(logger_plugin({ level: 'info' }));

// Default timeout
api.use(timeout_plugin({ timeout: 10000 }));
```

### Retry Plugin

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxRetries` | `number` | `3` | Maximum retry attempts |
| `backoff` | `'fixed' \| 'exponential' \| 'linear'` | `'exponential'` | Delay strategy |
| `retryOn` | `number[]` | `[429, 500, 502, 503, 504]` | Status codes to retry |
| `retryOnNetworkError` | `boolean` | `true` | Retry on network failures |

### Logger Plugin

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `level` | `'error' \| 'warn' \| 'info' \| 'debug'` | `'info'` | Minimum log level |
| `format` | `'text' \| 'json'` | `'text'` | Output format |

### Timeout Plugin

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `timeout` | `number` | — | Timeout in ms (only sets if not already configured) |

## API

### Core exports

| Function | Description |
|----------|-------------|
| `get(url, config?)` | GET request |
| `post(url, config?)` | POST request |
| `put(url, config?)` | PUT request |
| `patch(url, config?)` | PATCH request |
| `del(url, config?)` | DELETE request |
| `head(url, config?)` | HEAD request |
| `options(url, config?)` | OPTIONS request |
| `request(url, config?)` | Generic request |
| `createInstance(defaults?)` | Create scoped client |
| `use(plugin)` | Register global plugin |

### Config

| Option | Type | Description |
|--------|------|-------------|
| `baseURL` | `string` | Base URL for relative paths |
| `params` | `Record<string, string \| number \| boolean \| null \| undefined>` | Query parameters (null/undefined skipped) |
| `headers` | `Record<string, string>` | Request headers (deep-merged with instance defaults) |
| `body` | `BodyType` | Request body — `string \| FormData \| URLSearchParams \| Blob \| ArrayBuffer \| ArrayBufferView \| ReadableStream \| object \| array` |
| `timeout` | `number` | Timeout in milliseconds |
| `signal` | `AbortSignal` | Cancellation signal |
| `responseType` | `'json' \| 'text' \| 'blob' \| 'arraybuffer' \| 'stream'` | Response parsing method |
| `validateStatus` | `(status: number) => boolean` | Status validation (default: 200–299) |
| `onUploadProgress` | `(event: ProgressEvent) => void` | Upload progress callback |
| `onDownloadProgress` | `(event: ProgressEvent) => void` | Download progress callback |
| `maxRedirects` | `number` | Maximum redirects to follow |
| `proxy` | `ProxyConfig` | Proxy configuration (`host`, `port`, `protocol?`, `auth?`) |

### Response

```typescript
interface Response<T> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  config: Config;
}
```

### Types

| Type | Description |
|------|-------------|
| `BodyType` | Union of supported request body types: `string \| FormData \| URLSearchParams \| Blob \| ArrayBuffer \| ArrayBufferView \| ReadableStream \| object \| array` |
| `ProgressEvent` | Progress callback payload: `{ loaded: number, total?: number, bytes: number }` |
| `ProgressCallback` | Function signature: `(event: ProgressEvent) => void` |
| `HttpError` | Error type with `status`, `statusText`, `response`, `config`, `isAxiosError` |
| `Plugin` | Plugin interface: `{ name, onRequest?, onResponse?, onError? }` |

## Custom Plugins

Implement the `Plugin` interface to create custom middleware:

```typescript
import { createInstance, type Plugin, type Config } from 'kiattp';

const timingPlugin: Plugin = {
  name: 'timing',
  onRequest: async (config: Config) => {
    (config as any)._startTime = Date.now();
    return config;
  },
  onResponse: async (response) => {
    const start = (response.config as any)._startTime;
    if (start) {
      console.log(`${response.config.url} took ${Date.now() - start}ms`);
    }
    return response;
  },
};

const api = createInstance();
api.use(timingPlugin);
```

## License

MIT
