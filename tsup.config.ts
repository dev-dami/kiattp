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
]);
