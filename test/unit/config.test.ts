import { describe, it, expect } from 'vitest';
import { normalizeConfig, defaultConfig } from '../../src/core/config';

describe('normalizeConfig', () => {
  it('applies default values for missing fields', () => {
    const result = normalizeConfig({ url: '/test' });
    expect(result.method).toBe('GET');
    expect(result.headers).toEqual({});
    expect(result.validateStatus).toBeDefined();
    expect(result.validateStatus!(200)).toBe(true);
    expect(result.validateStatus!(404)).toBe(false);
  });

  it('merges instance defaults with call-time config', () => {
    const defaults = { baseURL: 'https://api.example.com', timeout: 5000 };
    const result = normalizeConfig({ url: '/users', headers: { 'X-Custom': 'v' } }, defaults);
    expect(result.baseURL).toBe('https://api.example.com');
    expect(result.timeout).toBe(5000);
    expect(result.url).toBe('/users');
    expect(result.headers).toEqual({ 'x-custom': 'v' });
  });

  it('call-time config overrides instance defaults', () => {
    const defaults = { timeout: 5000, headers: { 'X-Default': 'yes' } };
    const result = normalizeConfig({ url: '/test', timeout: 10000 }, defaults);
    expect(result.timeout).toBe(10000);
    expect(result.headers).toEqual({ 'x-default': 'yes' });
  });

  it('clones config to avoid shared mutable state', () => {
    const defaults = { headers: { 'X-Shared': 'val' } };
    const result = normalizeConfig({ url: '/test' }, defaults);
    result.headers!['X-Modified'] = 'changed';
    const result2 = normalizeConfig({ url: '/test' }, defaults);
    expect(result2.headers).not.toHaveProperty('X-Modified');
  });

  it('normalizes header keys to lowercase', () => {
    const result = normalizeConfig({
      url: '/test',
      headers: { 'Content-Type': 'application/json', 'X-Custom': 'val' },
    });
    expect(result.headers).toEqual({ 'content-type': 'application/json', 'x-custom': 'val' });
  });
});
