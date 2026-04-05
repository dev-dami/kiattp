import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { gzipSync } from 'zlib';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, '../../dist');

describe('bundle size', () => {
  it('core bundle is under 8KB gzipped', () => {
    const content = readFileSync(join(distDir, 'index.js'));
    const gzipped = gzipSync(content);
    const sizeKB = gzipped.length / 1024;
    expect(sizeKB).toBeLessThan(8);
    console.log(`Core bundle: ${sizeKB.toFixed(2)}KB gzipped`);
  });

  it('axios compat bundle is under 12KB gzipped', () => {
    const content = readFileSync(join(distDir, 'axios.js'));
    const gzipped = gzipSync(content);
    const sizeKB = gzipped.length / 1024;
    expect(sizeKB).toBeLessThan(12);
    console.log(`Axios compat bundle: ${sizeKB.toFixed(2)}KB gzipped`);
  });
});
