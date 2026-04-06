import type { Config } from '../types';
import type { Adapter, AdapterResponse } from './types';

export const fetchAdapter: Adapter = async (config: Config): Promise<AdapterResponse> => {
  const { url, method = 'GET', headers = {}, body, signal, timeout, onDownloadProgress, credentials, maxContentLength } = config;

  if (!url) {
    throw new Error('Missing required "url" in config');
  }

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let fetchSignal: AbortSignal | undefined;

  if (timeout) {
    const timeoutController = new AbortController();
    timeoutId = setTimeout(() => timeoutController.abort(), timeout);
    fetchSignal = signal
      ? AbortSignal.any([signal, timeoutController.signal])
      : timeoutController.signal;
  } else if (signal) {
    fetchSignal = signal;
  }

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body as BodyInit | undefined,
      signal: fetchSignal,
      credentials: credentials as RequestCredentials | undefined,
    });

    // Check maxContentLength
    if (maxContentLength) {
      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength, 10) > maxContentLength) {
        throw Object.assign(
          new Error(`Response too large (${contentLength} > ${maxContentLength})`),
          { name: 'NetworkError', code: 'ERR_BAD_RESPONSE' },
        );
      }
    }

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key.toLowerCase()] = value;
    });

    // For json/text, let request.ts parse — use direct methods for speed
    if (!onDownloadProgress) {
      const respType = config.responseType;
      if (respType === 'blob') return { status: response.status, statusText: response.statusText, headers: responseHeaders, body: await response.blob() as any };
      if (respType === 'arraybuffer') return { status: response.status, statusText: response.statusText, headers: responseHeaders, body: await response.arrayBuffer() as any };
      if (respType === 'stream') return { status: response.status, statusText: response.statusText, headers: responseHeaders, body: response.body as any };
      if (respType === 'text') return { status: response.status, statusText: response.statusText, headers: responseHeaders, body: await response.text() };
      // Default (json/undefined): return Response object for parseResponse to handle
      return { status: response.status, statusText: response.statusText, headers: responseHeaders, body: response };
    }

    // Download progress path — manual streaming
    if (onDownloadProgress && response.body) {
      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : undefined;
      const reader = response.body.getReader();
      let loaded = 0;
      let byteLimit = maxContentLength;
      const chunks: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        loaded += value.length;
        if (byteLimit && loaded > byteLimit) {
          reader.cancel();
          throw Object.assign(
            new Error(`Response too large (> ${byteLimit} bytes)`),
            { name: 'NetworkError', code: 'ERR_BAD_RESPONSE' },
          );
        }
        chunks.push(value);
        onDownloadProgress({ loaded, total, bytes: value.length });
      }

      const decoder = new TextDecoder();
      const totalBytes = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const combined = new Uint8Array(totalBytes);
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }
      const responseText = decoder.decode(combined);

      return {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        body: responseText,
      };
    }

    // Fallback: return Response for json parsing by parseResponse
    return { status: response.status, statusText: response.statusText, headers: responseHeaders, body: response };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};
