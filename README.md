# kiattp

A zero-dependency, fast, lightweight HTTP client library for Node.js and browsers.

## Features

- **Zero dependencies** — uses native `fetch` or `http`/`https`
- **Tree-shakeable** — import only what you need
- **Interceptor system** — request/response transformation
- **Plugin architecture** — retry, timeout, logging
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
const users = await get('https://api.example.com/users');
const user = await post('https://api.example.com/users', { body: { name: 'Alice' } });

// Instance with defaults
const api = createInstance({
  baseURL: 'https://api.example.com',
  headers: { Authorization: 'Bearer token' },
});

const data = await api.get('/users');
```

## Axios Compatibility

```typescript
import { axios } from 'kiattp/axios';

const res = await axios.get('https://api.example.com/users');
const api = axios.create({ baseURL: 'https://api.example.com' });
```

## Plugins

```typescript
import { createInstance } from 'kiattp';
import { retry_plugin } from 'kiattp/plugins/retry';

const api = createInstance({ baseURL: 'https://api.example.com' });
api.use(retry_plugin({ maxRetries: 3, backoff: 'exponential' }));
```

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
| `params` | `Record<string, string \| number \| boolean>` | Query parameters |
| `headers` | `Record<string, string>` | Request headers |
| `body` | `unknown` | Request body |
| `timeout` | `number` | Timeout in milliseconds |
| `signal` | `AbortSignal` | Cancellation signal |
| `responseType` | `'json' \| 'text'` | Response parsing |
| `validateStatus` | `(status: number) => boolean` | Status validation |

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

## License

MIT
