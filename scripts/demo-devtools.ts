import { createInstance } from '../src/index.js';
import { devtools_plugin } from '../src/plugins/devtools.js';

const api = createInstance({
  baseURL: 'https://jsonplaceholder.typicode.com',
});

// Enable devtools with TUI mode if TUI flag passed, or ASCII table mode
const useTui = process.argv.includes('--tui');

api.use(
  devtools_plugin({
    label: 'KIATTP DEVTOOLS ASCII TUI',
    tui: useTui,
  }),
);

if (!useTui) {
  console.log('\n[START] Executing HTTP requests...\n');
}

try {
  await Promise.all([
    api.get('/posts/1'),
    api.get('/users/1'),
    api.get('/todos/1'),
    api.post('/posts', { body: { title: 'Viral Post', body: 'kiattp devtools', userId: 1 } }),
    api.get('/invalid-endpoint-404'),
  ]);
} catch (err) {
  // handled by devtools
}

if (!useTui) {
  console.log('\n[END] All requests completed.\n');
}
