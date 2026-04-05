export type HttpMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'HEAD'
  | 'OPTIONS';

export type ResponseType = 'json' | 'text' | 'blob' | 'arraybuffer' | 'stream';

export interface ProgressEvent {
  loaded: number;
  total?: number;
  bytes: number;
}

export type ProgressCallback = (progress: ProgressEvent) => void;

export type AdapterName = 'fetch' | 'http';

export type TransformFn<T = unknown> = (data: T, headers: Record<string, string>) => unknown;

export interface ProxyConfig {
  host: string;
  port: number;
  protocol?: string;
  auth?: { username: string; password: string };
}

export type BodyType =
  | string
  | FormData
  | URLSearchParams
  | Blob
  | ArrayBuffer
  | ArrayBufferView
  | ReadableStream
  | Record<string, unknown>
  | unknown[]
  | null
  | undefined;

export interface Config {
  baseURL?: string;
  url?: string;
  method?: HttpMethod;
  params?: Record<string, string | number | boolean | null | undefined>;
  paramsSerializer?: (params: Record<string, string | number | boolean | null | undefined>) => string;
  headers?: Record<string, string>;
  body?: BodyType;
  timeout?: number;
  signal?: AbortSignal;
  responseType?: ResponseType;
  validateStatus?: (status: number) => boolean;
  maxRedirects?: number;
  maxContentLength?: number;
  proxy?: ProxyConfig;
  onUploadProgress?: ProgressCallback;
  onDownloadProgress?: ProgressCallback;
  transformRequest?: TransformFn[];
  transformResponse?: TransformFn[];
  credentials?: 'omit' | 'same-origin' | 'include';
  adapter?: AdapterName;
  decompress?: boolean;
  xsrfCookieName?: string;
  xsrfHeaderName?: string;
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
