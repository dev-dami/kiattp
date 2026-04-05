import { describe, it, expect } from 'vitest';
import { InterceptorChain } from '../../src/interceptors/chain';
import type { Config, Response } from '../../src/types';

describe('InterceptorChain', () => {
  it('runs request interceptors in order', async () => {
    const chain = new InterceptorChain();
    const order: string[] = [];

    chain.addRequest(async (config) => {
      order.push('first');
      return config;
    });
    chain.addRequest(async (config) => {
      order.push('second');
      return config;
    });

    const config: Config = { url: '/test' };
    await chain.runRequest(config);
    expect(order).toEqual(['first', 'second']);
  });

  it('runs response interceptors in order', async () => {
    const chain = new InterceptorChain();
    const order: string[] = [];

    chain.addResponse(async (response) => {
      order.push('first');
      return response;
    });
    chain.addResponse(async (response) => {
      order.push('second');
      return response;
    });

    const response: Response = { data: null, status: 200, statusText: 'OK', headers: {}, config: {} };
    await chain.runResponse(response);
    expect(order).toEqual(['first', 'second']);
  });

  it('request interceptors can modify config', async () => {
    const chain = new InterceptorChain();
    chain.addRequest(async (config) => {
      config.headers = { ...config.headers, 'X-Added': 'true' };
      return config;
    });

    const config: Config = { url: '/test', headers: {} };
    const result = await chain.runRequest(config);
    expect(result.headers).toEqual({ 'X-Added': 'true' });
  });

  it('response interceptors can modify response', async () => {
    const chain = new InterceptorChain();
    chain.addResponse(async (response) => {
      response.data = 'modified';
      return response;
    });

    const response: Response = { data: 'original', status: 200, statusText: 'OK', headers: {}, config: {} };
    const result = await chain.runResponse(response);
    expect(result.data).toBe('modified');
  });

  it('propagates request interceptor errors', async () => {
    const chain = new InterceptorChain();
    chain.addRequest(async () => {
      throw new Error('interceptor error');
    });

    const config: Config = { url: '/test' };
    await expect(chain.runRequest(config)).rejects.toThrow('interceptor error');
  });

  it('propagates response interceptor errors', async () => {
    const chain = new InterceptorChain();
    chain.addResponse(async () => {
      throw new Error('response error');
    });

    const response: Response = { data: null, status: 200, statusText: 'OK', headers: {}, config: {} };
    await expect(chain.runResponse(response)).rejects.toThrow('response error');
  });
});
