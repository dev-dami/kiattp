import { describe, it, expect } from 'vitest';
import { InterceptorChain } from '../../src/interceptors/chain';
import type { Config, Response, HttpError } from '../../src/types';

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

  it('runs error interceptors in order', async () => {
    const chain = new InterceptorChain();
    const order: string[] = [];

    chain.addError(async (error) => {
      order.push('first');
      return error;
    });
    chain.addError(async (error) => {
      order.push('second');
      return error;
    });

    const error: HttpError = Object.assign(new Error('boom'), {
      name: 'NetworkError' as const,
      isAxiosError: true,
    });
    await chain.runError(error);
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

  it('error interceptors can transform the error', async () => {
    const chain = new InterceptorChain();
    chain.addError(async (error) => {
      return Object.assign(new Error('wrapped: ' + error.message), {
        name: 'NetworkError' as const,
        isAxiosError: true,
        handled: true,
      });
    });

    const error: HttpError = Object.assign(new Error('timeout'), {
      name: 'NetworkError' as const,
      isAxiosError: true,
    });
    const result = await chain.runError(error);
    expect(result.message).toBe('wrapped: timeout');
    expect((result as any).handled).toBe(true);
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

  it('propagates error interceptor errors', async () => {
    const chain = new InterceptorChain();
    chain.addError(async () => {
      throw new Error('error handler failed');
    });

    const error: HttpError = Object.assign(new Error('original'), {
      name: 'NetworkError' as const,
      isAxiosError: true,
    });
    await expect(chain.runError(error)).rejects.toThrow('error handler failed');
  });

  it('error interceptors can swallow and return a different error', async () => {
    const chain = new InterceptorChain();
    chain.addError(async () => {
      return Object.assign(new Error('recovered'), {
        name: 'HttpError' as const,
        isAxiosError: true,
        status: 503,
      });
    });

    const error: HttpError = Object.assign(new Error('500'), {
      name: 'HttpError' as const,
      isAxiosError: true,
      status: 500,
    });
    const result = await chain.runError(error);
    expect(result.message).toBe('recovered');
    expect(result.status).toBe(503);
  });

  it('skips error interceptors when none registered', async () => {
    const chain = new InterceptorChain();
    const error: HttpError = Object.assign(new Error('raw'), {
      name: 'NetworkError' as const,
      isAxiosError: true,
    });
    const result = await chain.runError(error);
    expect(result.message).toBe('raw');
    expect(result).toBe(error);
  });

  it('chains multiple error interceptors with early return', async () => {
    const chain = new InterceptorChain();
    const calls: number[] = [];

    chain.addError(async (error) => {
      calls.push(1);
      return error;
    });
    chain.addError(async (error) => {
      calls.push(2);
      return Object.assign(new Error('intercepted'), error, { name: 'HttpError' as const, isAxiosError: true });
    });
    chain.addError(async (error) => {
      calls.push(3);
      return error;
    });

    const error: HttpError = Object.assign(new Error('fail'), {
      name: 'HttpError' as const,
      isAxiosError: true,
    });
    const result = await chain.runError(error);
    expect(calls).toEqual([1, 2, 3]);
    expect(result.message).toBe('intercepted');
  });
});
