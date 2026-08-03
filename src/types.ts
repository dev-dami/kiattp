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

export interface CustomAdapterResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string | globalThis.Response | ReadableStream | unknown;
}

export type CustomAdapter = (config: Config) => Promise<CustomAdapterResponse>;
export type AdapterName = 'fetch' | 'http' | CustomAdapter;

export type TransformFn<T = unknown> = (data: T, headers: Record<string, string>) => unknown;

export interface AuthConfig {
  username: string;
  password: string;
}

export interface ProxyConfig {
  host: string;
  port: number;
  protocol?: string;
  auth?: AuthConfig;
}

export interface CookieJar {
  getCookieString(url: string): string;
  setCookie(cookieStr: string, url: string): void;
}

export type ParamsSerializerStyle = 'repeat' | 'brackets' | 'indices' | 'comma';

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
  params?: Record<string, any>;
  paramsSerializer?: ParamsSerializerStyle | ((params: Record<string, any>) => string);
  headers?: Record<string, string>;
  body?: BodyType;
  timeout?: number;
  signal?: AbortSignal;
  responseType?: ResponseType;
  validateStatus?: (status: number) => boolean;
  maxRedirects?: number;
  maxContentLength?: number;
  auth?: AuthConfig;
  proxy?: ProxyConfig;
  jar?: CookieJar;
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

/** A single parsed RFC 8288 link-value. Extra target attributes are preserved. */
export interface Link {
  url: string;
  rel: string;
  [attribute: string]: string;
}

/** Parsed `Link` header, keyed by lowercased relation type. */
export type Links = Readonly<Record<string, Link>>;

export interface Response<T = unknown> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  config: Config;
  /** Parsed `Link` header relations; empty object when the header is absent. */
  links: Links;
  /** Follow a relation, re-using this response's config. Resolves null if absent. */
  follow<R = T>(rel: string): Promise<Response<R> | null>;
  /** Shorthand for `follow('next')`. */
  next<R = T>(): Promise<Response<R> | null>;
}

export type ErrorCode =
  | 'ERR_BAD_REQUEST'
  | 'ERR_BAD_RESPONSE'
  | 'ERR_NETWORK'
  | 'ERR_CANCELED'
  | 'ERR_TIMEOUT'
  | 'ERR_TOO_LARGE'
  | 'ERR_TOO_MANY_REDIRECTS'
  | 'ERR_INVALID_URL';

export interface HttpError extends Error {
  name: 'HttpError' | 'NetworkError' | 'AbortError' | 'TimeoutError';
  status?: number;
  statusText?: string;
  response?: Response;
  config: Config;
  /** Stable machine-readable cause, independent of the message. */
  code?: ErrorCode;
  /** Request method, for debugging without unpacking `config`. */
  method?: HttpMethod;
  /** Fully-resolved request URL, for debugging without unpacking `config`. */
  url?: string;
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

export interface PaginateOptions extends Omit<Config, 'url'> {
  /** Relation to follow between pages. Default `'next'`. */
  rel?: string;
  /** Stop after this many pages. Default unlimited. */
  maxPages?: number;
}

export type Instance = {
  get: RequestFn;
  post: RequestFn;
  put: RequestFn;
  patch: RequestFn;
  delete: RequestFn;
  head: RequestFn;
  options: RequestFn;
  request: RequestFn;
  /** Walk `Link`-header pages, yielding each response in turn. */
  paginate: <T = unknown>(url: string, options?: PaginateOptions) => AsyncGenerator<Response<T>, void, undefined>;
  interceptors: Interceptors;
  use: (plugin: Plugin) => void;
};
