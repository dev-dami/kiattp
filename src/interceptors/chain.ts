import type { Config, Response } from '../types';
import type { RequestInterceptor, ResponseInterceptor } from './types';

export class InterceptorChain {
  private requestInterceptors: RequestInterceptor[] = [];
  private responseInterceptors: ResponseInterceptor[] = [];

  addRequest(fn: RequestInterceptor): void {
    this.requestInterceptors.push(fn);
  }

  addResponse(fn: ResponseInterceptor): void {
    this.responseInterceptors.push(fn);
  }

  async runRequest(config: Config): Promise<Config> {
    let current = config;
    for (const interceptor of this.requestInterceptors) {
      current = await interceptor(current);
    }
    return current;
  }

  async runResponse(response: Response): Promise<Response> {
    let current = response;
    for (const interceptor of this.responseInterceptors) {
      current = await interceptor(current);
    }
    return current;
  }
}
