# kiattp

> The Axios replacement. 4.1x faster, ~3KB minified, zero dependencies.

```bash
npm install kiattp
```

No postinstall scripts. No dependency tree to poison.

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

## Plugins

```typescript
import { createInstance, retry_plugin, logger_plugin, timeout_plugin } from 'kiattp';

const api = createInstance({ baseURL: 'https://api.example.com' });

api.use(retry_plugin({ maxRetries: 3, backoff: 'exponential' }));
api.use(logger_plugin({ level: 'info', format: 'json' }));
api.use(timeout_plugin({ timeout: 10_000 }));
```

Custom plugins implement `{ name, onRequest?, onResponse?, onError? }`.

## Interceptors

```typescript
api.interceptors.request.use((config) => {
  config.headers['authorization'] = 'Bearer ' + getToken();
  return config;
});

api.interceptors.response.use((res) => {
  console.log(`${res.status} ${res.config.url}`);
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
|`headers`           |`Record<string, string>`                                                            |Deep-merged with instance defaults; call-time wins                          |
|`body`              |`string | FormData | URLSearchParams | Blob | ArrayBuffer | ReadableStream | object`|Auto-serialized                                                             |
|`timeout`           |`number`                                                                            |Milliseconds                                                                |
|`signal`            |`AbortSignal`                                                                       |Cancellation                                                                |
|`responseType`      |`'json' | 'text' | 'blob' | 'arraybuffer' | 'stream'`                               |Default: `json`                                                             |
|`validateStatus`    |`(status: number) => boolean`                                                       |Default: 200–299                                                            |
|`onUploadProgress`  |`(e: ProgressEvent) => void`                                                        |`{ loaded, total?, bytes }`                                                 |
|`onDownloadProgress`|`(e: ProgressEvent) => void`                                                        |`{ loaded, total?, bytes }`                                                 |
|`maxRedirects`      |`number`                                                                            |Node.js only                                                                |
|`proxy`             |`ProxyConfig`                                                                       |`{ host, port, protocol?, auth? }`                                          |

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

See [BENCHMARK.md](./BENCHMARK.md) — 1000+ iterations, MSW mock server, Node.js 18.

|            |Size |Mean   |p99    |
|------------|-----|-------|-------|
|**kiattp**  |~3KB |0.257ms|0.898ms|
|**axios**   |~14KB|1.067ms|4.834ms|
|native fetch|0KB  |0.175ms|0.322ms|

-----

## License

MIT