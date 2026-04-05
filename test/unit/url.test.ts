import { describe, it, expect } from 'vitest';
import { buildUrl } from '../../src/core/url';

describe('buildUrl', () => {
  it('returns url as-is when no baseURL', () => {
    expect(buildUrl({ url: 'https://api.example.com/users' })).toBe(
      'https://api.example.com/users',
    );
  });

  it('combines baseURL and url', () => {
    expect(buildUrl({ baseURL: 'https://api.example.com', url: '/users' })).toBe(
      'https://api.example.com/users',
    );
  });

  it('handles trailing slash on baseURL', () => {
    expect(buildUrl({ baseURL: 'https://api.example.com/', url: '/users' })).toBe(
      'https://api.example.com/users',
    );
  });

  it('handles missing leading slash on url', () => {
    expect(buildUrl({ baseURL: 'https://api.example.com', url: 'users' })).toBe(
      'https://api.example.com/users',
    );
  });

  it('handles both trailing slash and missing leading slash', () => {
    expect(buildUrl({ baseURL: 'https://api.example.com/api/', url: 'users' })).toBe(
      'https://api.example.com/api/users',
    );
  });

  it('appends query params', () => {
    const result = buildUrl({
      url: 'https://api.example.com/users',
      params: { page: 1, limit: 10, active: true },
    });
    expect(result).toBe('https://api.example.com/users?page=1&limit=10&active=true');
  });

  it('encodes special characters in params', () => {
    const result = buildUrl({
      url: 'https://api.example.com/search',
      params: { q: 'hello world', filter: 'a&b=c' },
    });
    expect(result).toContain('q=hello%20world');
    expect(result).toContain('filter=a%26b%3Dc');
  });

  it('skips null and undefined params', () => {
    const result = buildUrl({
      url: 'https://api.example.com/users',
      params: { page: 1, name: null as unknown as undefined, skip: undefined },
    });
    expect(result).toBe('https://api.example.com/users?page=1');
  });

  it('returns baseURL when url is empty', () => {
    expect(buildUrl({ baseURL: 'https://api.example.com' })).toBe('https://api.example.com');
  });
});
