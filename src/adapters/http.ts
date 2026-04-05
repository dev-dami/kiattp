import type { Config } from '../types';
import type { Adapter, AdapterResponse } from './types';
import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';

export const httpAdapter: Adapter = async (config: Config): Promise<AdapterResponse> => {
  const { url, method = 'GET', headers = {}, body, timeout, signal } = config;

  if (!url) {
    throw new Error('Missing required "url" in config');
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch (e) {
    throw new Error(`Invalid URL: ${url}`, { cause: e });
  }

  const transport = parsedUrl.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    const req = transport.request(url, { method, headers });
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    if (timeout) {
      timeoutId = setTimeout(() => {
        req.destroy();
        reject(new Error(`Timeout of ${timeout}ms exceeded`));
      }, timeout);
    }
    let abortHandler: (() => void) | undefined;
    if (signal) {
      abortHandler = () => {
        req.destroy();
        if (timeoutId) clearTimeout(timeoutId);
        const abortErr = new Error('Request aborted');
        abortErr.name = 'AbortError';
        reject(abortErr);
      };
      signal.addEventListener('abort', abortHandler);
    }

    function cleanup() {
      if (timeoutId) clearTimeout(timeoutId);
      if (signal && abortHandler) signal.removeEventListener('abort', abortHandler);
    }
    if (body !== null && body !== undefined) {
      if (typeof body === 'string') {
        req.write(body);
      } else if (body instanceof URLSearchParams || body instanceof FormData) {
        req.write(body.toString());
      } else if (typeof body === 'object') {
        req.write(JSON.stringify(body));
      }
    }

    req.on('response', (res) => {
      let data = '';
      res.on('data', (chunk: string) => { data += chunk; });

      res.on('end', () => {
        cleanup();
        const responseHeaders: Record<string, string> = {};
        for (const [key, value] of Object.entries(res.headers)) {
          if (typeof value === 'string') {
            responseHeaders[key.toLowerCase()] = value;
          } else if (Array.isArray(value)) {
            responseHeaders[key.toLowerCase()] = value.join(', ');
          }
        }

        resolve({
          status: res.statusCode ?? 0,
          statusText: res.statusMessage ?? '',
          headers: responseHeaders,
          body: data,
        });
      });

      res.on('error', (err) => {
        cleanup();
        reject(err);
      });
    });

    req.on('error', (err: Error & { code?: string }) => {
      cleanup();
      reject(err);
    });

    req.end();
  });
};
