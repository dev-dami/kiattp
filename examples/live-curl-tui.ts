import * as http from 'node:http';
import { createInstance } from '../src/index.js';
import { devtools_plugin } from '../src/plugins/devtools.js';

const PROXY_PORT = 3456;
const TARGET_HOST = 'https://jsonplaceholder.typicode.com';

const api = createInstance({
  baseURL: TARGET_HOST,
});

// Enable DevTools TUI plugin
api.use(
  devtools_plugin({
    label: `KIATTP DEVTOOLS LIVE CURL GATEWAY (http://localhost:${PROXY_PORT})`,
    tui: true,
  }),
);

// Create gateway HTTP server that accepts curl commands and proxies them via kiattp
const server = http.createServer((req, res) => {
  const method = (req.method ?? 'GET').toUpperCase();
  const path = req.url ?? '/';

  let bodyStr = '';
  req.on('data', (chunk) => {
    bodyStr += chunk;
  });

  req.on('end', async () => {
    try {
      let parsedBody: unknown = bodyStr;
      if (bodyStr && req.headers['content-type']?.includes('application/json')) {
        try {
          parsedBody = JSON.parse(bodyStr);
        } catch {
          parsedBody = bodyStr;
        }
      }

      // Execute request through kiattp client (which triggers devtools TUI)
      const response = await api({
        url: path,
        method,
        body: bodyStr ? parsedBody : undefined,
        headers: {
          'user-agent': (req.headers['user-agent'] as string) || 'curl/7.88.1',
          'accept': (req.headers['accept'] as string) || '*/*',
          'content-type': (req.headers['content-type'] as string) || 'application/json',
        },
      });

      // Send response back to curl
      res.writeHead(response.status, {
        'Content-Type': 'application/json',
        'X-Proxied-By': 'kiattp-devtools-gateway',
      });
      res.end(typeof response.data === 'string' ? response.data : JSON.stringify(response.data, null, 2));
    } catch (error: any) {
      const status = error.status || 500;
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message || 'Request failed', path }));
    }
  });
});

server.listen(PROXY_PORT, () => {
  // Silent start: TUI handles the terminal screen
});
