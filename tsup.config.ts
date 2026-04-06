import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
    format: ['esm'],
    dts: true,
    clean: true,
    minify: true,
    treeshake: true,
    outDir: 'dist',
  },
  {
    entry: { axios: 'src/axios/index.ts' },
    format: ['esm'],
    dts: true,
    minify: true,
    treeshake: true,
    outDir: 'dist',
  },
  {
    entry: { http: 'src/http/index.ts' },
    format: ['esm'],
    dts: true,
    minify: true,
    treeshake: true,
    outDir: 'dist',
  },
  {
    entry: { 'plugins/retry': 'src/plugins-retry.ts', 'plugins/logger': 'src/plugins-logger.ts', 'plugins/timeout': 'src/plugins-timeout.ts' },
    format: ['esm'],
    dts: true,
    minify: true,
    treeshake: true,
    outDir: 'dist',
  },
]);
