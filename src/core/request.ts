import type { Config, Response, HttpError } from "../types";
import { normalizeConfig } from "./config";
import { buildUrl } from "./url";
import { serializeBody, parseResponse } from "./serialize";
import { detectAdapter } from "../adapters/detect";
import { fetchAdapter } from "../adapters/fetch";
import { httpAdapter } from "../adapters/http";
import { InterceptorChain } from "../interceptors/chain";
import { applyXsrfHeaders } from "./xsrf";
import {
  shouldRetry,
  getRetryDelay,
  incrementRetryAttempt,
  RetryConfig,
} from "../plugins/retry";

const adapters = { fetch: fetchAdapter, http: httpAdapter };

// G interceptor chain
export const globalChain = new InterceptorChain();

export async function request<T = unknown>(
  url: string,
  config?: Omit<Config, "url">,
  errorChain?: InterceptorChain,
): Promise<Response<T>> {
  let resolvedConfig = normalizeConfig({ ...config, url });
  const fullUrl = buildUrl(resolvedConfig);

  resolvedConfig.url = fullUrl;
  resolvedConfig = await globalChain.runRequest(resolvedConfig);

  // Apply XSRF headers
  applyXsrfHeaders(
    resolvedConfig.headers || {},
    resolvedConfig.xsrfCookieName,
    resolvedConfig.xsrfHeaderName,
  );

  const headers = { ...resolvedConfig.headers };

  // Apply transformRequest before serialization
  let transformedBody = resolvedConfig.body;
  if (resolvedConfig.transformRequest) {
    for (const fn of resolvedConfig.transformRequest) {
      transformedBody = fn(transformedBody, headers) as Config['body'];
    }
  }

  const serializedBody = serializeBody(
    transformedBody,
    headers,
    resolvedConfig.method,
  );

  const adapterName = resolvedConfig.adapter || detectAdapter();
  const adapter = adapters[adapterName];

  try {
    const adapterResult = await adapter({
      ...resolvedConfig,
      body: serializedBody,
    });
    let data = await parseResponse(
      adapterResult.body,
      adapterResult.headers,
      resolvedConfig.responseType,
    );

    // Apply transformResponse after parsing
    if (resolvedConfig.transformResponse) {
      for (const fn of resolvedConfig.transformResponse) {
        data = fn(data, adapterResult.headers);
      }
    }

    const response: Response<T> = {
      data: data as T,
      status: adapterResult.status,
      statusText: adapterResult.statusText,
      headers: adapterResult.headers,
      config: resolvedConfig,
    };

    if (!resolvedConfig.validateStatus!(adapterResult.status)) {
      const error: HttpError = Object.assign(
        new Error(`Request failed with status ${adapterResult.status}`),
        {
          name: "HttpError" as const,
          isAxiosError: true,
          status: adapterResult.status,
          statusText: adapterResult.statusText,
          response,
          config: resolvedConfig,
        },
      );
      throw error;
    }

    return globalChain.runResponse(response) as Promise<Response<T>>;
  } catch (err: unknown) {
    if ((err as HttpError).name === "HttpError") {
      if (shouldRetry(err as HttpError)) {
        incrementRetryAttempt(resolvedConfig as Config & RetryConfig);
        await new Promise((r) =>
          setTimeout(r, getRetryDelay(resolvedConfig as Config & RetryConfig)),
        );
        return request<T>(resolvedConfig.url!, {
          method: resolvedConfig.method,
          headers: resolvedConfig.headers,
          body: resolvedConfig.body,
          timeout: resolvedConfig.timeout,
          signal: resolvedConfig.signal,
          responseType: resolvedConfig.responseType,
          validateStatus: resolvedConfig.validateStatus,
          onUploadProgress: resolvedConfig.onUploadProgress,
          onDownloadProgress: resolvedConfig.onDownloadProgress,
          transformRequest: resolvedConfig.transformRequest,
          transformResponse: resolvedConfig.transformResponse,
          adapter: resolvedConfig.adapter,
          xsrfCookieName: resolvedConfig.xsrfCookieName,
          xsrfHeaderName: resolvedConfig.xsrfHeaderName,
          maxContentLength: resolvedConfig.maxContentLength,
          credentials: resolvedConfig.credentials,
          decompress: resolvedConfig.decompress,
        }, errorChain);
      }
      if (errorChain) {
        const processedError = await errorChain.runError(err as HttpError);
        throw processedError;
      }
      throw err;
    }
    if ((err as Error).name === "AbortError") throw err;
    if ((err as Error).name === "NetworkError") throw err;
    const error = Object.assign(
      new Error(err instanceof Error ? err.message : String(err)),
      {
        name: "NetworkError" as const,
        isAxiosError: true,
        config: resolvedConfig,
      },
    );
    if (errorChain) {
      const processedError = await errorChain.runError(error as unknown as HttpError);
      throw processedError;
    }
    throw error;
  }
}
