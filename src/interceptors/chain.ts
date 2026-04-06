import type { Config, Response, HttpError } from '../types';
import type { RequestInterceptor, ResponseInterceptor, ErrorInterceptor } from './types';

export class InterceptorChain {
  private requestInterceptors: RequestInterceptor[] = [];
  private responseInterceptors: ResponseInterceptor[] = [];
  private errorInterceptors: ErrorInterceptor[] = [];

  addRequest(fn: RequestInterceptor): void {
    this.requestInterceptors.push(fn);
  }

  addResponse(fn: ResponseInterceptor): void {
    this.responseInterceptors.push(fn);
  }

  addError(fn: ErrorInterceptor): void {
    this.errorInterceptors.push(fn);
  }

  async runRequest(config: Config): Promise<Config> {
    let current = config;
    for (const interceptor of this.requestInterceptors) {
      current = await interceptor(current);
    }
    return current;
  }

  get hasResponse(): boolean {
    return this.responseInterceptors.length > 0;
  }

  async runResponse(response: Response): Promise<Response> {
    let current = response;
    for (const interceptor of this.responseInterceptors) {
      current = await interceptor(current);
    }
    return current;
  }

  async runError(error: HttpError): Promise<HttpError> {
    let current = error;
    for (const interceptor of this.errorInterceptors) {
      current = await interceptor(current);
    }
    return current;
  }
}
