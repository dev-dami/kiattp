import type { Config } from '../types';
import type { Adapter, AdapterResponse } from './types';
import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';
import * as zlib from 'zlib';

export const httpAdapter: Adapter = async (config: Config): Promise<AdapterResponse> => {
  const { url, method = 'GET', headers = {}, body, timeout, signal, onUploadProgress, onDownloadProgress, maxContentLength, decompress } = config;

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

    // Write pre-serialized body
    if (body !== null && body !== undefined) {
      if (typeof body === "string") {
        req.write(body);
      } else if (body instanceof FormData || body instanceof URLSearchParams) {
        req.write(body.toString());
      } else if (body instanceof ArrayBuffer || Buffer.isBuffer(body)) {
        req.write(Buffer.isBuffer(body) ? body : Buffer.from(body as ArrayBuffer));
      }
    }

    req.on('response', (res) => {
      const chunks: Buffer[] = [];
      let downloaded = 0;
      const contentLength = res.headers['content-length'];
      const total = contentLength ? parseInt(contentLength, 10) : undefined;

      // Check maxContentLength from header
      if (maxContentLength && contentLength && parseInt(contentLength, 10) > maxContentLength) {
        cleanup();
        req.destroy();
        reject(Object.assign(
          new Error(`Response too large (${contentLength} > ${maxContentLength})`),
          { name: 'NetworkError', code: 'ERR_BAD_RESPONSE' },
        ));
        return;
      }

      // Handle decompression
      let decompressStream: ReturnType<typeof zlib.createGunzip> | null = null;
      const encoding = res.headers['content-encoding'];
      if (decompress !== false && encoding === 'gzip') {
        decompressStream = zlib.createGunzip();
      }

      const target = decompressStream || res;

      target.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
        downloaded += chunk.length;
        if (maxContentLength && downloaded > maxContentLength) {
          target.destroy();
          cleanup();
          req.destroy();
          reject(Object.assign(
            new Error(`Response too large (> ${maxContentLength} bytes)`),
            { name: 'NetworkError', code: 'ERR_BAD_RESPONSE' },
          ));
          return;
        }
        if (onDownloadProgress) {
          onDownloadProgress({ loaded: downloaded, total, bytes: chunk.length });
        }
      });

      target.on('end', () => {
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

      target.on('error', (err) => {
        cleanup();
        reject(err);
      });

      // Pipe response through decompressor if active
      if (decompressStream) {
        res.pipe(decompressStream);
      }
    });

    req.on('error', (err: Error & { code?: string }) => {
      cleanup();
      reject(err);
    });

    req.end();
  });
};
