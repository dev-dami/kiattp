import type {
  Config,
  Response,
  Plugin,
  Instance,
  RequestFn,
  Interceptors,
  HttpMethod,
  HttpError,
} from "./types";
import { request, globalChain } from "./core/request";
import { InterceptorChain } from "./interceptors/chain";
import { normalizeConfig } from "./core/config";
import { buildUrl } from "./core/url";

export function createInstance(defaults?: Partial<Config>): Instance {
  const instanceChain = new InterceptorChain();

  const makeRequest: RequestFn = async (url, config) => {
    const merged = normalizeConfig({ ...config, url }, defaults);
    const fullUrl = buildUrl(merged);
    const instanceConfig = await instanceChain.runRequest({
      ...merged,
      url: fullUrl,
    });
    return request(instanceConfig.url!, {
      method: instanceConfig.method,
      headers: instanceConfig.headers,
      body: instanceConfig.body,
      timeout: instanceConfig.timeout,
      signal: instanceConfig.signal,
      responseType: instanceConfig.responseType,
      validateStatus: instanceConfig.validateStatus,
      onUploadProgress: instanceConfig.onUploadProgress,
      onDownloadProgress: instanceConfig.onDownloadProgress,
      transformRequest: instanceConfig.transformRequest,
      transformResponse: instanceConfig.transformResponse,
      adapter: instanceConfig.adapter,
      xsrfCookieName: instanceConfig.xsrfCookieName,
      xsrfHeaderName: instanceConfig.xsrfHeaderName,
      maxContentLength: instanceConfig.maxContentLength,
      credentials: instanceConfig.credentials,
      decompress: instanceConfig.decompress,
    }, instanceChain);
  };

  const methodFn = (method: HttpMethod): RequestFn => {
    return (url, config) => makeRequest(url, { ...config, method });
  };

  const interceptors: Interceptors = {
    request: {
      use: (onFulfilled, onRejected) => {
        instanceChain.addRequest(onFulfilled);
        if (onRejected) {
          instanceChain.addError(onRejected as (error: HttpError) => HttpError | Promise<HttpError>);
        }
      },
    },
    response: {
      use: (onFulfilled, onRejected) => {
        instanceChain.addResponse(onFulfilled);
        if (onRejected) {
          instanceChain.addError(onRejected as (error: HttpError) => HttpError | Promise<HttpError>);
        }
      },
    },
  };

  const use = (plugin: Plugin) => {
    if (plugin.onRequest) instanceChain.addRequest(plugin.onRequest);
    if (plugin.onResponse) instanceChain.addResponse(plugin.onResponse);
    if (plugin.onError) instanceChain.addError(plugin.onError);
  };

  return {
    get: methodFn("GET"),
    post: methodFn("POST"),
    put: methodFn("PUT"),
    patch: methodFn("PATCH"),
    delete: methodFn("DELETE"),
    head: methodFn("HEAD"),
    options: methodFn("OPTIONS"),
    request: makeRequest,
    interceptors,
    use,
  };
}

// G use function
export function use(plugin: Plugin): void {
  if (plugin.onRequest) globalChain.addRequest(plugin.onRequest);
  if (plugin.onResponse) globalChain.addResponse(plugin.onResponse);
  if (plugin.onError) globalChain.addError(plugin.onError);
}
