import type { Config, Response } from '../types';

export type AdapterName = 'fetch' | 'http';

export interface AdapterResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
}

export interface AdapterError extends Error {
  name: string;
  status?: number;
  statusText?: string;
  body?: string;
}

export type Adapter = (config: Config) => Promise<AdapterResponse>;
