import type { Config } from '../types';
import type { Adapter, AdapterResponse } from './types';

export const fetchAdapter: Adapter = async (config: Config): Promise<AdapterResponse> => {
  const { url, method = 'GET', headers = {}, body, signal, timeout } = config;

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
    });

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key.toLowerCase()] = value;
    });

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
