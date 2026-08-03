import * as http from 'node:http';
import { DevtoolsTUI } from '../src/plugins/devtools.js';

const PORT = 3456;

// Create zero-dependency TUI controller
const tui = new DevtoolsTUI(`KIATTP DEVTOOLS SERVER (http://localhost:${PORT})`, true);
tui.start();

let reqId = 0;

// Create HTTP server listening on http://localhost:3456
const server = http.createServer((req, res) => {
  const method = (req.method ?? 'GET').toUpperCase();
  const url = req.url ?? '/';
  const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const id = ++reqId;

  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
  });

  req.on('end', () => {
    // Collect request headers from curl
    const requestHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.headers)) {
      if (typeof v === 'string') requestHeaders[k] = v;
      else if (Array.isArray(v)) requestHeaders[k] = v.join(', ');
    }

    let status = 200;
    let statusText = 'OK';
    let responseData: unknown = {};

    // Endpoints for curl commands
    if (method === 'GET' && url === '/api/users') {
      status = 200;
      responseData = [
        { id: 1, name: 'Alice Smith', email: 'alice@example.com', role: 'admin' },
        { id: 2, name: 'Bob Jones', email: 'bob@example.com', role: 'developer' },
      ];
    } else if (method === 'POST' && url === '/api/orders') {
      status = 201;
      statusText = 'Created';
      let parsed = {};
      try {
        parsed = JSON.parse(body);
      } catch {
        parsed = { raw: body };
      }
      responseData = { id: 'ord_9982', status: 'created', payload: parsed };
    } else if (method === 'DELETE' && url === '/api/users/1') {
      status = 200;
      responseData = { deleted: true, userId: 1 };
    } else if (url === '/api/error-500') {
      status = 500;
      statusText = 'Internal Server Error';
      responseData = { error: 'Internal Database Timeout', code: 'DB_ERR' };
    } else {
      status = 404;
      statusText = 'Not Found';
      responseData = { error: 'Endpoint Not Found', path: url };
    }

    const resBodyStr = JSON.stringify(responseData, null, 2);
    const endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const duration = Math.round(endTime - startTime);

    const responseHeaders: Record<string, string> = {
      'content-type': 'application/json',
      'x-powered-by': 'kiattp-devtools-server',
      'content-length': String(Buffer.byteLength(resBodyStr)),
    };

    let parsedReqBody: unknown = undefined;
    if (body) {
      try {
        parsedReqBody = JSON.parse(body);
      } catch {
        parsedReqBody = body;
      }
    }

    // Update TUI immediately with incoming curl request
    tui.addRequest({
      id,
      method,
      url,
      startTime,
      endTime,
      duration,
      status,
      statusText,
      sizeBytes: Buffer.byteLength(resBodyStr),
      requestHeaders,
      requestBody: parsedReqBody,
      responseHeaders,
      responseBody: responseData,
      error: status >= 400 ? `HTTP ${status} ${statusText}` : undefined,
    });

    res.writeHead(status, responseHeaders);
    res.end(resBodyStr);
  });
});

server.listen(PORT);

process.on('SIGINT', () => {
  server.close();
  tui.stop();
  process.exit(0);
});
