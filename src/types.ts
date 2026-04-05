export type HttpMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'HEAD'
  | 'OPTIONS';

export type ResponseType = 'json' | 'text' | 'blob' | 'arraybuffer' | 'stream';

export interface ProxyConfig {
  host: string;
  port: number;
  protocol?: string;
  auth?: { username: string; password: string };
}

export interface Config {
  baseURL?: string;
  url?: string;
  method?: HttpMethod;
  params?: Record<string, string | number | boolean | null | undefined>;
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
  signal?: AbortSignal;
  responseType?: ResponseType;
  validateStatus?: (status: number) => boolean;
  maxRedirects?: number;
  proxy?: ProxyConfig;
}

export interface Response<T = unknown> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  config: Config;
}

export interface HttpError extends Error {
  name: 'HttpError';
  status?: number;
  statusText?: string;
  response?: Response;
  config: Config;
  isAxiosError?: boolean;
}

export interface Plugin {
  name: string;
  onRequest?: (config: Config) => Config | Promise<Config>;
  onResponse?: (response: Response) => Response | Promise<Response>;
  onError?: (error: HttpError) => HttpError | Promise<never>;
}

export interface Interceptors {
  request: {
    use: (
      onFulfilled: (config: Config) => Config | Promise<Config>,
      onRejected?: (error: unknown) => unknown,
    ) => void;
  };
  response: {
    use: (
      onFulfilled: (response: Response) => Response | Promise<Response>,
      onRejected?: (error: unknown) => unknown,
    ) => void;
  };
}

export type RequestFn = <T = unknown>(
  url: string,
  config?: Omit<Config, 'url'>,
) => Promise<Response<T>>;

export type Instance = {
  get: RequestFn;
  post: RequestFn;
  put: RequestFn;
  patch: RequestFn;
  delete: RequestFn;
  head: RequestFn;
  options: RequestFn;
  request: RequestFn;
  interceptors: Interceptors;
  use: (plugin: Plugin) => void;
};
