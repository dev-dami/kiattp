import type { Config } from '../types';
import type { Adapter, AdapterResponse } from './types';

export const fetchAdapter: Adapter = async (config: Config): Promise<AdapterResponse> => {
  const { url, method = 'GET', headers = {}, body, signal, timeout, onDownloadProgress, credentials, maxContentLength } = config;

  if (!url) {
    throw new Error('Missing required "url" in config');
  }

  const timeoutController = new AbortController();
  const timeoutId = timeout
    ? setTimeout(() => timeoutController.abort(), timeout)
    : undefined;

  try {
    const fetchSignal = signal
      ? AbortSignal.any([signal, timeoutController.signal])
      : timeoutController.signal;

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
          new Error(`Content length ${contentLength} exceeds limit of ${maxContentLength}`),
          { name: 'NetworkError', code: 'ERR_BAD_RESPONSE' },
        );
      }
    }

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key.toLowerCase()] = value;
    });

    // Handle download progress if callback provided
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
            new Error(`Content length exceeds limit of ${byteLimit}`),
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

    const responseText = await response.text();

    return {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: responseText,
    };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};
