import type { Config, ProgressCallback } from '../types';

export type AdapterName = 'fetch' | 'http';

export interface AdapterResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string | globalThis.Response | ReadableStream | null;
}

export interface AdapterError extends Error {
  name: string;
  status?: number;
  statusText?: string;
  body?: string;
}

export interface AdapterRequestConfig extends Config {
  onUploadProgress?: ProgressCallback;
  onDownloadProgress?: ProgressCallback;
}

export type Adapter = (config: AdapterRequestConfig) => Promise<AdapterResponse>;
