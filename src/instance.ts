import type {
  Config,
  Response,
  Plugin,
  Instance,
  RequestFn,
  Interceptors,
  HttpMethod,
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
    });
  };

  const methodFn = (method: HttpMethod): RequestFn => {
    return (url, config) => makeRequest(url, { ...config, method });
  };

  const interceptors: Interceptors = {
    request: {
      use: (onFulfilled) => {
        instanceChain.addRequest(onFulfilled);
      },
    },
    response: {
      use: (onFulfilled) => {
        instanceChain.addResponse(onFulfilled);
      },
    },
  };

  const use = (plugin: Plugin) => {
    if (plugin.onRequest) instanceChain.addRequest(plugin.onRequest);
    if (plugin.onResponse) instanceChain.addResponse(plugin.onResponse);
    if (plugin.onError) {
      console.warn(
        `Plugin "${plugin.name}" provides onError but error interceptors are not yet supported`,
      );
    }
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
  if (plugin.onError) {
    console.warn(
      `Plugin "${plugin.name}" provides onError but error interceptors are not yet supported`,
    );
  }
}
