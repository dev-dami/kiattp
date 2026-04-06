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

    if (maxContentLength) {
      const cl = response.headers.get('content-length');
      if (cl && parseInt(cl, 10) > maxContentLength) {
        throw Object.assign(
          new Error(`Response too large (${cl} > ${maxContentLength})`),
          { name: 'NetworkError', code: 'ERR_BAD_RESPONSE' },
        );
      }
    }

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key.toLowerCase()] = value;
    });

    // Binary types: return directly
    if (onDownloadProgress) return await _readProgress(response, responseHeaders, onDownloadProgress, maxContentLength);
    if (config.responseType === 'blob') return { status: response.status, statusText: response.statusText, headers: responseHeaders, body: await response.blob() as any };
    if (config.responseType === 'arraybuffer') return { status: response.status, statusText: response.statusText, headers: responseHeaders, body: await response.arrayBuffer() as any };
    if (config.responseType === 'stream') return { status: response.status, statusText: response.statusText, headers: responseHeaders, body: response.body as any };

    // json/undefined/text: return Response for parseResponse to handle with native methods
    return { status: response.status, statusText: response.statusText, headers: responseHeaders, body: response };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

async function _readProgress(
  response: Response,
  responseHeaders: Record<string, string>,
  onDownloadProgress: import('../types').ProgressCallback,
  maxContentLength?: number,
): Promise<AdapterResponse> {
  if (!response.body) return { status: response.status, statusText: response.statusText, headers: responseHeaders, body: await response.text() };
  const cl = response.headers.get('content-length');
  const total = cl ? parseInt(cl, 10) : undefined;
  const reader = response.body.getReader();
  let loaded = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    loaded += value.length;
    if (maxContentLength && loaded > maxContentLength) throw Object.assign(new Error(`Response too large (> ${maxContentLength})`), { name: 'NetworkError' });
    chunks.push(value);
    onDownloadProgress({ loaded, total, bytes: value.length });
  }
  const out = new Uint8Array(loaded);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return { status: response.status, statusText: response.statusText, headers: responseHeaders, body: new TextDecoder().decode(out) };
}
