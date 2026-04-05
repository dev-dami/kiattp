import type { Plugin, Config, HttpError } from '../types';

export interface RetryOptions {
  maxRetries: number;
  backoff?: 'fixed' | 'exponential' | 'linear';
  retryOn?: number[];
  retryOnNetworkError?: boolean;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function calculateDelay(attempt: number, backoff: 'fixed' | 'exponential' | 'linear'): number {
  switch (backoff) {
    case 'fixed': return 1000;
    case 'linear': return attempt * 1000;
    case 'exponential': return Math.min(1000 * 2 ** attempt, 30000);
  }
}

export interface RetryConfig {
  _retry: {
    attempts: number;
    maxRetries: number;
    backoff: 'fixed' | 'exponential' | 'linear';
    retryOn: number[];
    retryOnNetworkError: boolean;
  };
}

export function retry_plugin(opts: RetryOptions): Plugin {
  const { maxRetries, backoff = 'exponential', retryOn = [429, 500, 502, 503, 504], retryOnNetworkError = true } = opts;

  return {
    name: 'retry',
    onRequest: (config: Config) => {
      const existing = (config as Config & RetryConfig)._retry;
      (config as Config & RetryConfig)._retry = {
        attempts: existing?.attempts ?? 0,
        maxRetries,
        backoff,
        retryOn,
        retryOnNetworkError,
      };
      return config;
    },
  };
}

export function shouldRetry(error: HttpError): boolean {
  const config = error.config as Config & RetryConfig;
  if (!config._retry) return false;

  const { attempts, maxRetries, retryOn, retryOnNetworkError } = config._retry;
  if (attempts >= maxRetries) return false;

  const isNetworkError = !error.status;
  if (isNetworkError) return retryOnNetworkError;

  return retryOn.includes(error.status!);
}

export function getRetryDelay(config: Config & RetryConfig): number {
  return calculateDelay(config._retry.attempts + 1, config._retry.backoff);
}

export function incrementRetryAttempt(config: Config & RetryConfig): void {
  config._retry.attempts++;
}
