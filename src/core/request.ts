import type { Config, Response, HttpError, ErrorCode, HttpMethod } from "../types";
import { normalizeConfig } from "./config";
import { buildUrl } from "./url";
import { serializeBody, parseResponse } from "./serialize";
import { detectAdapter } from "../adapters/detect";
import { fetchAdapter } from "../adapters/fetch";
import { httpAdapter } from "../adapters/http";
import { InterceptorChain } from "../interceptors/chain";
import { applyXsrfHeaders } from "./xsrf";
import { attachLinks } from "./links";
import {
  shouldRetry,
  getRetryDelay,
  incrementRetryAttempt,
  RetryConfig,
} from "../plugins/retry";

const adapters = { fetch: fetchAdapter, http: httpAdapter };

// G interceptor chain
export const globalChain = new InterceptorChain();

/** Resolved once — adapter availability cannot change during a process. */
let cachedAdapter: keyof typeof adapters | undefined;

function makeError(
  message: string,
  name: HttpError["name"],
  code: ErrorCode,
  config: Config,
  extra?: Partial<HttpError>,
): HttpError {
  return Object.assign(new Error(message), {
    name,
    isAxiosError: true,
    code,
    config,
    method: config.method as HttpMethod | undefined,
    url: config.url,
    ...extra,
  }) as HttpError;
}

/**
 * Map an adapter-level throwable onto the normalized error contract. Adapters
 * signal intent with `name`/`code`; anything else is treated as a transport
 * failure.
 */
function toNetworkError(err: unknown, config: Config): HttpError {
  const e = err as Error & { name?: string; code?: ErrorCode };
  const message = err instanceof Error ? err.message : String(err);

  let code: ErrorCode = "ERR_NETWORK";
  if (e?.name === "AbortError") code = "ERR_CANCELED";
  else if (e?.name === "TimeoutError") code = "ERR_TIMEOUT";
  else if (e?.code) code = e.code;

  const error = makeError(message, "NetworkError", code, config);
  // Preserve the adapter's own name so `isCancel` and abort checks keep working.
  if (e?.name === "AbortError" || e?.name === "TimeoutError") error.name = e.name;
  if (err instanceof Error && err.stack) error.stack = err.stack;
  return error;
}

export async function request<T = unknown>(
  url: string,
  config?: Omit<Config, "url">,
  errorChain?: InterceptorChain,
): Promise<Response<T>> {
  let resolvedConfig = normalizeConfig({ ...config, url });

  // Request interceptors may rewrite baseURL, url or params, so the URL is
  // built after they run. `_urlResolved` marks a config whose url is already
  // final (a retry, or an instance that resolved it pre-interceptor).
  if (globalChain.hasRequest) {
    resolvedConfig = await globalChain.runRequest(resolvedConfig);
  }
  if (!(resolvedConfig as Config & { _urlResolved?: boolean })._urlResolved) {
    resolvedConfig.url = buildUrl(resolvedConfig);
  }

  const headers = resolvedConfig.headers!;
  applyXsrfHeaders(
    headers,
    resolvedConfig.xsrfCookieName,
    resolvedConfig.xsrfHeaderName,
  );

  // Apply Auth shortcut if present and authorization header is not explicitly set
  if (resolvedConfig.auth && !headers.authorization) {
    const authStr = `${resolvedConfig.auth.username}:${resolvedConfig.auth.password}`;
    const encoded = typeof btoa === "function" ? btoa(authStr) : Buffer.from(authStr).toString("base64");
    headers.authorization = `Basic ${encoded}`;
  }

  // Apply CookieJar cookies if present and cookie header is not explicitly set
  if (resolvedConfig.jar && !headers.cookie && resolvedConfig.url) {
    const jarCookies = resolvedConfig.jar.getCookieString(resolvedConfig.url);
    if (jarCookies) headers.cookie = jarCookies;
  }

  const method = resolvedConfig.method;
  const noBody = method === "GET" || method === "HEAD";

  // transformRequest and serializeBody both mutate `headers` (notably to set
  // content-type); the adapter must therefore receive this same object.
  let transformedBody = resolvedConfig.body;
  if (resolvedConfig.transformRequest) {
    for (const fn of resolvedConfig.transformRequest) {
      transformedBody = fn(transformedBody, headers) as Config["body"];
    }
  }

  const serializedBody = noBody
    ? undefined
    : serializeBody(transformedBody, headers, method);

  let adapter: any;
  if (typeof resolvedConfig.adapter === "function") {
    adapter = resolvedConfig.adapter;
  } else {
    const adapterName =
      resolvedConfig.adapter || (cachedAdapter ??= detectAdapter());
    adapter = adapters[adapterName];
  }

  try {
    const adapterResult = await adapter({
      ...resolvedConfig,
      headers,
      body: serializedBody,
    });

    if (resolvedConfig.jar && adapterResult.headers && resolvedConfig.url) {
      const setCookie = adapterResult.headers['set-cookie'] || adapterResult.headers['Set-Cookie'];
      if (setCookie) {
        resolvedConfig.jar.setCookie(setCookie, resolvedConfig.url);
      }
    }

    let data = await parseResponse(
      adapterResult.body,
      adapterResult.headers,
      resolvedConfig.responseType,
    );

    if (resolvedConfig.transformResponse) {
      for (const fn of resolvedConfig.transformResponse) {
        data = fn(data, adapterResult.headers);
      }
    }

    const response = {
      data: data as T,
      status: adapterResult.status,
      statusText: adapterResult.statusText,
      headers: adapterResult.headers,
      config: resolvedConfig,
    } as Response<T>;

    attachLinks(response, resolvedConfig.url, (nextUrl, nextConfig) =>
      request(nextUrl, nextConfig as Omit<Config, "url">, errorChain),
    );

    if (!resolvedConfig.validateStatus!(adapterResult.status)) {
      throw makeError(
        `Request failed with status ${adapterResult.status}`,
        "HttpError",
        adapterResult.status >= 500 ? "ERR_BAD_RESPONSE" : "ERR_BAD_REQUEST",
        resolvedConfig,
        {
          status: adapterResult.status,
          statusText: adapterResult.statusText,
          response,
        },
      );
    }

    const afterInstance = errorChain?.hasResponse
      ? await errorChain.runResponse(response)
      : response;
    return (
      globalChain.hasResponse
        ? globalChain.runResponse(afterInstance)
        : afterInstance
    ) as Promise<Response<T>>;
  } catch (err: unknown) {
    const name = (err as Error).name;
    const error: HttpError =
      name === "HttpError"
        ? (err as HttpError)
        : toNetworkError(err, resolvedConfig);

    // Retry covers transport failures as well as retryable statuses, so it is
    // evaluated for both error kinds.
    if (shouldRetry(error)) {
      incrementRetryAttempt(resolvedConfig as Config & RetryConfig);
      await new Promise((r) =>
        setTimeout(r, getRetryDelay(resolvedConfig as Config & RetryConfig, error)),
      );
      const { url: _url, ...retryConfig } = resolvedConfig;
      // The URL is already fully resolved; rebuilding it would re-append params.
      (retryConfig as Config & { _urlResolved?: boolean })._urlResolved = true;
      return request<T>(resolvedConfig.url!, retryConfig, errorChain);
    }

    // A cancellation is the caller's own doing — surface it untouched.
    if (error.name === "AbortError") throw error;

    if (errorChain?.hasError) throw await errorChain.runError(error);
    if (globalChain.hasError) throw await globalChain.runError(error);
    throw error;
  }
}
