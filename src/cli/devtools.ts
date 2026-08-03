#!/usr/bin/env node
import { createInstance } from '../index.js';
import { devtools_plugin } from '../plugins/devtools.js';

const targetUrl = process.argv[2] || 'https://jsonplaceholder.typicode.com/posts/1';

console.clear();

const api = createInstance();
api.use(
  devtools_plugin({
    label: 'KIATTP DEVTOOLS CLI TUI',
    tui: true,
  }),
);

console.log(`[CLI] Monitoring HTTP request to ${targetUrl}...`);

try {
  await api.get(targetUrl);
} catch (e) {
  // handled by devtools
}
