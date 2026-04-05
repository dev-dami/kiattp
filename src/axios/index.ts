import type { Config, Response, HttpError, Plugin, BodyType } from '../types';
import { createInstance as createKiaInstance } from '../instance';
import { CancelToken, isCancel } from './cancel';

interface AxiosConfig extends Config {
  data?: unknown;
  cancelToken?: CancelToken;
}

function toKiaConfig(config: AxiosConfig): Omit<Config, 'url'> {
  const { data, cancelToken, ...rest } = config;
  const bodyValue: BodyType = (data as BodyType) ?? rest.body;
  const kiaConfig: Omit<Config, 'url'> = {
    ...rest,
    body: bodyValue,
  };
  return kiaConfig;
}

function createAxiosInstance(defaults?: Partial<AxiosConfig>) {
  const kiaInstance = createKiaInstance(defaults as Partial<Config>);

  const makeRequest = async (url: string, config?: AxiosConfig) => {
    const mergedConfig = toKiaConfig({ ...config, url } as AxiosConfig);

    // Handle CancelToken → AbortSignal conversion
    if (config?.cancelToken) {
      const controller = new AbortController();
      config.cancelToken.promise.then(() => {
        controller.abort(config.cancelToken?.reason);
      });
      (mergedConfig as any).signal = controller.signal;
    }

    try {
      const res = await kiaInstance.request(url, mergedConfig);
      return res;
    } catch (err: unknown) {
      if (
        config?.cancelToken &&
        (err as Error).name === 'AbortError' &&
        config.cancelToken.reason
      ) {
        throw new Error(config.cancelToken.reason);
      }
      throw err;
    }
  };

  const axiosObj = {
    get: async (url: string, config?: AxiosConfig) =>
      makeRequest(url, { ...config, method: 'GET' as const }),
    post: async (url: string, data?: unknown, config?: AxiosConfig) =>
      makeRequest(url, { ...config, method: 'POST' as const, data }),
    put: async (url: string, data?: unknown, config?: AxiosConfig) =>
      makeRequest(url, { ...config, method: 'PUT' as const, data }),
    patch: async (url: string, data?: unknown, config?: AxiosConfig) =>
      makeRequest(url, { ...config, method: 'PATCH' as const, data }),
    delete: async (url: string, config?: AxiosConfig) =>
      makeRequest(url, { ...config, method: 'DELETE' as const }),
    head: async (url: string, config?: AxiosConfig) =>
      makeRequest(url, { ...config, method: 'HEAD' as const }),
    options: async (url: string, config?: AxiosConfig) =>
      makeRequest(url, { ...config, method: 'OPTIONS' as const }),
    request: makeRequest,
    create: (newDefaults?: Partial<AxiosConfig>) =>
      createAxiosInstance({ ...defaults, ...newDefaults }),
    interceptors: kiaInstance.interceptors,
    CancelToken,
    isCancel,
    isAxiosError: (
      error: unknown,
    ): error is HttpError & { isAxiosError: true } => {
      if (typeof error !== 'object' || error === null) return false;
      const obj = error as Record<string, unknown>;
      if ('isAxiosError' in obj) return true;
      const name = obj.name;
      return name === 'HttpError' || name === 'NetworkError';
    },
    all: Promise.all.bind(Promise),
    spread: <T extends unknown[], R>(callback: (...args: T) => R) => {
      return (arr: T) => callback(...arr);
    },
    use: kiaInstance.use,
  };

  return axiosObj;
}

export const axios = createAxiosInstance();
export { CancelToken, isCancel };
