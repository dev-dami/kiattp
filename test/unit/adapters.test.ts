import { describe, it, expect } from 'vitest';
import { detectAdapter } from '../../src/adapters/detect';
import { fetchAdapter } from '../../src/adapters/fetch';
import { httpAdapter } from '../../src/adapters/http';

describe('detectAdapter', () => {
  it('returns fetch when globalThis.fetch is available', () => {
    // In Node 18+ and browsers, fetch is available
    const result = detectAdapter();
    expect(result).toBe('fetch');
  });
});

describe('fetchAdapter', () => {
  it('is a function', () => {
    expect(typeof fetchAdapter).toBe('function');
  });
});

describe('httpAdapter', () => {
  it('is a function', () => {
    expect(typeof httpAdapter).toBe('function');
  });
});
