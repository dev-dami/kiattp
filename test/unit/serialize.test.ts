import { describe, it, expect } from 'vitest';
import { serializeBody, parseResponse } from '../../src/core/serialize';

describe('serializeBody', () => {
  it('serializes objects to JSON and sets content-type', () => {
    const headers: Record<string, string> = {};
    const result = serializeBody({ name: 'Alice' }, headers);
    expect(result).toBe('{"name":"Alice"}');
    expect(headers['content-type']).toBe('application/json');
  });

  it('does not override existing content-type', () => {
    const headers: Record<string, string> = { 'content-type': 'application/json; charset=utf-8' };
    serializeBody({ name: 'Alice' }, headers);
    expect(headers['content-type']).toBe('application/json; charset=utf-8');
  });

  it('passes through strings as-is', () => {
    const headers: Record<string, string> = {};
    const result = serializeBody('raw body', headers);
    expect(result).toBe('raw body');
  });

  it('passes through FormData unchanged', () => {
    const formData = new FormData();
    formData.append('key', 'value');
    const headers: Record<string, string> = {};
    const result = serializeBody(formData, headers);
    expect(result).toBe(formData);
    // Content-Type should NOT be set (browser sets boundary)
    expect(headers['content-type']).toBeUndefined();
  });

  it('passes through URLSearchParams unchanged', () => {
    const params = new URLSearchParams('a=1&b=2');
    const headers: Record<string, string> = {};
    const result = serializeBody(params, headers);
    expect(result).toBe(params);
  });

  it('returns undefined body for GET requests', () => {
    const headers: Record<string, string> = {};
    const result = serializeBody({ name: 'Alice' }, headers, 'GET');
    expect(result).toBeUndefined();
  });

  it('returns undefined body for HEAD requests', () => {
    const headers: Record<string, string> = {};
    const result = serializeBody({ name: 'Alice' }, headers, 'HEAD');
    expect(result).toBeUndefined();
  });
});

describe('parseResponse', () => {
  it('parses JSON when content-type is application/json', async () => {
    const body = '{"name":"Alice","age":30}';
    const headers = { 'content-type': 'application/json' };
    const result = await parseResponse(body, headers, 'json');
    expect(result).toEqual({ name: 'Alice', age: 30 });
  });

  it('returns text when content-type is text/plain', async () => {
    const body = 'hello world';
    const headers = { 'content-type': 'text/plain' };
    const result = await parseResponse(body, headers, 'text');
    expect(result).toBe('hello world');
  });

  it('falls back to text when JSON parse fails', async () => {
    const body = 'not json';
    const headers = { 'content-type': 'application/json' };
    const result = await parseResponse(body, headers, 'json');
    expect(result).toBe('not json');
  });

  it('returns null for empty body', async () => {
    const headers = { 'content-type': 'application/json' };
    const result = await parseResponse('', headers, 'json');
    expect(result).toBeNull();
  });
});
