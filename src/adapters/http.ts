import type { Config } from '../types';
import type { Adapter, AdapterResponse } from './types';
import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';

export const httpAdapter: Adapter = async (config: Config): Promise<AdapterResponse> => {
  const { url, method = 'GET', headers = {}, body, timeout, signal, onUploadProgress, onDownloadProgress } = config;

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

    // Handle upload progress
    if (body !== null && body !== undefined) {
      let bodyData: string | Buffer | undefined;

      if (typeof body === 'string') {
        bodyData = body;
      } else if (body instanceof URLSearchParams) {
        bodyData = body.toString();
      } else if (body instanceof FormData) {
        bodyData = body.toString();
      } else if (body instanceof ArrayBuffer) {
        bodyData = Buffer.from(body);
      } else if (Buffer.isBuffer(body)) {
        bodyData = body;
      } else if (typeof body === 'object') {
        bodyData = JSON.stringify(body);
      }

      if (bodyData) {
        const total = typeof bodyData === 'string' ? Buffer.byteLength(bodyData) : bodyData.length;
        let uploaded = 0;

        req.on('drain', () => {
          if (onUploadProgress) {
            onUploadProgress({ loaded: uploaded, total, bytes: 0 });
          }
        });

        const written = req.write(bodyData);
        uploaded += typeof bodyData === 'string' ? Buffer.byteLength(bodyData) : bodyData.length;

        if (onUploadProgress) {
          onUploadProgress({ loaded: uploaded, total, bytes: typeof bodyData === 'string' ? Buffer.byteLength(bodyData) : bodyData.length });
        }
      }
    }

    req.on('response', (res) => {
      const chunks: Buffer[] = [];
      let downloaded = 0;
      const contentLength = res.headers['content-length'];
      const total = contentLength ? parseInt(contentLength, 10) : undefined;

      res.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
        downloaded += chunk.length;
        if (onDownloadProgress) {
          onDownloadProgress({ loaded: downloaded, total, bytes: chunk.length });
        }
      });

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

        const data = Buffer.concat(chunks).toString('utf-8');

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
