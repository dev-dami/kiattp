export type {
  Config,
  Response,
  HttpError,
  Plugin,
  HttpMethod,
  ResponseType,
  Interceptors,
  Instance,
  BodyType,
  ProgressEvent,
  ProgressCallback,
} from './types';

export type { RequestInterceptor, ResponseInterceptor, ErrorInterceptor } from './interceptors/types';

export { request } from './core/request';
export { createInstance, use } from './instance';
export { retry_plugin } from './plugins/retry';
export { logger_plugin } from './plugins/logger';
export { timeout_plugin } from './plugins/timeout';

import type { Config } from './types';
import { request, globalChain } from './core/request';

export const get = <T = unknown>(url: string, config?: Omit<Config, 'url'>) =>
  request<T>(url, { ...config, method: 'GET' }, globalChain);
export const post = <T = unknown>(url: string, config?: Omit<Config, 'url'>) =>
  request<T>(url, { ...config, method: 'POST' }, globalChain);
export const put = <T = unknown>(url: string, config?: Omit<Config, 'url'>) =>
  request<T>(url, { ...config, method: 'PUT' }, globalChain);
export const patch = <T = unknown>(url: string, config?: Omit<Config, 'url'>) =>
  request<T>(url, { ...config, method: 'PATCH' }, globalChain);
export const del = <T = unknown>(url: string, config?: Omit<Config, 'url'>) =>
  request<T>(url, { ...config, method: 'DELETE' }, globalChain);
export const head = <T = unknown>(url: string, config?: Omit<Config, 'url'>) =>
  request<T>(url, { ...config, method: 'HEAD' }, globalChain);
export const options = <T = unknown>(url: string, config?: Omit<Config, 'url'>) =>
  request<T>(url, { ...config, method: 'OPTIONS' }, globalChain);
