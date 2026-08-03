import * as http from 'node:http';

export const PORT = 3456;

export function startMockServer(): Promise<http.Server> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = req.url ?? '/';
      const method = req.method ?? 'GET';

      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });

      req.on('end', () => {
        // Set standard response headers
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('X-Powered-By', 'kiattp-mock-server');
        res.setHeader('X-Request-ID', `req_${Math.random().toString(36).slice(2, 9)}`);
        res.setHeader('Cache-Control', 'no-cache');

        // Route handling
        if (method === 'GET' && url === '/api/users') {
          res.writeHead(200);
          res.end(
            JSON.stringify([
              { id: 1, name: 'Alice Smith', email: 'alice@example.com', role: 'admin' },
              { id: 2, name: 'Bob Jones', email: 'bob@example.com', role: 'developer' },
            ]),
          );
          return;
        }

        if (method === 'GET' && url === '/api/users/1') {
          res.writeHead(200);
          res.end(JSON.stringify({ id: 1, name: 'Alice Smith', email: 'alice@example.com', role: 'admin' }));
          return;
        }

        if (method === 'POST' && url === '/api/orders') {
          let parsedBody = {};
          try {
            parsedBody = JSON.parse(body);
          } catch {
            parsedBody = { raw: body };
          }
          res.writeHead(201);
          res.end(
            JSON.stringify({
              orderId: 'ord_88291',
              status: 'created',
              createdAt: new Date().toISOString(),
              payload: parsedBody,
            }),
          );
          return;
        }

        if (method === 'PUT' && url === '/api/users/1') {
          res.writeHead(200);
          res.end(JSON.stringify({ id: 1, name: 'Alice Updated', email: 'alice@example.com', updated: true }));
          return;
        }

        if (method === 'DELETE' && url === '/api/users/2') {
          res.writeHead(200);
          res.end(JSON.stringify({ deleted: true, userId: 2 }));
          return;
        }

        if (url === '/api/slow-endpoint') {
          setTimeout(() => {
            res.writeHead(200);
            res.end(JSON.stringify({ message: 'Delayed response completed', latencyMs: 300 }));
          }, 300);
          return;
        }

        if (url === '/api/error-500') {
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Internal Server Error', code: 'DB_CONN_TIMEOUT' }));
          return;
        }

        // 404 Not Found fallback
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Endpoint Not Found', path: url }));
      });
    });

    server.listen(PORT, () => {
      resolve(server);
    });
  });
}

// Allow direct execution
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(`Mock server starting on http://localhost:${PORT}...`);
  await startMockServer();
  console.log(`Mock server running on http://localhost:${PORT}`);
}
