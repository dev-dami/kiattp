import type { Plugin, Config, HttpError } from '../types';

export interface RetryOptions {
  maxRetries: number;
  backoff?: 'fixed' | 'exponential' | 'linear';
  retryOn?: number[];
  retryOnNetworkError?: boolean;
  jitter?: boolean;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function calculateDelay(attempt: number, backoff: 'fixed' | 'exponential' | 'linear', jitter = false): number {
  let ms: number;
  switch (backoff) {
    case 'fixed': ms = 1000; break;
    case 'linear': ms = attempt * 1000; break;
    case 'exponential': ms = Math.min(1000 * 2 ** attempt, 30000); break;
  }
  if (jitter) {
    ms = ms * (0.5 + Math.random());
  }
  return ms;
}

export interface RetryConfig {
  _retry: {
    attempts: number;
    maxRetries: number;
    backoff: 'fixed' | 'exponential' | 'linear';
    retryOn: number[];
    retryOnNetworkError: boolean;
    jitter: boolean;
  };
}

export function retry_plugin(opts: RetryOptions): Plugin {
  const { maxRetries, backoff = 'exponential', retryOn = [429, 500, 502, 503, 504], retryOnNetworkError = true, jitter = false } = opts;

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
        jitter,
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
