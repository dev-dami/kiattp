// scripts/size-check.mjs
// Placeholder — implemented in Task 15 (Bundle Size Verification)
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { gzipSync } from 'zlib';
import { join } from 'path';

const distDir = 'dist';
const maxCoreSize = 8 * 1024;
const maxAxiosSize = 12 * 1024;

function checkSize(file, max) {
  const filePath = join(distDir, file);
  const content = readFileSync(filePath);
  const gzipped = gzipSync(content);
  const sizeKB = (gzipped.length / 1024).toFixed(2);
  const maxKB = (max / 1024).toFixed(2);
  const pass = gzipped.length <= max;
  console.log(`${file}: ${sizeKB}KB / ${maxKB}KB ${pass ? '✓' : '✗'}`);
  return pass;
}

const coreOk = checkSize('index.js', maxCoreSize);
const axiosOk = checkSize('axios.js', maxAxiosSize);

if (!coreOk || !axiosOk) {
  console.error('Bundle size exceeds limits!');
  process.exit(1);
}
console.log('All bundle size checks passed.');
